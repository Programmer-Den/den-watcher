package history

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
)

// RemovedPhonePrefix starts the id a removed phone's route, Wi-Fi scans and
// Wi-Fi connections are kept under (see UnlinkPhoneData). An id made from a
// name has only letters, digits and dashes, so none starts with it.
const RemovedPhonePrefix = "removed:"

// IsRemovedPhone tells whether device is the id of a removed phone's data.
func IsRemovedPhone(device string) bool {
	return strings.HasPrefix(device, RemovedPhonePrefix)
}

// UnlinkPhoneData keeps where a phone was and the Wi-Fi networks it scanned
// and was connected to, for the Wi-Fi map, but no longer as the phone's: they
// move to a new id of their own, which tells nothing of the phone, and age
// out with PHONE_RETENTION_DAYS as before. What tells who it was goes: when
// its apps were in use, and the stretches of its route the user deleted, as
// what they would leave out never comes under the new id. A phone added later
// under the same id starts without any of it. For a device that is no phone,
// it changes nothing.
func (s *Store) UnlinkPhoneData(ctx context.Context, device string) error {
	random := make([]byte, 8)
	if _, err := rand.Read(random); err != nil {
		return err
	}
	unlinked := RemovedPhonePrefix + hex.EncodeToString(random)
	var moved int64
	for _, t := range []struct{ table, keys string }{
		{"route_points", "device, phone_time"},
		{"phone_scans", "device, time"},
		{"wifi_connections", "device, start"},
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
	if _, err := s.db.ExecContext(ctx, `DELETE FROM route_deleted WHERE device = ?`, device); err != nil {
		return err
	}
	s.shrinkLog(ctx, moved+uses)
	return nil
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
		if err := ctx.Err(); err != nil {
			return total, err
		}
	}
}
