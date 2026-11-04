package history

import (
	"context"
	"time"
)

// wifiConnectionSchema keeps which Wi-Fi each phone was connected to and
// when, one row per connection. The phone sends a connection again while it
// goes on, with its new end, and the phone's own start of it is in the key,
// so each is kept once and only grows.
const wifiConnectionSchema = `
CREATE TABLE IF NOT EXISTS wifi_connections (
	device   TEXT    NOT NULL,
	start    INTEGER NOT NULL, -- Unix milliseconds on the phone's clock
	time     INTEGER NOT NULL, -- the start in Unix milliseconds on the hub's clock
	end_time INTEGER NOT NULL, -- the end in Unix milliseconds on the hub's clock
	ssid     TEXT    NOT NULL,
	PRIMARY KEY (device, start)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS wifi_connections_by_time ON wifi_connections (device, time);
CREATE INDEX IF NOT EXISTS wifi_connections_by_end ON wifi_connections (end_time);
`

// WiFiConnection is one time a phone was connected to a Wi-Fi. Times are
// Unix milliseconds.
type WiFiConnection struct {
	// SSID is the Wi-Fi's name.
	SSID string
	// PhoneStart is when it started on the phone's clock, which tells the
	// same connection sent again.
	PhoneStart int64
	// Start and End are when it started and when the phone was last found
	// on it, on the hub's clock.
	Start, End int64
}

// AddWiFiConnections stores which Wi-Fi a phone was connected to. A
// connection stored already keeps its start and gets the later of the two
// ends, so an older copy of one sent again does not shorten it.
func (s *Store) AddWiFiConnections(ctx context.Context, device string, connections []WiFiConnection) error {
	if len(connections) == 0 {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	insert, err := tx.PrepareContext(ctx, `
		INSERT INTO wifi_connections (device, start, time, end_time, ssid) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (device, start) DO UPDATE SET end_time = max(end_time, excluded.end_time)`)
	if err != nil {
		return err
	}
	defer func() { _ = insert.Close() }()
	for _, c := range connections {
		if _, err := insert.ExecContext(ctx, device, c.PhoneStart, c.Start, c.End, c.SSID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// PhoneConnection is one time a phone was connected to a Wi-Fi, as the page
// is given it. Times are Unix seconds.
type PhoneConnection struct {
	SSID  string `json:"ssid"`
	Start int64  `json:"start"`
	End   int64  `json:"end"`
}

// MaxWiFiConnections is how many connections WiFiConnections returns at
// most: the newest, far more than a month of a phone's.
const MaxWiFiConnections = 5000

// WiFiConnections returns which Wi-Fi the phone stored as device was
// connected to from from up to (not including) to, oldest first, each whole,
// also one that started before from or ends after to: at most the newest
// MaxWiFiConnections.
func (s *Store) WiFiConnections(ctx context.Context, device string, from, to time.Time) ([]PhoneConnection, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT ssid, time, end_time FROM (
			SELECT ssid, time, end_time FROM wifi_connections
			WHERE device = ? AND end_time >= ? AND time < ? ORDER BY time DESC LIMIT ?
		) ORDER BY time`, device, from.UnixMilli(), to.UnixMilli(), MaxWiFiConnections)
	if err != nil {
		return nil, err
	}
	connections := []PhoneConnection{}
	err = scanRows(rows, func() error {
		var c PhoneConnection
		if err := rows.Scan(&c.SSID, &c.Start, &c.End); err != nil {
			return err
		}
		c.Start /= 1000
		c.End /= 1000
		connections = append(connections, c)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return connections, nil
}
