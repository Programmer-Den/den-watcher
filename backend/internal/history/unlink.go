package history

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
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
func (s *Store) NoteUnlink(ctx context.Context, device string) error {
	_, err := s.unlinkedID(ctx, device)
	return err
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
// The phone must no longer be kept (see DeleteRoute's listed), so no new
// deletion of a stretch of its route starts.
func (s *Store) UnlinkPhoneData(ctx context.Context, device string) error {
	// A deletion of a stretch of its route that is still running finishes
	// first, so none of the stretch moves. The move itself does not hold
	// placing: the Wi-Fi map would wait for all of it. While it runs, the map
	// may find some of the phone's scans without their points for a moment.
	s.placing.Lock()
	_, err := s.db.ExecContext(ctx, `DELETE FROM route_deleted WHERE device = ?`, device)
	s.placing.Unlock()
	if err != nil {
		return err
	}
	unlinked, err := s.unlinkedID(ctx, device)
	if err != nil {
		return err
	}
	var moved int64
	for _, t := range []struct{ table, keys string }{
		{"route_points", "device, phone_time"},
		{"phone_scans", "device, time"},
	} {
		n, err := s.moveChunks(ctx, t.table, t.keys, device, unlinked)
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

// unlinkedID returns the id device's data moves to: the one a move cut short
// was giving it, or a new one made at random.
func (s *Store) unlinkedID(ctx context.Context, device string) (string, error) {
	var unlinked string
	err := s.db.QueryRowContext(ctx, `SELECT unlinked FROM phone_unlinking WHERE device = ?`, device).Scan(&unlinked)
	if err == nil {
		return unlinked, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	unlinked = RemovedPhonePrefix + hex.EncodeToString(random)
	if _, err := s.db.ExecContext(ctx, `INSERT INTO phone_unlinking (device, unlinked) VALUES (?, ?)`, device, unlinked); err != nil {
		return "", err
	}
	return unlinked, nil
}

// moveChunks gives the rows of device in table the id to instead, in chunks
// as deleteChunks deletes, so other writes are not held up for long.
func (s *Store) moveChunks(ctx context.Context, table, keys, device, to string) (int64, error) {
	//nolint:gosec // table and keys are fixed by the caller; values go in as arguments.
	query := fmt.Sprintf(`
		UPDATE %[1]s SET device = ? WHERE (%[2]s) IN (
			SELECT %[2]s FROM %[1]s WHERE device = ? LIMIT %[3]d
		)`, table, keys, deleteChunkRows)
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
