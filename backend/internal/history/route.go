package history

import (
	"context"
	"time"
)

// routeSchema keeps where each phone was, one row per point of its route.
// The phone's own time of a point is in the key, so a point sent again is
// kept once.
const routeSchema = `
CREATE TABLE IF NOT EXISTS route_points (
	device     TEXT    NOT NULL,
	phone_time INTEGER NOT NULL, -- Unix milliseconds on the phone's clock
	time       INTEGER NOT NULL, -- Unix milliseconds on the hub's clock
	lat        REAL    NOT NULL, -- degrees north
	lon        REAL    NOT NULL, -- degrees east
	accuracy   REAL    NOT NULL, -- meters, as Android tells it
	PRIMARY KEY (device, phone_time)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS route_points_by_time ON route_points (device, time);
CREATE INDEX IF NOT EXISTS route_points_by_age ON route_points (time);
`

// RoutePoint is where a phone was at one time.
type RoutePoint struct {
	// PhoneTime is when it was there on the phone's clock, which tells the
	// same point sent again, and Time on the hub's, both Unix milliseconds.
	PhoneTime, Time int64
	// Lat and Lon are degrees north and east, Accuracy is in meters.
	Lat, Lon, Accuracy float64
}

// AddRoutePoints stores where a phone was. A point stored already is kept as
// it is.
func (s *Store) AddRoutePoints(ctx context.Context, device string, points []RoutePoint) error {
	if len(points) == 0 {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	insert, err := tx.PrepareContext(ctx, `
		INSERT INTO route_points (device, phone_time, time, lat, lon, accuracy) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (device, phone_time) DO NOTHING`)
	if err != nil {
		return err
	}
	defer func() { _ = insert.Close() }()
	for _, p := range points {
		if _, err := insert.ExecContext(ctx, device, p.PhoneTime, p.Time, p.Lat, p.Lon, p.Accuracy); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// PhonePoint is where a phone was at one time, as the page is given it: Time
// in Unix seconds, Lat and Lon in degrees, Accuracy in meters.
type PhonePoint struct {
	Time     int64   `json:"time"`
	Lat      float64 `json:"lat"`
	Lon      float64 `json:"lon"`
	Accuracy float64 `json:"accuracy"`
}

// MaxRoutePoints is how many points RoutePoints returns at most: the newest,
// more than a week of a phone that moves all day.
const MaxRoutePoints = 20000

// RoutePoints returns where the phone stored as device was from from up to
// (not including) to, oldest first: at most the newest MaxRoutePoints.
func (s *Store) RoutePoints(ctx context.Context, device string, from, to time.Time) ([]PhonePoint, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT time, lat, lon, accuracy FROM (
			SELECT time, lat, lon, accuracy FROM route_points
			WHERE device = ? AND time >= ? AND time < ? ORDER BY time DESC LIMIT ?
		) ORDER BY time`, device, from.UnixMilli(), to.UnixMilli(), MaxRoutePoints)
	if err != nil {
		return nil, err
	}
	points := []PhonePoint{}
	err = scanRows(rows, func() error {
		var p PhonePoint
		if err := rows.Scan(&p.Time, &p.Lat, &p.Lon, &p.Accuracy); err != nil {
			return err
		}
		p.Time /= 1000
		points = append(points, p)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return points, nil
}
