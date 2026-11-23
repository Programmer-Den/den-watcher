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
// and more read 60 times fewer rows. samples_daily has the same for each day,
// and is not deleted with the retention, so the history reaches back years at
// one row per day and metric. Add keeps all three up to date. Databases
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

// dailySchema is samples_daily (see schema). Open creates it along with
// dailyBackfill in one transaction, so a backfill cut short is done again at
// the next start.
const dailySchema = `
CREATE TABLE IF NOT EXISTS samples_daily (
	device TEXT    NOT NULL,
	time   INTEGER NOT NULL, -- Unix time in seconds, the start of the day in UTC
	metric TEXT    NOT NULL,
	value  REAL    NOT NULL, -- the average of the day's values so far
	count  INTEGER NOT NULL, -- how many values the average is over
	PRIMARY KEY (device, time, metric)
) WITHOUT ROWID;
`

// dailyBackfill fills samples_daily from the hourly averages kept so far,
// once, when the table is new. A variable, so a test can make it fail.
var dailyBackfill = `
INSERT OR IGNORE INTO samples_daily (device, time, metric, value, count)
SELECT device, time / 86400 * 86400, metric, SUM(value * count) / SUM(count), SUM(count)
FROM samples_hourly
GROUP BY device, time / 86400 * 86400, metric`

// Day is the step of the daily averages, which are kept for good, past the
// retention: ranges that reach back further than it are read from them.
const Day = 24 * time.Hour

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
	// placing lets one WiFiPositions keep new places at a time.
	placing sync.Mutex
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
	var hadDaily int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'samples_daily'`).Scan(&hadDaily); err != nil {
		_ = db.Close()
		return nil, err
	}
	if _, err := db.ExecContext(ctx, schema+extraSchema+wifiSchema+appUseSchema+wifiConnectionSchema+routeSchema+phoneScanSchema+positionPlaceSchema); err != nil {
		_ = db.Close()
		return nil, err
	}
	removeBackups(path)
	store := &Store{db: db, path: path, cache: newRangeCache(), ids: newMetricIDs(), pend: newPending()}
	if err := store.convertSamples(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	if hadDaily == 0 {
		if err := store.createDaily(ctx); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("fill the daily averages: %w", err)
		}
	}
	return store, nil
}

// createDaily creates samples_daily and fills it from the hourly averages, in
// one transaction.
func (s *Store) createDaily(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, dailySchema); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, dailyBackfill); err != nil {
		return err
	}
	return tx.Commit()
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
// averages as from the values themselves, from 60 times fewer rows. Steps of
// whole days come from the daily averages the same way, which are kept past
// the retention.
//
// Every step includes the whole step from falls in: the hours of a step of
// hours are stored at their start, before from, and would be left out, and
// the first step would depend on where in it from is, which the cache does
// not (see rangeCache).
func (s *Store) Range(ctx context.Context, device string, from, to time.Time, step time.Duration) ([]Series, error) {
	stepSeconds := max(1, int64(step/time.Second))
	start := from.Unix() / stepSeconds * stepSeconds
	if step < time.Hour {
		return s.rangeMinutes(ctx, device, start, to.Unix(), stepSeconds)
	}
	table := "samples_hourly"
	if stepSeconds%int64(Day/time.Second) == 0 {
		table = "samples_daily"
	}
	// table is one of the two names above.
	rows, err := s.db.QueryContext(ctx, `
		SELECT metric, time / ?1 * ?1 AS bucket, SUM(value * count) / SUM(count)
		FROM `+table+`
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
// were deleted. Where the phones were and their Wi-Fi have a retention of
// their own; see DeletePhoneDataBefore. The hour t falls in keeps its
// average, as it still has values. The daily averages stay, for good.
// The descriptions of extras without values left go too. The values are
// deleted in chunks (see deleteChunks), so the first prune after a long
// downtime, or after RETENTION_DAYS was lowered, does not keep the recorders
// from storing meanwhile.
func (s *Store) DeleteBefore(ctx context.Context, t time.Time) (int64, error) {
	// After a flush that is writing its minutes, which would bring old ones
	// back after they were deleted.
	s.flushing.Lock()
	s.pend.dropBefore(t.Unix())
	s.wifi.dropBefore(t.Truncate(time.Hour).Unix())
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
	uses, err := s.deleteChunks(ctx, "app_uses", "device, app, start", `time < ?`, t.UnixMilli())
	if err != nil {
		return deleted, err
	}
	s.shrinkLog(ctx, deleted+hourly+wifi+scans+uses)
	return deleted, nil
}

