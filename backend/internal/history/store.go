// Package history keeps the usage of the machine over time in a SQLite
// database and deletes what is older than the retention period.
package history

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	// Registers the pure-Go SQLite driver, so the binary needs no C library.
	_ "modernc.org/sqlite"
)

// LocalDevice is the device name the machine stores its own samples under.
// In hub mode, samples collected from other machines get their own names.
const LocalDevice = "local"

// schema keeps the history: history_minutes (see packedSchema) has the
// values of every minute, and samples_hourly the average of each hour's
// values per metric, and how many it is over, so ranges with steps of an hour
// and more read 60 times fewer rows. Add keeps both up to date. Databases
// from before version 3 had the minutes in samples, one row per value;
// convertSamples moves them, and the migration to version 2 filled
// samples_hourly for databases from before it.
const schema = packedSchema + `
CREATE TABLE IF NOT EXISTS samples_hourly (
	device TEXT    NOT NULL,
	time   INTEGER NOT NULL, -- Unix time in seconds, the start of the hour
	metric TEXT    NOT NULL,
	value  REAL    NOT NULL, -- the average of the hour's values so far
	count  INTEGER NOT NULL, -- how many values the average is over
	PRIMARY KEY (device, time, metric)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS samples_hourly_by_time ON samples_hourly (time);
`

// Store is the database the history is kept in.
type Store struct {
	db *sql.DB
	// path is the database's file, next to which Backup makes its copies.
	path  string
	cache rangeCache
	ids   *metricIDs
	// flushEvery is how long minutes wait in pend before they are written,
	// or zero to write them at once.
	flushEvery time.Duration
	pend       pending
	// flushing lets one Flush run at a time, and keeps DeleteDevice from
	// running along with one.
	flushing sync.Mutex
	// brokenInfo has a brokenInfoKey for each description of an extra that
	// could not be read and was logged.
	brokenInfo sync.Map
	// wifi is what the devices' Wi-Fi saw that is not written yet (see
	// AddWiFi).
	wifi wifiPending
}

// Series is the values of one metric over time.
type Series struct {
	Metric string  `json:"metric"`
	Points []Point `json:"points"`
}

// Point is the average of a metric over one step, starting at Time.
type Point struct {
	Time  int64   `json:"time"`
	Value float64 `json:"value"`
}

