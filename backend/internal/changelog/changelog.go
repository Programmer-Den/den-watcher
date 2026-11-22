// Package changelog keeps the changes made to the hub with the password for
// changing devices, and the tries with a wrong password, with when and from
// which address, so a change nobody remembers making can be looked up.
package changelog

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"
)

// Action is what was done.
type Action string

// The actions kept here.
const (
	ActionAdd            Action = "add"
	ActionAddPhone       Action = "addPhone"
	ActionRemove         Action = "remove"
	ActionRename         Action = "rename"
	ActionKind           Action = "kind"
	ActionPairing        Action = "pairing"
	ActionRelease        Action = "release"
	ActionBackup         Action = "backup"
	ActionStatusPassword Action = "statusPassword"
	// ActionPassword is the password for changing devices being chosen, with
	// the first change.
	ActionPassword Action = "password"
	// ActionWrongPassword is a change refused for a wrong password.
	ActionWrongPassword Action = "wrongPassword"
)

// Entry is one change.
type Entry struct {
	// Time is when it was made, in Unix seconds.
	Time int64 `json:"time"`
	// Address is the address of the browser it came from.
	Address string `json:"address"`
	Action  Action `json:"action"`
	// Device is the id of the device it was made to, if any.
	Device string `json:"device,omitempty"`
	// Detail is the new name or kind, or the history kept on removing.
	Detail string `json:"detail,omitempty"`
}

// Latest is how many changes Latest returns at most.
const Latest = 100

const schema = `
CREATE TABLE IF NOT EXISTS change_log (
	time    INTEGER NOT NULL, -- Unix time in milliseconds
	address TEXT    NOT NULL,
	action  TEXT    NOT NULL,
	device  TEXT    NOT NULL,
	detail  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS change_log_by_time ON change_log (time);
`

// Log keeps the changes for its retention.
type Log struct {
	db        *sql.DB
	retention time.Duration
}

// Open prepares the table of changes in db; changes older than retention are
// deleted.
func Open(ctx context.Context, db *sql.DB, retention time.Duration) (*Log, error) {
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return nil, fmt.Errorf("create the change log: %w", err)
	}
	return &Log{db: db, retention: retention}, nil
}

// Add keeps a change made at now, and deletes the ones older than the
// retention. A change that cannot be kept is logged, as the change itself
// is made all the same.
func (l *Log) Add(ctx context.Context, now time.Time, e Entry) {
	// The change is kept even when the request it came with was cancelled.
	ctx = context.WithoutCancel(ctx)
	if _, err := l.db.ExecContext(ctx, `INSERT INTO change_log (time, address, action, device, detail) VALUES (?, ?, ?, ?, ?)`,
		now.UnixMilli(), e.Address, string(e.Action), e.Device, e.Detail); err != nil {
		slog.Error("keep a change in the change log", "action", e.Action, "error", err)
		return
	}
	if l.retention > 0 {
		if _, err := l.db.ExecContext(ctx, `DELETE FROM change_log WHERE time < ?`, now.Add(-l.retention).UnixMilli()); err != nil {
			slog.Error("delete old changes from the change log", "error", err)
		}
	}
}

// Latest returns the newest changes, at most Latest, the newest first.
func (l *Log) Latest(ctx context.Context) ([]Entry, error) {
	rows, err := l.db.QueryContext(ctx, `SELECT time, address, action, device, detail FROM change_log ORDER BY time DESC LIMIT ?`, Latest)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	entries := []Entry{}
	for rows.Next() {
		var e Entry
		var millis int64
		var action string
		if err := rows.Scan(&millis, &e.Address, &action, &e.Device, &e.Detail); err != nil {
			return nil, err
		}
		e.Time, e.Action = millis/1000, Action(action)
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
