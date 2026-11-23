package history

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// positionPlaceSchema keeps the places the phones scanned the Wi-Fi networks
// at, so each keeps its ID however the page looks at them, and what the user
// told of them: a name, the place it was merged into and the places it is
// kept apart from. A place is where its first scan was; later scans within
// PositionMeters of it count to it.
const positionPlaceSchema = `
CREATE TABLE IF NOT EXISTS position_places (
	id          INTEGER PRIMARY KEY,
	lat         REAL    NOT NULL,           -- where its first scan was, in degrees
	lon         REAL    NOT NULL,
	last        INTEGER NOT NULL,           -- Unix seconds of the newest scan counted to it
	name        TEXT    NOT NULL DEFAULT '',
	merged_into INTEGER                     -- the place its scans count to, or NULL
);
CREATE TABLE IF NOT EXISTS position_place_last_id (
	one     INTEGER PRIMARY KEY CHECK (one = 1),
	last_id INTEGER NOT NULL -- the highest ID a place ever had, so none is given twice
);
CREATE TABLE IF NOT EXISTS position_places_apart (
	a INTEGER NOT NULL, -- the two places, a < b, never suggested as one
	b INTEGER NOT NULL,
	PRIMARY KEY (a, b)
) WITHOUT ROWID;
`

// MaxPlaceNameBytes is how long a place's name may be.
const MaxPlaceNameBytes = 100

// ErrNoPositionPlace is returned for a place the hub does not keep.
var ErrNoPositionPlace = errors.New("no such place")

// PlaceInputError tells what is wrong with a change to a place.
type PlaceInputError struct{ Message string }

func (e *PlaceInputError) Error() string { return e.Message }

// positionGrouper returns a grouper with the places the hub keeps.
func (s *Store) positionGrouper(ctx context.Context) (*positionGrouper, error) {
	apart := map[int64][]int64{}
	rows, err := s.db.QueryContext(ctx, `SELECT a, b FROM position_places_apart ORDER BY a, b`)
	if err != nil {
		return nil, err
	}
	err = scanRows(rows, func() error {
		var a, b int64
		if err := rows.Scan(&a, &b); err != nil {
			return err
		}
		apart[a] = append(apart[a], b)
		apart[b] = append(apart[b], a)
		return nil
	})
	if err != nil {
		return nil, err
	}
	rows, err = s.db.QueryContext(ctx, `SELECT id, lat, lon, last, name, COALESCE(merged_into, 0) FROM position_places ORDER BY id`)
	if err != nil {
		return nil, err
	}
	g := &positionGrouper{}
	err = scanRows(rows, func() error {
		place := &placeScans{}
		if err := rows.Scan(&place.id, &place.lat, &place.lon, &place.kept, &place.name, &place.mergedInto); err != nil {
			return err
		}
		place.apart = apart[place.id]
		g.keep(place)
		return nil
	})
	return g, err
}

// keepPositionPlaces stores the places the grouper started and the newest
// scan counted to each place, all in one transaction.
func (s *Store) keepPositionPlaces(ctx context.Context, g *positionGrouper) error {
	var changed []*placeScans
	for _, place := range g.places {
		if place.id == 0 || place.newest > place.kept {
			changed = append(changed, place)
		}
	}
	if len(changed) == 0 {
		return nil
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		for _, place := range changed {
			if place.id != 0 {
				if _, err := tx.ExecContext(ctx, `UPDATE position_places SET last = ? WHERE id = ?`, place.newest, place.id); err != nil {
					return err
				}
				continue
			}
			// A new ID above every one given so far, also those of places
			// deleted since, so a page still showing one changes no other.
			err := tx.QueryRowContext(ctx, `
				INSERT INTO position_places (id, lat, lon, last) VALUES (
					max(COALESCE((SELECT MAX(id) FROM position_places), 0),
						COALESCE((SELECT last_id FROM position_place_last_id), 0)) + 1, ?, ?, ?)
				RETURNING id`,
				place.lat, place.lon, place.newest).Scan(&place.id)
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `INSERT OR REPLACE INTO position_place_last_id (one, last_id) VALUES (1, ?)`, place.id); err != nil {
				return err
			}
			g.byID[place.id] = slices.Index(g.places, place)
		}
		for _, place := range changed {
			place.kept = place.newest
		}
		return nil
	})
}