// Open opens the database at path, creating it when it does not exist yet.
func Open(ctx context.Context, path string) (*Store, error) {
	db, err := openDB(path)
	if err != nil {
		return nil, err
	}
	if err := migrate(ctx, db, path, migrations); err != nil {
		_ = db.Close()
		return nil, err
	}
	if _, err := db.ExecContext(ctx, schema+extraSchema+wifiSchema); err != nil {
		_ = db.Close()
		return nil, err
	}
	removeBackups(path)
	store := &Store{db: db, path: path, cache: newRangeCache(), ids: newMetricIDs(), pend: newPending()}
	if err := store.convertSamples(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

// uriPath escapes the characters of a file path that a SQLite URI reads as
// the start of its query or fragment, or as an escape.
var uriPath = strings.NewReplacer("%", "%25", "?", "%3f", "#", "%23")

// openDB opens the SQLite file at path, which is created once something is
// written to it.
func openDB(path string) (*sql.DB, error) {
	// WAL lets the page read while the recorder writes; the busy timeout waits
	// for a write in progress instead of failing.
	// The path is escaped, as "?", "#" and "%" mean something in the URI.
	dsn := "file:" + uriPath.Replace(path) + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// A few connections are enough for the recorders and the page; each one
	// keeps its own page cache, and an idle one gives its memory back.
	db.SetMaxOpenConns(4)
	db.SetConnMaxIdleTime(time.Minute)
	return db, nil
}

// Close writes the minutes that wait and closes the database.
func (s *Store) Close() error {
	err := s.Flush(context.Background())
	return errors.Join(err, s.db.Close())
}

// Add stores the values of one device measured at one time, and counts them
// into the averages of their hour. Each time is stored once: a value for a
// time and metric that is stored already is left out, so it neither replaces
// the stored one nor counts twice in the hour.
func (s *Store) Add(ctx context.Context, device string, at time.Time, values map[string]float64) error {
	return s.AddMinutes(ctx, device, []Minute{{Time: at.Unix(), Values: values}})
}

// AddMinutes stores several minutes of one device in one go, as Add does
// each, as when a hub fetches what a device kept while it could not reach it.
// With a flush interval (see SetFlushInterval) they wait in memory until the
// next Flush; reads see them meanwhile.
func (s *Store) AddMinutes(ctx context.Context, device string, minutes []Minute) error {
	if s.flushEvery <= 0 {
		return s.write(ctx, map[string][]Minute{device: minutes})
	}
	if s.pend.add(device, minutes) > maxPendingMinutes {
		return s.Flush(ctx)
	}
	return nil
}

// Range returns the values of one device from from up to (not including) to,
// averaged over steps of the given length so a long range stays small.
// Series are sorted by metric and points by time.
//
// Steps of an hour and more are whole hours (see stepFor) and come from the
// hourly averages, each weighted by how many values it is over: the same
// averages as from the values themselves, from 60 times fewer rows. They
// include the whole step from falls in.
func (s *Store) Range(ctx context.Context, device string, from, to time.Time, step time.Duration) ([]Series, error) {
	stepSeconds := max(1, int64(step/time.Second))
	if step < time.Hour {
		return s.rangeMinutes(ctx, device, from.Unix(), to.Unix(), stepSeconds)
	}
	// From the start of the step from falls in: its hours are stored at their
	// start, before from, and would be left out, and the step would depend on
	// the hour from is in, which the cache does not.
	start := from.Unix() / stepSeconds * stepSeconds
	rows, err := s.db.QueryContext(ctx, `
		SELECT metric, time / ?1 * ?1 AS bucket, SUM(value * count) / SUM(count)
		FROM samples_hourly
		WHERE device = ?2 AND time >= ?3 AND time < ?4
		GROUP BY metric, bucket
		ORDER BY metric, bucket`, stepSeconds, device, start, to.Unix())
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	series := []Series{}
	for rows.Next() {
		var metric string
		var point Point
		if err := rows.Scan(&metric, &point.Time, &point.Value); err != nil {
			return nil, err
		}
		if len(series) == 0 || series[len(series)-1].Metric != metric {
			series = append(series, Series{Metric: metric})
		}
		last := &series[len(series)-1]
		last.Points = append(last.Points, point)
	}
	return series, rows.Err()
}

// Newest returns the time of the newest stored minute of one device, or false
// when there is none. The primary key starts with device and time, so this
// reads a single row.
func (s *Store) Newest(ctx context.Context, device string) (time.Time, bool, error) {
	var newest sql.NullInt64
	err := s.db.QueryRowContext(ctx, `SELECT MAX(time) FROM history_minutes WHERE device = ?`, device).Scan(&newest)
	if err != nil {
		return time.Time{}, false, err
	}
	at, waiting := s.pend.newest(device)
	if !newest.Valid && !waiting {
		return time.Time{}, false, nil
	}
	return time.Unix(max(newest.Int64, at), 0), true, nil
}

// cachedRange is Range, but answers with the previous answer while that is
// at most cacheFor old and covers the same steps (see rangeCache), so the
// viewers of a long range share one query.
func (s *Store) cachedRange(ctx context.Context, device string, from, to time.Time, step time.Duration) ([]Series, error) {
	series, ok, forgotten := s.cache.get(device, from, to, step)
	if ok {
		return series, nil
	}
	series, err := s.Range(ctx, device, from, to, step)
	if err != nil {
		return nil, err
	}
	s.cache.put(device, from, to, step, series, forgotten)
	return series, nil
}

// DeleteBefore deletes every minute stored before t and returns how many
// were deleted. The hour t falls in keeps its average, as it still has values.
// The descriptions of extras without values left go too. The values are
// deleted in chunks (see deleteChunks), so the first prune after a long
// downtime, or after RETENTION_DAYS was lowered, does not keep the recorders
// from storing meanwhile.
func (s *Store) DeleteBefore(ctx context.Context, t time.Time) (int64, error) {
	// After a flush that is writing its minutes, which would bring old ones
	// back after they were deleted.
	s.flushing.Lock()
	s.pend.dropBefore(t.Unix())
	s.flushing.Unlock()
	// The primary key starts with the device, so each device's old minutes
	// are one range of it; a time alone would read all of them.
	devices, err := s.devices(ctx)
	if err != nil {
		return 0, err
	}
	var deleted int64
	for _, device := range devices {
		n, err := s.deleteChunks(ctx, "history_minutes", "device, time", `device = ? AND time < ?`, device, t.Unix())
		deleted += n
		if err != nil {
			return deleted, err
		}
	}
	hourly, err := s.deleteChunks(ctx, "samples_hourly", "device, time, metric", `time < ?`, t.Truncate(time.Hour).Unix())
	if err != nil {
		return deleted, err
	}
	if err := s.deleteUnusedExtraInfo(ctx, t); err != nil {
		return deleted, err
	}
	wifi, err := s.deleteChunks(ctx, "wifi_hours", "device, time, ap", `time < ?`, t.Truncate(time.Hour).Unix())
	if err != nil {
		return deleted, err
	}
	scans, err := s.deleteChunks(ctx, "wifi_scans", "device, time", `time < ?`, t.Truncate(time.Hour).Unix())
	if err != nil {
		return deleted, err
	}
	s.shrinkLog(ctx, deleted+hourly+wifi+scans)
	return deleted, nil
}

// DeleteDevice deletes every value of one device, and how its extras are
// described, in chunks as DeleteBefore does.
func (s *Store) DeleteDevice(ctx context.Context, device string) error {
	// After a flush that is writing its minutes, which would bring them back.
	s.flushing.Lock()
	s.pend.forget(device)
	s.flushing.Unlock()
	s.cache.forget(device)
	deleted, err := s.deleteChunks(ctx, "history_minutes", "device, time", `device = ?`, device)
	if err != nil {
		return err
	}
	hourly, err := s.deleteChunks(ctx, "samples_hourly", "device, time, metric", `device = ?`, device)
	if err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM extra_info WHERE device = ?`, device); err != nil {
		return err
	}
	s.wifi.forget(device)
	wifi, err := s.deleteChunks(ctx, "wifi_hours", "device, time, ap", `device = ?`, device)
	if err != nil {
		return err
	}
	scans, err := s.deleteChunks(ctx, "wifi_scans", "device, time", `device = ?`, device)
	if err != nil {
		return err
	}
	s.brokenInfo.Range(func(key, _ any) bool {
		if key.(brokenInfoKey).device == device {
			s.brokenInfo.Delete(key)
		}
		return true
	})
	// Again, so a range read while the values were deleted, which may have
	// some of them, is not kept (see rangeCache.put).
	s.cache.forget(device)
	s.shrinkLog(ctx, deleted+hourly+wifi+scans)
	return nil
}

const (
	// deleteChunkRows is how many rows deleteChunks deletes per transaction:
	// a fraction of a second on a Raspberry Pi.
	deleteChunkRows = 5000
	// deleteChunkPause is how long deleteChunks waits between two chunks, so
	// a recorder waiting to store (see the busy timeout in openDB) gets its
	// turn.
	deleteChunkPause = 50 * time.Millisecond
)

// devices returns the devices that have minutes: one lookup of the primary
// key per device, where DISTINCT would read every minute.
func (s *Store) devices(ctx context.Context) ([]string, error) {
	var devices []string
	query, args := `SELECT MIN(device) FROM history_minutes`, []any{}
	for {
		var device sql.NullString
		if err := s.db.QueryRowContext(ctx, query, args...).Scan(&device); err != nil {
			return nil, err
		}
		if !device.Valid {
			return devices, nil
		}
		devices = append(devices, device.String)
		query, args = `SELECT MIN(device) FROM history_minutes WHERE device > ?`, []any{device.String}
	}
}

// deleteChunks deletes the rows of table, such as history_minutes or
// samples_hourly, whose primary key is keys, that match where, deleteChunkRows at a time, each chunk in a transaction of its
// own, and returns how many it deleted. One DELETE of millions of rows would
// hold the database's write lock for minutes, so storing would fail
// meanwhile, and grow the write-ahead log by as much as it deletes.
func (s *Store) deleteChunks(ctx context.Context, table, keys, where string, args ...any) (int64, error) {
	// Each chunk looks its rows up by where and deletes them by primary key.
	//nolint:gosec // table, keys and where are fixed by the callers; values go in as arguments.
	query := fmt.Sprintf(`
		DELETE FROM %[1]s WHERE (%[4]s) IN (
			SELECT %[4]s FROM %[1]s WHERE %[2]s LIMIT %[3]d
		)`, table, where, deleteChunkRows, keys)
	var total int64
	for {
		result, err := s.db.ExecContext(ctx, query, args...)
		if err != nil {
			return total, err
		}
		deleted, err := result.RowsAffected()
		if err != nil {
			return total, err
		}
		total += deleted
		if deleted < deleteChunkRows {
			return total, nil
		}
		select {
		case <-ctx.Done():
			return total, ctx.Err()
		case <-time.After(deleteChunkPause):
		}
	}
}

// shrinkLog gives the space of the write-ahead log back after more than a
// chunk was deleted. The log is reused once its changes are in the database
// file, but keeps the largest size it had.
func (s *Store) shrinkLog(ctx context.Context, deleted int64) {
	if deleted <= deleteChunkRows {
		return
	}
	if _, err := s.db.ExecContext(ctx, `PRAGMA wal_checkpoint(TRUNCATE)`); err != nil {
		slog.Warn("shrink the database's write-ahead log", "error", err)
	}
}

// DB returns the database, so other packages can keep their own tables in
// the same file.
func (s *Store) DB() *sql.DB {
	return s.db
}
