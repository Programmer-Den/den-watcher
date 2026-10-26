// Package alerts watches the usage of every device the site shows for values
// that need attention, such as a disk that is almost full or a server that
// does not answer, and keeps a log of them. The page shows the ones that are
// active as red icons; nothing is sent anywhere.
package alerts

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// Level is how serious an alert is.
type Level string

// The levels an alert can have.
const (
	// Warning is a value to keep an eye on, such as a disk 90 % full.
	Warning Level = "warning"
	// Critical needs action, such as a disk 95 % full or a server that does
	// not answer.
	Critical Level = "alert"
)

// rank orders the levels, so a warning can rise to an alert.
func (l Level) rank() int {
	if l == Critical {
		return 2
	}
	return 1
}

// Kind is what an alert is about.
type Kind string

// The kinds of alerts.
const (
	KindOffline     Kind = "offline"
	KindDisk        Kind = "disk"
	KindMemory      Kind = "memory"
	KindCPU         Kind = "cpu"
	KindTemperature Kind = "temperature"
	KindThrottling  Kind = "throttling"
	KindSMART       Kind = "smart"
	// KindWiFiLookalike is a network nearby named like the one the device
	// is connected to but secured otherwise; its subject is that name.
	KindWiFiLookalike Kind = "wifi-lookalike"
)

// Alert is a value that needed attention, while it lasts or from the log.
type Alert struct {
	ID         int64  `json:"id"`
	Device     string `json:"device"`
	DeviceName string `json:"deviceName"`
	Kind       Kind   `json:"kind"`
	// Subject names what in the device it is about, such as the disk "/" or
	// the sensor "cpu_thermal"; empty for the device as a whole.
	Subject string `json:"subject,omitempty"`
	// Level is the highest the alert reached.
	Level Level `json:"level"`
	// Value is the highest value it reached, in the unit of its kind: percent,
	// or °C for a temperature; none for the kinds without a value.
	Value   *float64   `json:"value,omitempty"`
	Started time.Time  `json:"started"`
	Ended   *time.Time `json:"ended,omitempty"`
}

// deviceOf returns the device of a key.
func deviceOf(key string) string {
	device, _, _ := strings.Cut(key, "\x00")
	return device
}

// key tells alerts apart: one per device, kind and subject at a time.
func (a Alert) key() string {
	return a.Device + "\x00" + string(a.Kind) + "\x00" + a.Subject
}

// Target is a device the watcher checks.
type Target struct {
	ID   string
	Name string
	// PC is set for a PC or laptop, which is switched off when it is not
	// used, so its time without an answer is no outage.
	PC bool
	// Unreachable is set while the device does not answer, since
	// UnreachableSince when that is known.
	Unreachable      bool
	UnreachableSince time.Time
	// Usage reads its newest usage.
	Usage metrics.Source
}

const schema = `
CREATE TABLE IF NOT EXISTS alerts (
	id          INTEGER PRIMARY KEY,
	device      TEXT    NOT NULL,
	device_name TEXT    NOT NULL,
	kind        TEXT    NOT NULL,
	subject     TEXT    NOT NULL,
	level       TEXT    NOT NULL,
	value       REAL,
	started     INTEGER NOT NULL, -- Unix time in milliseconds
	ended       INTEGER           -- NULL while it lasts
);
CREATE INDEX IF NOT EXISTS alerts_by_started ON alerts (started);
`

const (
	// Interval is how often the devices are checked.
	Interval = 15 * time.Second
	// LogLimit is how many alerts the log returns at most.
	LogLimit = 200
	// pruneInterval is how often alerts older than the retention are deleted.
	pruneInterval = time.Hour
)

// Watcher checks the devices every Interval and keeps the alerts in the
// database.
type Watcher struct {
	db        *sql.DB
	devices   func() []Target
	retention time.Duration

	mu     sync.Mutex
	active map[string]*Alert
	// pending is when a condition that must last a while before it is an
	// alert was first seen, by key.
	pending map[string]time.Time
	// forgotten has, for each device Forget deleted, what forgets was then.
	// forgets counts the calls to Forget.
	forgotten map[string]uint64
	forgets   uint64
}

// Open prepares the alerts table in db and takes up the alerts that were
// active when the program last stopped. devices lists the devices to check;
// alerts that ended more than retention ago are deleted.
func Open(ctx context.Context, db *sql.DB, devices func() []Target, retention time.Duration) (*Watcher, error) {
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return nil, fmt.Errorf("create the alerts table: %w", err)
	}
	w := &Watcher{db: db, devices: devices, retention: retention, active: map[string]*Alert{}, pending: map[string]time.Time{}, forgotten: map[string]uint64{}}
	open, err := w.query(ctx, selectAlerts+` WHERE ended IS NULL`)
	if err != nil {
		return nil, err
	}
	for i := range open {
		w.active[open[i].key()] = &open[i]
	}
	return w, nil
}