// inTx runs f in a transaction, which is committed when f returns nil and
// rolled back otherwise.
func (s *Store) inTx(ctx context.Context, f func(*sql.Tx) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := f(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// rootPlace returns the ID of the place the scans of place id count to, in
// tx: the one it was merged into, or itself.
func rootPlace(ctx context.Context, tx *sql.Tx, id int64) (int64, error) {
	for range 100 {
		var into sql.NullInt64
		err := tx.QueryRowContext(ctx, `SELECT merged_into FROM position_places WHERE id = ?`, id).Scan(&into)
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrNoPositionPlace
		}
		if err != nil {
			return 0, err
		}
		if !into.Valid {
			return id, nil
		}
		id = into.Int64
	}
	return 0, fmt.Errorf("the places merged into each other in a loop at %d", id)
}

// RenamePositionPlace names the place id, or the one it was merged into; an
// empty name takes its name away. A name is 1 to MaxPlaceNameBytes of
// printable text, which no other place has, whatever the case.
func (s *Store) RenamePositionPlace(ctx context.Context, id int64, name string) error {
	name = strings.TrimSpace(name)
	if len(name) > MaxPlaceNameBytes || !utf8.ValidString(name) || strings.ContainsFunc(name, unicode.IsControl) {
		return &PlaceInputError{fmt.Sprintf("a place's name must be printable text of at most %d bytes", MaxPlaceNameBytes)}
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		root, err := rootPlace(ctx, tx, id)
		if err != nil {
			return err
		}
		if name != "" {
			// Compared here, as SQLite's lower() changes only A to Z, not Ü.
			rows, err := tx.QueryContext(ctx, `SELECT name FROM position_places WHERE name != '' AND id != ?`, root)
			if err != nil {
				return err
			}
			taken := false
			err = scanRows(rows, func() error {
				var other string
				if err := rows.Scan(&other); err != nil {
					return err
				}
				taken = taken || strings.EqualFold(other, name)
				return nil
			})
			if err != nil {
				return err
			}
			if taken {
				return &PlaceInputError{fmt.Sprintf("another place is named %q", name)}
			}
		}
		_, err = tx.ExecContext(ctx, `UPDATE position_places SET name = ? WHERE id = ?`, name, root)
		return err
	})
}

// MergePositionPlace makes the scans of place id, and of the places merged
// into it, count to place into, or the one that was merged into. The merged
// place keeps no name; when into has none, it takes the merged one's.
func (s *Store) MergePositionPlace(ctx context.Context, id, into int64) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		if _, err := rootPlace(ctx, tx, id); err != nil {
			return err
		}
		root, err := rootPlace(ctx, tx, into)
		if err != nil {
			return err
		}
		if root == id {
			return &PlaceInputError{"a place cannot be merged into itself"}
		}
		var name string
		if err := tx.QueryRowContext(ctx, `SELECT name FROM position_places WHERE id = ?`, id).Scan(&name); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE position_places SET merged_into = ? WHERE id = ? OR merged_into = ?`, root, id, id); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE position_places SET name = '' WHERE id = ?`, id); err != nil {
			return err
		}
		if name != "" {
			if _, err := tx.ExecContext(ctx, `UPDATE position_places SET name = ? WHERE id = ? AND name = ''`, name, root); err != nil {
				return err
			}
		}
		_, err = tx.ExecContext(ctx, `DELETE FROM position_places_apart WHERE (a, b) = (?, ?)`, min(id, root), max(id, root))
		return err
	})
}