// DeletePhoneDataBefore deletes where the phones were and the Wi-Fi they were
// on and scanned before t, which have a retention of their own
// (PHONE_RETENTION_DAYS, for good by default), in chunks as DeleteBefore
// does, and the places of the scans the user told nothing of whose newest
// scan is older. It returns how many rows were deleted.
func (s *Store) DeletePhoneDataBefore(ctx context.Context, t time.Time) (int64, error) {
	connections, err := s.deleteChunks(ctx, "wifi_connections", "device, start", `end_time < ?`, t.UnixMilli())
	if err != nil {
		return connections, err
	}
	route, err := s.deleteChunks(ctx, "route_points", "device, phone_time", `time < ?`, t.UnixMilli())
	if err != nil {
		return connections + route, err
	}
	phoneScans, err := s.deleteChunks(ctx, "phone_scans", "device, time", `time < ?`, t.Unix())
	if err != nil {
		return connections + route + phoneScans, err
	}
	places, err := s.deleteOldPositionPlaces(ctx, t)
	deleted := connections + route + phoneScans + places
	if err != nil {
		return deleted, err
	}
	s.shrinkLog(ctx, deleted)
	return deleted, nil
}

// DeleteRoute deletes where a phone was from from up to (not including) to,
// and what tells the same: the scans of the Wi-Fi networks it made then, the
// Wi-Fi connections that started then and the places of the Wi-Fi map the
// user told nothing of, as when the user takes a day of its route away. The
// hub remembers the stretch, so what the phone sends of it later, which it
// had not sent yet, is left out too. It returns how many points of the route
// were deleted.
func (s *Store) DeleteRoute(ctx context.Context, device string, from, to time.Time) (_ int64, err error) {
	// Only what was recorded up to now is left out later: what the phone
	// records from now on is new, even within the stretch. The slack covers
	// a phone's clock a little ahead, whose points the hub takes too.
	// Held throughout, so a look at the Wi-Fi map does not start places
	// again from scans read before they were deleted (see WiFiPositions), and
	// two deletions, or one and DeleteDevice, do not mix their stretches.
	s.placing.Lock()
	defer s.placing.Unlock()
	end := to
	if until := time.Now().Add(deletedRouteSlack); end.After(until) {
		end = until
	}
	if end.After(from) {
		// err is the named result, which the deferred cleanup reads.
		var result sql.Result
		result, err = s.db.ExecContext(ctx, `INSERT OR IGNORE INTO route_deleted (device, start_time, end_time) VALUES (?, ?, ?)`,
			device, from.UnixMilli(), end.UnixMilli())
		if err != nil {
			return 0, err
		}
		// When the deletion fails, the stretch is not remembered either, so
		// what the phone sends of it later is not lost next to what is left.
		if added, _ := result.RowsAffected(); added > 0 {
			defer func() {
				if err != nil {
					_, _ = s.db.ExecContext(context.WithoutCancel(ctx), `DELETE FROM route_deleted WHERE device = ? AND start_time = ? AND end_time = ?`,
						device, from.UnixMilli(), end.UnixMilli())
				}
			}()
		}
	}
	// A scan is placed at a point up to positionBefore before it or
	// positionAfter after it, so those points can have started a place too.
	points, err := s.routePointsAll(ctx, device, from.Add(-positionBefore), to.Add(positionAfter))
	if err != nil {
		return 0, err
	}
	route, err := s.deleteChunks(ctx, "route_points", "device, phone_time", `device = ? AND time >= ? AND time < ?`, device, from.UnixMilli(), to.UnixMilli())
	if err != nil {
		return route, err
	}
	scans, err := s.deleteChunks(ctx, "phone_scans", "device, time", `device = ? AND time >= ? AND time < ?`, device, from.Unix(), to.Unix())
	if err != nil {
		return route, err
	}
	connections, err := s.cutWiFiConnections(ctx, device, from, to)
	if err != nil {
		return route, err
	}
	places, err := s.deletePositionPlacesNear(ctx, points)
	if err != nil {
		return route, err
	}
	s.shrinkLog(ctx, route+scans+connections+places)
	return route, nil
}

// deletedRouteSlack is how far past now a deleted stretch reaches, as the hub
// takes a phone's points up to 10 seconds in the future (hub.maxClockJitter).
const deletedRouteSlack = 10 * time.Second

