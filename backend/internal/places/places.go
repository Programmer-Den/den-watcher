// Package places keeps the places named on the page, each by what a device's
// Wi-Fi hears there, so the page can tell where each device was: the hub
// compares what a device heard in each hour with them.
package places

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxPlaces, MaxNameBytes and MaxSignals limit what the page may send: more
// places than anyone names, and more access points than a device reports
// (metrics.MaxNearbyAccessPoints).
const (
	MaxPlaces    = 100
	MaxNameBytes = 100
	MaxSignals   = 64
)

// Place is a place named on the page.
type Place struct {
	Name string `json:"name"`
	// Signals is what a device heard there: the signal in percent of each
	// access point, by its ID (metrics.NearbyAccessPoint.ID).
	Signals map[string]float64 `json:"signals"`
}

// InputError tells what is wrong with places sent by the page.
type InputError struct{ Message string }

func (e *InputError) Error() string { return e.Message }

const schema = `
CREATE TABLE IF NOT EXISTS wifi_places (
	id     INTEGER PRIMARY KEY CHECK (id = 1), -- one list of places
	places TEXT NOT NULL                       -- the []Place as JSON
);
`

// validID matches an access point's ID.
var validID = regexp.MustCompile(`^[0-9a-f]{12}$`)

// Store keeps the places in the database.
type Store struct{ db *sql.DB }

// Open creates the places' table in db when it does not exist yet.
func Open(ctx context.Context, db *sql.DB) (*Store, error) {
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

// Read returns the stored places; none when none were stored yet.
func (s *Store) Read(ctx context.Context) ([]Place, error) {
	var stored string
	err := s.db.QueryRowContext(ctx, `SELECT places FROM wifi_places WHERE id = 1`).Scan(&stored)
	if errors.Is(err, sql.ErrNoRows) {
		return []Place{}, nil
	}
	if err != nil {
		return nil, err
	}
	var places []Place
	if err := json.Unmarshal([]byte(stored), &places); err != nil {
		return nil, fmt.Errorf("read the stored places: %w", err)
	}
	return places, nil
}

// Write checks the places and stores them in place of the ones before.
// Places that are not valid are an *InputError.
func (s *Store) Write(ctx context.Context, places []Place) error {
	if places == nil {
		places = []Place{}
	}
	if len(places) > MaxPlaces {
		return &InputError{fmt.Sprintf("there are more than %d places", MaxPlaces)}
	}
	seen := map[string]bool{}
	for i, place := range places {
		// Only control characters are refused: a name may hold a no-break
		// space, or an emoji joined from several with a zero-width joiner.
		name := strings.TrimSpace(place.Name)
		if name == "" || len(name) > MaxNameBytes || !utf8.ValidString(name) || strings.ContainsFunc(name, unicode.IsControl) {
			return &InputError{fmt.Sprintf("each place's name must be printable text of 1 to %d bytes", MaxNameBytes)}
		}
		if seen[strings.ToLower(name)] {
			return &InputError{fmt.Sprintf("two places are named %q", name)}
		}
		seen[strings.ToLower(name)] = true
		if len(place.Signals) == 0 || len(place.Signals) > MaxSignals {
			return &InputError{fmt.Sprintf("the place %q must have 1 to %d access points", name, MaxSignals)}
		}
		for id, signal := range place.Signals {
			if !validID.MatchString(id) || math.IsNaN(signal) || signal < 0 || signal > 100 {
				return &InputError{fmt.Sprintf("the place %q has an access point that is not an ID with a signal from 0 to 100", name)}
			}
		}
		places[i].Name = name
	}
	stored, err := json.Marshal(places)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO wifi_places (id, places) VALUES (1, ?)
		ON CONFLICT (id) DO UPDATE SET places = excluded.places`, string(stored))
	return err
}
