package history

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

// unlinkSchema keeps, per phone whose data UnlinkPhoneData is moving, the id
// it moves to, so a move cut short goes on under the same id.
const unlinkSchema = `
CREATE TABLE IF NOT EXISTS phone_unlinking (
	device   TEXT PRIMARY KEY,
	unlinked TEXT NOT NULL
) WITHOUT ROWID;
`

// RemovedPhonePrefix starts the id a removed phone's route and Wi-Fi scans
// are kept under (see UnlinkPhoneData). An id made from a
// name has only letters, digits and dashes, so none starts with it.
const RemovedPhonePrefix = "removed:"

// NoteUnlink notes that device's data is to be unlinked from it (see
// UnlinkPhoneData), so a hub that stops before that is done finishes it at
// its next start (see PendingUnlinks), and a phone is not added again under
// the id meanwhile (see Unlinking). It is quick.
// A move already noted keeps its id. A device without data of a phone gets
// no note, so it never waits for one.
func (s *Store) NoteUnlink(ctx context.Context, device string) error {
	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		return err
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO phone_unlinking (device, unlinked)
		SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM route_points WHERE device = ?1)
			OR EXISTS (SELECT 1 FROM phone_scans WHERE device = ?1)
			OR EXISTS (SELECT 1 FROM app_uses WHERE device = ?1)
			OR EXISTS (SELECT 1 FROM wifi_connections WHERE device = ?1)
			OR EXISTS (SELECT 1 FROM route_deleted WHERE device = ?1)
		ON CONFLICT (device) DO NOTHING`, device, RemovedPhonePrefix+hex.EncodeToString(random))
	return err
}

// PhoneDataDevices returns the ids that have data of a phone (see
// UnlinkPhoneData), but for those of removed phones. It reads one index
// entry per id of each table, not every row.
func (s *Store) PhoneDataDevices(ctx context.Context) ([]string, error) {
	var all []string
	for _, table := range []string{"route_points", "phone_scans", "app_uses", "wifi_connections", "route_deleted"} {
		rows, err := s.db.QueryContext(ctx, fmt.Sprintf(`
			WITH RECURSIVE ids(device) AS (
				SELECT MIN(device) FROM %[1]s
				UNION ALL
				SELECT (SELECT MIN(device) FROM %[1]s WHERE device > ids.device) FROM ids WHERE ids.device IS NOT NULL
			)
			SELECT device FROM ids WHERE device IS NOT NULL`, table))
		if err != nil {
			return nil, err
		}
		err = scanRows(rows, func() error {
			var device string
			if err := rows.Scan(&device); err != nil {
				return err
			}
			if !strings.HasPrefix(device, RemovedPhonePrefix) && !slices.Contains(all, device) {
				all = append(all, device)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return all, nil
}

// Unlinking tells whether device's data is still to be unlinked from it.
func (s *Store) Unlinking(ctx context.Context, device string) (bool, error) {
	var noted bool
	err := s.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM phone_unlinking WHERE device = ?)`, device).Scan(&noted)
	return noted, err
}