// cutWiFiConnections takes the stretch from from up to to out of the Wi-Fi
// connections of the phone stored as device: one within it is deleted, one
// that started in it starts at its end, and one that ends in it ends at its
// start. One over the whole stretch is kept, and WiFiConnections leaves the
// stretch out of it, as of one the phone sends again with a later end. It
// returns how many were deleted.
func (s *Store) cutWiFiConnections(ctx context.Context, device string, from, to time.Time) (int64, error) {
	var deleted int64
	err := s.inTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE wifi_connections SET end_time = ?2 WHERE device = ?1 AND time < ?2 AND end_time > ?2 AND end_time <= ?3`,
			device, from.UnixMilli(), to.UnixMilli()); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE wifi_connections SET time = ?3 WHERE device = ?1 AND time >= ?2 AND time < ?3 AND end_time > ?3`,
			device, from.UnixMilli(), to.UnixMilli()); err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, `DELETE FROM wifi_connections WHERE device = ? AND time >= ? AND time < ?`,
			device, from.UnixMilli(), to.UnixMilli())
		if err != nil {
			return err
		}
		deleted, err = result.RowsAffected()
		return err
	})
	return deleted, err
}

// routePointsAll returns where the phone stored as device was from from up to
// (not including) to, each place once: the points precise enough to place a
// scan (PositionMaxAccuracy), as only they started places.
func (s *Store) routePointsAll(ctx context.Context, device string, from, to time.Time) ([]PhonePoint, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT lat, lon FROM route_points
		WHERE device = ? AND time >= ? AND time < ? AND accuracy <= ?`, device, from.UnixMilli(), to.UnixMilli(), PositionMaxAccuracy)
	if err != nil {
		return nil, err
	}
	var points []PhonePoint
	err = scanRows(rows, func() error {
		var p PhonePoint
		if err := rows.Scan(&p.Lat, &p.Lon); err != nil {
			return err
		}
		points = append(points, p)
		return nil
	})
	return points, err
}

// DeletedRouteIn tells whether at falls into one of stretches, as
// DeletedStretches returns them.
func DeletedRouteIn(stretches [][2]int64, at time.Time) bool {
	ms := at.UnixMilli()
	for _, stretch := range stretches {
		if ms >= stretch[0] && ms < stretch[1] {
			return true
		}
	}
	return false
}

// DeleteDevice deletes every value of one device, and how its extras are
// described, in chunks as DeleteBefore does.
func (s *Store) DeleteDevice(ctx context.Context, device string) error {
	// After a flush that is writing its minutes and Wi-Fi sums, which would
	// bring them back, and before the next one can take them.
	s.flushing.Lock()
	s.pend.forget(device)
	s.wifi.forget(device)
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
	daily, err := s.deleteChunks(ctx, "samples_daily", "device, time, metric", `device = ?`, device)
	if err != nil {
		return err
	}
	hourly += daily
	if _, err := s.db.ExecContext(ctx, `DELETE FROM extra_info WHERE device = ?`, device); err != nil {
		return err
	}
	wifi, err := s.deleteChunks(ctx, "wifi_hours", "device, time, ap", `device = ?`, device)
	if err != nil {
		return err
	}
	scans, err := s.deleteChunks(ctx, "wifi_scans", "device, time", `device = ?`, device)
	if err != nil {
		return err
	}
	uses, err := s.deleteChunks(ctx, "app_uses", "device, app, start", `device = ?`, device)
	if err != nil {
		return err
	}
	connections, err := s.deleteChunks(ctx, "wifi_connections", "device, start", `device = ?`, device)
	if err != nil {
		return err
	}
	route, err := s.deleteChunks(ctx, "route_points", "device, phone_time", `device = ?`, device)
	if err != nil {
		return err
	}
	phoneScans, err := s.deleteChunks(ctx, "phone_scans", "device, time", `device = ?`, device)
	if err != nil {
		return err
	}
	s.placing.Lock()
	_, err = s.db.ExecContext(ctx, `DELETE FROM route_deleted WHERE device = ?`, device)
	s.placing.Unlock()
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
	s.shrinkLog(ctx, deleted+hourly+wifi+scans+uses+connections+route+phoneScans)
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

// Checkpoint writes what the write-ahead log of the database at path holds
// into the database file itself and closes it, so the file alone is the
// whole database and can be renamed on its own. It leaves the database out
// of WAL, which the next Open sets again, and fails when another program
// has the database open.
func Checkpoint(ctx context.Context, path string) error {
	db, err := openDB(path)
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(1)
	// Leaving WAL writes the log into the database and deletes it, and
	// needs the database to itself: SQLite stays in WAL while another
	// connection, even an idle one, has it open.
	var mode string
	err = db.QueryRowContext(ctx, "PRAGMA journal_mode=DELETE").Scan(&mode)
	if err == nil && !strings.EqualFold(mode, "delete") {
		err = fmt.Errorf("another program has %s open, so its log could not be written into it", path)
	}
	return errors.Join(err, db.Close())
}
