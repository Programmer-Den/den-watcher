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
CREATE TABLE IF NOT EXISTS route_deleted (
	device     TEXT    NOT NULL,
	start_time INTEGER NOT NULL, -- Unix milliseconds on the hub's clock
	end_time   INTEGER NOT NULL, -- the same, not included
	PRIMARY KEY (device, start_time, end_time)
) WITHOUT ROWID;
`

// notDeleted is the condition of an INSERT ... SELECT that leaves out a row
// of device ?1 at the hub's time ?3, in Unix milliseconds, that falls into a
// stretch the user deleted (see DeleteRoute), as when the phone sends what
// it had not sent yet of that stretch only afterwards.
const notDeleted = `NOT EXISTS (SELECT 1 FROM route_deleted WHERE device = ?1 AND ?3 >= start_time AND ?3 < end_time)`

// RoutePoint is where a phone was at one time.
type RoutePoint struct {
	// PhoneTime is when it was there on the phone's clock, which tells the
	// same point sent again, and Time on the hub's, both Unix milliseconds.
	PhoneTime, Time int64
	// Lat and Lon are degrees north and east, Accuracy is in meters.
	Lat, Lon, Accuracy float64
}

// AddRoutePoints stores where a phone was. A point stored already is kept as
// it is, and one in a stretch the user deleted is left out.
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
		INSERT INTO route_points (device, phone_time, time, lat, lon, accuracy)
		SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE `+notDeleted+`
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
// (not including) to, oldest first: at most the newest MaxRoutePoints, with
// cut set when there were more.
func (s *Store) RoutePoints(ctx context.Context, device string, from, to time.Time) (_ []PhonePoint, cut bool, _ error) {
	// One more than is returned tells whether there were more.
	rows, err := s.db.QueryContext(ctx, `
		SELECT time, lat, lon, accuracy FROM (
			SELECT time, lat, lon, accuracy FROM route_points
			WHERE device = ? AND time >= ? AND time < ? ORDER BY time DESC LIMIT ?
		) ORDER BY time`, device, from.UnixMilli(), to.UnixMilli(), MaxRoutePoints+1)
	if err != nil {
		return nil, false, err
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
		return nil, false, err
	}
	if len(points) > MaxRoutePoints {
		return points[len(points)-MaxRoutePoints:], true, nil
	}
	return points, false, nil
}
