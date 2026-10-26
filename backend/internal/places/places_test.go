package places

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "places.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	s, err := Open(context.Background(), db)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	return s
}

func TestThereAreNoPlacesUntilSomeAreNamed(t *testing.T) {
	got, err := openTestStore(t).Read(context.Background())
	if err != nil || got == nil || len(got) != 0 {
		t.Errorf("Read() = %#v, %v; want no places", got, err)
	}
}

func TestTheLastWrittenPlacesAreKept(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	want := []Place{
		{Name: "Work", Signals: map[string]float64{"17226b1f68ae": 64, "0a1b2c3d4e5f": 20}},
		{Name: "Gym", Signals: map[string]float64{"aaaaaaaaaaaa": 100}},
	}
	for _, places := range [][]Place{{{Name: "Café", Signals: map[string]float64{"bbbbbbbbbbbb": 0}}}, want} {
		if err := s.Write(ctx, places); err != nil {
			t.Fatalf("Write(%v) error = %v", places, err)
		}
	}
	got, err := s.Read(ctx)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Errorf("Read() = %v, %v; want %v", got, err, want)
	}
}

func TestANameIsKeptWithoutTheSpacesAroundIt(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	if err := s.Write(ctx, []Place{{Name: "  Work ", Signals: map[string]float64{"17226b1f68ae": 64}}}); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if got, err := s.Read(ctx); err != nil || len(got) != 1 || got[0].Name != "Work" {
		t.Errorf("Read() = %v, %v; want Work", got, err)
	}
}

func TestRefusesPlacesThatAreNotValid(t *testing.T) {
	signals := map[string]float64{"17226b1f68ae": 64}
	tooManyPlaces := make([]Place, MaxPlaces+1)
	for i := range tooManyPlaces {
		tooManyPlaces[i] = Place{Name: fmt.Sprint(i), Signals: signals}
	}
	tooManySignals := map[string]float64{}
	for i := range MaxSignals + 1 {
		tooManySignals[fmt.Sprintf("%012x", i)] = 50
	}
	for name, places := range map[string][]Place{
		"too many places":  tooManyPlaces,
		"empty name":       {{Name: " ", Signals: signals}},
		"long name":        {{Name: strings.Repeat("a", MaxNameBytes+1), Signals: signals}},
		"control":          {{Name: "Wo\nrk", Signals: signals}},
		"invalid utf8":     {{Name: "\xff", Signals: signals}},
		"twice":            {{Name: "Work", Signals: signals}, {Name: "work", Signals: signals}},
		"no signals":       {{Name: "Work"}},
		"too many signals": {{Name: "Work", Signals: tooManySignals}},
		"not an id":        {{Name: "Work", Signals: map[string]float64{"aa:bb:cc:dd:ee:ff": 50}}},
		"upper case id":    {{Name: "Work", Signals: map[string]float64{"17226B1F68AE": 50}}},
		"below 0":          {{Name: "Work", Signals: map[string]float64{"17226b1f68ae": -1}}},
		"above 100":        {{Name: "Work", Signals: map[string]float64{"17226b1f68ae": 101}}},
		"not a number":     {{Name: "Work", Signals: map[string]float64{"17226b1f68ae": math.NaN()}}},
	} {
		t.Run(name, func(t *testing.T) {
			s := openTestStore(t)
			var input *InputError
			if err := s.Write(context.Background(), places); !errors.As(err, &input) {
				t.Fatalf("Write() error = %v, want an *InputError", err)
			}
			if got, err := s.Read(context.Background()); err != nil || len(got) != 0 {
				t.Errorf("Read() = %v, %v; want the refused places not stored", got, err)
			}
		})
	}
}