// PendingUnlinks returns the devices whose data is still to be unlinked.
func (s *Store) PendingUnlinks(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT device FROM phone_unlinking ORDER BY device`)
	if err != nil {
		return nil, err
	}
	var devices []string
	err = scanRows(rows, func() error {
		var device string
		if err := rows.Scan(&device); err != nil {
			return err
		}
		devices = append(devices, device)
		return nil
	})
	return devices, err
}

// UnlinkPhoneData keeps where a phone was and the Wi-Fi networks it scanned,
// for the Wi-Fi map, but no longer as the phone's: they move to a new id of
// their own, which tells nothing of the phone, and age out with
// PHONE_RETENTION_DAYS as before. What tells who it was goes: when its apps
// were in use, which Wi-Fi it was connected to, and the stretches of its
// route the user deleted (DeleteRoute deleted the points and scans in them). A phone added later
// under the same id starts without any of it. For a device that is no phone,
// it changes nothing. A move cut short goes on under the same id when it is
// called again; once done, the note of NoteUnlink goes.
//
// It moves only what NoteUnlink noted, so a phone added again once the move
// is done keeps its own data, however late another call comes. The phone
// must no longer be kept (see DeleteRoute's listed), so no new deletion of a
// stretch of its route starts.
func (s *Store) UnlinkPhoneData(ctx context.Context, device string) error {
	// A device with nothing noted does not wait for another one's move.
	if unlinked, err := s.noted(ctx, device); err != nil || unlinked == "" {
		return err
	}
	s.unlinking.Lock()
	defer s.unlinking.Unlock()
	unlinked, err := s.noted(ctx, device)
	if err != nil || unlinked == "" {
		return err
	}
	// A deletion of a stretch of its route that is still running finishes
	// first, so none of the stretch moves. The move itself does not hold
	// placing: the Wi-Fi map would wait for all of it. The scans move first,
	// then the points: the scans left under the phone's id keep all their
	// points, and WiFiPositions leaves out the moved ones until the note
	// goes, as they would be placed at the points moved so far. In between,
	// a WiFiPositions that read the scans before they moved finishes (see
	// below).
	s.placing.Lock()
	_, err = s.db.ExecContext(ctx, `DELETE FROM route_deleted WHERE device = ?`, device)
	s.placing.Unlock()
	if err != nil {
		return err
	}
	var moved int64
	for _, t := range []struct{ table, keys, set string }{
		// Which of the networks it was connected to goes, as it tells whose
		// they were.
		// What is no array of networks stays as it is, so it cannot stop the
		// move.
		{"phone_scans", "device, time", `, networks = CASE WHEN json_valid(networks) AND json_type(networks) = 'array' THEN (
			SELECT json_group_array(CASE WHEN type = 'object' THEN json(json_remove(value, '$.connected')) ELSE value END ORDER BY key)
			FROM json_each(networks)) ELSE networks END`},
		{"route_points", "device, phone_time", ""},
	} {
		if t.table == "route_points" {
			s.waitPlacing()
		}
		n, err := s.moveChunks(ctx, t.table, t.keys, t.set, device, unlinked)
		if err != nil {
			return err
		}
		moved += n
	}
	uses, err := s.deleteChunks(ctx, "app_uses", "device, app, start", `device = ?`, device)
	if err != nil {
		return err
	}
	// The Wi-Fi map does not read them, and one over a stretch the user
	// deleted is left out only as it is read.
	connections, err := s.deleteChunks(ctx, "wifi_connections", "device, start", `device = ?`, device)
	if err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM phone_unlinking WHERE device = ?`, device); err != nil {
		return err
	}
	s.shrinkLog(ctx, moved+uses+connections)
	return nil
}

// waitPlacing waits until a WiFiPositions running, or anything else under
// placing, is done.
func (s *Store) waitPlacing() {
	s.placing.Lock()
	defer s.placing.Unlock()
}

// noted returns the id NoteUnlink noted for device's data, or "" when none is
// noted.
func (s *Store) noted(ctx context.Context, device string) (string, error) {
	var unlinked string
	err := s.db.QueryRowContext(ctx, `SELECT unlinked FROM phone_unlinking WHERE device = ?`, device).Scan(&unlinked)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return unlinked, err
}

// moveChunks gives the rows of device in table the id to instead, and sets
// what set adds (", column = ..."), in chunks as deleteChunks deletes, so
// other writes are not held up for long.
func (s *Store) moveChunks(ctx context.Context, table, keys, set, device, to string) (int64, error) {
	//nolint:gosec // table, keys and set are fixed by the caller; values go in as arguments.
	query := fmt.Sprintf(`
		UPDATE %[1]s SET device = ?%[4]s WHERE (%[2]s) IN (
			SELECT %[2]s FROM %[1]s WHERE device = ? LIMIT %[3]d
		)`, table, keys, deleteChunkRows, set)
	var total int64
	for {
		result, err := s.db.ExecContext(ctx, query, to, device)
		if err != nil {
			return total, err
		}
		moved, err := result.RowsAffected()
		if err != nil {
			return total, err
		}
		total += moved
		if moved < deleteChunkRows {
			return total, nil
		}
		// A recorder waiting to store gets its turn, as in deleteChunks.
		select {
		case <-ctx.Done():
			return total, ctx.Err()
		case <-time.After(deleteChunkPause):
		}
	}
}
