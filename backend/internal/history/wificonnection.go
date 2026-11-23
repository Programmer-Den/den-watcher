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
// ends, so an older copy of one sent again does not shorten it. One within a
// stretch the user deleted is left out; WiFiConnections leaves the stretch
// out of one that reaches into it.
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
		INSERT INTO wifi_connections (device, start, time, end_time, ssid)
		SELECT ?1, ?2, ?3, ?4, ?5
		WHERE NOT EXISTS (SELECT 1 FROM route_deleted WHERE device = ?1 AND ?3 >= start_time AND ?4 <= end_time)
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
	deleted, err := s.deletedStretches(ctx, device)
	if err != nil {
		return nil, err
	}
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
		var ssid string
		var start, end int64
		if err := rows.Scan(&ssid, &start, &end); err != nil {
			return err
		}
		for _, part := range withoutStretches(start, end, deleted) {
			connections = append(connections, PhoneConnection{SSID: ssid, Start: part[0] / 1000, End: part[1] / 1000})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return connections, nil
}

// deletedStretches returns the stretches of the route of the phone stored as
// device that the user deleted, as [start, end) in Unix milliseconds, the
// earliest first: a few, as each is a day the user deleted by hand.
func (s *Store) deletedStretches(ctx context.Context, device string) ([][2]int64, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT start_time, end_time FROM route_deleted WHERE device = ? ORDER BY start_time`, device)
	if err != nil {
		return nil, err
	}
	var stretches [][2]int64
	err = scanRows(rows, func() error {
		var stretch [2]int64
		if err := rows.Scan(&stretch[0], &stretch[1]); err != nil {
			return err
		}
		stretches = append(stretches, stretch)
		return nil
	})
	return stretches, err
}

// withoutStretches returns the parts of start up to end that none of
// stretches, sorted by their start, covers.
func withoutStretches(start, end int64, stretches [][2]int64) [][2]int64 {
	var parts [][2]int64
	for _, stretch := range stretches {
		if stretch[1] <= start || stretch[0] > end || stretch[0] == end && start < end {
			continue
		}
		if stretch[0] > start {
			parts = append(parts, [2]int64{start, stretch[0]})
		}
		start = max(start, stretch[1])
		if start >= end {
			return parts
		}
	}
	return append(parts, [2]int64{start, end})
}