// SplitPositionPlace undoes the merge of place id: its scans count to it
// again, and it is kept apart from the place it was merged into.
func (s *Store) SplitPositionPlace(ctx context.Context, id int64) error {
	return s.inTx(ctx, func(tx *sql.Tx) error {
		root, err := rootPlace(ctx, tx, id)
		if err != nil {
			return err
		}
		if root == id {
			return nil
		}
		if _, err := tx.ExecContext(ctx, `UPDATE position_places SET merged_into = NULL WHERE id = ?`, id); err != nil {
			return err
		}
		return keepApart(ctx, tx, id, root)
	})
}

// KeepPositionPlacesApart tells the hub the places a and b are not one, so
// the page does not suggest merging them.
func (s *Store) KeepPositionPlacesApart(ctx context.Context, a, b int64) error {
	if a == b {
		return &PlaceInputError{"a place cannot be kept apart from itself"}
	}
	return s.inTx(ctx, func(tx *sql.Tx) error {
		for _, id := range []int64{a, b} {
			if _, err := rootPlace(ctx, tx, id); err != nil {
				return err
			}
		}
		return keepApart(ctx, tx, a, b)
	})
}

func keepApart(ctx context.Context, tx *sql.Tx, a, b int64) error {
	_, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO position_places_apart (a, b) VALUES (?, ?)`, min(a, b), max(a, b))
	return err
}

// untoldPlace is the condition of a place the user told nothing of: no
// name, not merged, nothing merged into it and not kept apart from another.
// Such a place tells only where the phones scanned, which the scans tell too;
// the next look at the Wi-Fi map starts it again from the scans that are
// left, with a new ID. A place the user told something of is kept for good.
const untoldPlace = `name = '' AND merged_into IS NULL
	AND id NOT IN (SELECT merged_into FROM position_places WHERE merged_into IS NOT NULL)
	AND id NOT IN (SELECT a FROM position_places_apart)
	AND id NOT IN (SELECT b FROM position_places_apart)`

// deleteOldPositionPlaces deletes the places whose newest scan is before t
// and that the user told nothing of (see untoldPlace). Their scans are gone,
// and a new scan there starts a new place.
func (s *Store) deleteOldPositionPlaces(ctx context.Context, t time.Time) (int64, error) {
	s.placing.Lock()
	defer s.placing.Unlock()
	result, err := s.db.ExecContext(ctx, `DELETE FROM position_places WHERE last < ? AND `+untoldPlace, t.Unix())
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// deletePositionPlacesNear deletes the places the user told nothing of (see
// untoldPlace) within PositionMeters of one of points, as where a phone was
// on a day of its route that the user deletes.
func (s *Store) deletePositionPlacesNear(ctx context.Context, points []PhonePoint) (int64, error) {
	if len(points) == 0 {
		return 0, nil
	}
	s.placing.Lock()
	defer s.placing.Unlock()
	rows, err := s.db.QueryContext(ctx, `SELECT id, lat, lon FROM position_places WHERE `+untoldPlace)
	if err != nil {
		return 0, err
	}
	var near []int64
	err = scanRows(rows, func() error {
		var id int64
		var lat, lon float64
		if err := rows.Scan(&id, &lat, &lon); err != nil {
			return err
		}
		for _, p := range points {
			if distanceMeters(lat, lon, p.Lat, p.Lon) <= PositionMeters {
				near = append(near, id)
				break
			}
		}
		return nil
	})
	if err != nil || len(near) == 0 {
		return 0, err
	}
	var deleted int64
	err = s.inTx(ctx, func(tx *sql.Tx) error {
		for _, id := range near {
			result, err := tx.ExecContext(ctx, `DELETE FROM position_places WHERE id = ?`, id)
			if err != nil {
				return err
			}
			n, err := result.RowsAffected()
			if err != nil {
				return err
			}
			deleted += n
		}
		return nil
	})
	return deleted, err
}