// Run checks the devices until ctx is done.
func (w *Watcher) Run(ctx context.Context) {
	check := time.NewTicker(Interval)
	defer check.Stop()
	prune := time.NewTicker(pruneInterval)
	defer prune.Stop()
	w.prune(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-check.C:
			w.Check(ctx, time.Now())
		case <-prune.C:
			w.prune(ctx)
		}
	}
}

// Check looks at every device once, starts the alerts whose conditions are
// met and ends the ones whose conditions are gone.
func (w *Watcher) Check(ctx context.Context, now time.Time) {
	w.mu.Lock()
	levels := map[string]Level{}
	for key, a := range w.active {
		levels[key] = a.Level
	}
	forgets := w.forgets
	w.mu.Unlock()
	seen := map[string]Alert{}
	unknown := map[string]bool{}
	// unread are the devices that answer but whose usage could not be read.
	unread := map[string]bool{}
	for _, target := range w.devices() {
		list, known := conditions(ctx, target, now, levels)
		unread[target.ID] = !known && !target.Unreachable
		if !known {
			unknown[target.ID] = true
		}
		for _, c := range list {
			seen[c.key()] = c
		}
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	// A device forgotten since the devices were listed was listed before it
	// was removed: no alert of it starts again. One forgotten before was
	// added again.
	for device, at := range w.forgotten {
		if at > forgets {
			maps.DeleteFunc(seen, func(key string, _ Alert) bool { return deviceOf(key) == device })
		} else if _, listed := unread[device]; listed {
			delete(w.forgotten, device)
		}
	}
	// The alerts of a device whose usage could not be read for a moment, or
	// of a server that does not answer, last on. Only a device that answers
	// keeps the conditions it was waiting on: a hold counts only while it
	// is seen.
	for key, a := range w.active {
		if unknown[a.Device] {
			seen[key] = *a
		}
	}
	for key := range w.pending {
		if _, ok := seen[key]; !ok && !unread[deviceOf(key)] {
			delete(w.pending, key)
		}
	}
	for key, c := range seen {
		if a := w.active[key]; a != nil {
			w.raise(ctx, a, c)
			continue
		}
		if hold := holdFor(c.Kind); hold > 0 {
			first, ok := w.pending[key]
			if !ok {
				w.pending[key] = now
				continue
			}
			if now.Sub(first) < hold {
				continue
			}
			c.Started = first
		} else if c.Started.IsZero() {
			c.Started = now
		}
		delete(w.pending, key)
		w.start(ctx, c)
	}
	for key, a := range w.active {
		if _, ok := seen[key]; !ok && w.end(ctx, a, now) {
			delete(w.active, key)
		}
	}
}

// holdFor is how long a condition must last before it is an alert, so a
// short peak, which is normal, is none.
func holdFor(kind Kind) time.Duration {
	switch kind {
	case KindCPU:
		return 5 * time.Minute
	case KindMemory:
		return 2 * time.Minute
	case KindTemperature:
		return time.Minute
	}
	return 0
}

// start keeps a new alert. The caller holds mu.
func (w *Watcher) start(ctx context.Context, a Alert) {
	result, err := w.db.ExecContext(ctx, `
		INSERT INTO alerts (device, device_name, kind, subject, level, value, started)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		a.Device, a.DeviceName, a.Kind, a.Subject, a.Level, a.Value, a.Started.UnixMilli())
	if err != nil {
		slog.Error("store an alert", "device", a.DeviceName, "kind", a.Kind, "error", err)
		return
	}
	a.ID, _ = result.LastInsertId()
	w.active[a.key()] = &a
}

// raise keeps the highest level and value an active alert reached. The
// caller holds mu.
func (w *Watcher) raise(ctx context.Context, a *Alert, now Alert) {
	changed := false
	if now.Level.rank() > a.Level.rank() {
		a.Level, changed = now.Level, true
	}
	if now.Value != nil && (a.Value == nil || *now.Value > *a.Value) {
		a.Value, changed = now.Value, true
	}
	if now.DeviceName != a.DeviceName {
		a.DeviceName, changed = now.DeviceName, true
	}
	if !changed {
		return
	}
	if _, err := w.db.ExecContext(ctx, `UPDATE alerts SET level = ?, value = ?, device_name = ? WHERE id = ?`,
		a.Level, a.Value, a.DeviceName, a.ID); err != nil {
		slog.Error("update an alert", "device", a.DeviceName, "kind", a.Kind, "error", err)
	}
}

// end keeps when an alert ended, and reports whether it did. One whose end
// could not be written stays active, so the next check ends it again rather
// than leaving it open in the database for good. The caller holds mu.
func (w *Watcher) end(ctx context.Context, a *Alert, now time.Time) bool {
	if _, err := w.db.ExecContext(ctx, `UPDATE alerts SET ended = ? WHERE id = ?`, now.UnixMilli(), a.ID); err != nil {
		slog.Error("end an alert", "device", a.DeviceName, "kind", a.Kind, "error", err)
		return false
	}
	return true
}

// Active returns the alerts of a device that last, most serious first.
func (w *Watcher) Active(device string) []Alert {
	w.mu.Lock()
	defer w.mu.Unlock()
	var list []Alert
	for _, a := range w.active {
		if a.Device == device {
			list = append(list, *a)
		}
	}
	sortAlerts(list)
	return list
}

// sortAlerts puts alerts before warnings, then the oldest first.
func sortAlerts(list []Alert) {
	slices.SortFunc(list, func(a, b Alert) int {
		if a.Level.rank() != b.Level.rank() {
			return b.Level.rank() - a.Level.rank()
		}
		if c := a.Started.Compare(b.Started); c != 0 {
			return c
		}
		return int(a.ID - b.ID)
	})
}

// Log returns the alerts of every device that last, then the newest that
// ended, each newest first, so one that lasts long is never left out.
func (w *Watcher) Log(ctx context.Context) ([]Alert, error) {
	return w.query(ctx, selectAlerts+` ORDER BY ended IS NOT NULL, started DESC, id DESC LIMIT ?`, LogLimit)
}

// BetweenLimit is how many alerts Between returns at most.
const BetweenLimit = 500

// Between returns the alerts of device that lasted at some time from from to
// to, oldest first: the newest BetweenLimit of them.
func (w *Watcher) Between(ctx context.Context, device string, from, to time.Time) ([]Alert, error) {
	list, err := w.query(ctx, selectAlerts+` WHERE device = ? AND started <= ? AND (ended IS NULL OR ended >= ?) ORDER BY started DESC, id DESC LIMIT ?`,
		device, to.UnixMilli(), from.UnixMilli(), BetweenLimit)
	slices.Reverse(list)
	return list, err
}

// Forget deletes the alerts of a device the hub forgot, such as one removed
// without its history, so a device added later under the same name starts
// without them. A check that listed the devices before brings none back.
func (w *Watcher) Forget(ctx context.Context, device string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.forgets++
	w.forgotten[device] = w.forgets
	maps.DeleteFunc(w.active, func(_ string, a *Alert) bool { return a.Device == device })
	maps.DeleteFunc(w.pending, func(key string, _ time.Time) bool { return deviceOf(key) == device })
	if _, err := w.db.ExecContext(ctx, `DELETE FROM alerts WHERE device = ?`, device); err != nil {
		return fmt.Errorf("delete the alerts of a removed device: %w", err)
	}
	return nil
}

// selectAlerts starts every query that query reads.
const selectAlerts = `SELECT id, device, device_name, kind, subject, level, value, started, ended FROM alerts`

// query reads the alerts a query that starts with selectAlerts returns.
func (w *Watcher) query(ctx context.Context, query string, args ...any) ([]Alert, error) {
	rows, err := w.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("read the alerts: %w", err)
	}
	defer func() { _ = rows.Close() }()
	list := []Alert{}
	for rows.Next() {
		var a Alert
		var started int64
		var ended sql.NullInt64
		if err := rows.Scan(&a.ID, &a.Device, &a.DeviceName, &a.Kind, &a.Subject, &a.Level, &a.Value, &started, &ended); err != nil {
			return nil, fmt.Errorf("read the alerts: %w", err)
		}
		a.Started = time.UnixMilli(started)
		if ended.Valid {
			t := time.UnixMilli(ended.Int64)
			a.Ended = &t
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

// prune deletes the alerts that ended more than the retention ago.
func (w *Watcher) prune(ctx context.Context) {
	before := time.Now().Add(-w.retention).UnixMilli()
	if _, err := w.db.ExecContext(ctx, `DELETE FROM alerts WHERE ended IS NOT NULL AND ended < ?`, before); err != nil {
		slog.Error("delete old alerts", "error", err)
	}
}
