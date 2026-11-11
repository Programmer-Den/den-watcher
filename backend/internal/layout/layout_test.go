package layout

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "layout.db"))
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

func TestALayoutIsEmptyUntilOneIsStored(t *testing.T) {
	got, err := openTestStore(t).Read(context.Background())
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if want := (Layout{Folded: []string{}, Order: []string{}, Hidden: []string{}, Pinned: []string{}, Made: []string{}, Widths: map[string]int{}, Groups: map[string]string{}}); !reflect.DeepEqual(got, want) {
		t.Errorf("Read() = %#v, want %#v", got, want)
	}
}

func TestALayoutStoredBeforeAListWasAddedHasItEmpty(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	if _, err := s.db.ExecContext(ctx, `INSERT INTO page_layout (id, layout) VALUES (1, '{"folded":["storage"]}')`); err != nil {
		t.Fatalf("store an older layout: %v", err)
	}
	got, err := s.Read(ctx)
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if want := (Layout{Folded: []string{"storage"}, Order: []string{}, Hidden: []string{}, Pinned: []string{}, Made: []string{}, Widths: map[string]int{}, Groups: map[string]string{}}); !reflect.DeepEqual(got, want) {
		t.Errorf("Read() = %#v, want %#v", got, want)
	}
}

func TestTheLastWrittenLayoutIsKept(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	want := Layout{Folded: []string{"network", "system"}, Order: []string{"memory", "cpu"}, Hidden: []string{"extra:wifi"}, Pinned: []string{"temperatures"}, Made: []string{"value:kernel/forks"}, Widths: map[string]int{"cpu": 2, "network": 4}, Ungrouped: true, Groups: map[string]string{"local": "Rack", "office-pc": "Office"}}
	for _, layout := range []Layout{{Folded: []string{"storage"}, Order: []string{}, Hidden: []string{}}, want} {
		if err := s.Write(ctx, layout); err != nil {
			t.Fatalf("Write(%v) error = %v", layout, err)
		}
	}
	got, err := s.Read(ctx)
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Read() = %#v, want %#v", got, want)
	}
}

func TestRefusesALayoutThatIsNotValid(t *testing.T) {
	tooMany := make([]string, MaxEntries+1)
	for i := range tooMany {
		tooMany[i] = strconv.Itoa(i)
	}
	for name, list := range map[string][]string{
		"empty name":   {""},
		"long name":    {strings.Repeat("a", MaxNameBytes+1)},
		"control":      {"stor\nage"},
		"invalid utf8": {"\xff"},
		"twice":        {"storage", "storage"},
		"too many":     tooMany,
	} {
		for field, layout := range map[string]Layout{
			"folded": {Folded: list},
			"order":  {Order: list},
			"hidden": {Hidden: list},
			"pinned": {Pinned: list},
			"made":   {Made: list},
		} {
			t.Run(name+" in "+field, func(t *testing.T) {
				s := openTestStore(t)
				var input *InputError
				if err := s.Write(context.Background(), layout); !errors.As(err, &input) || !strings.HasPrefix(input.Message, field) && !strings.Contains(input.Message, " "+field+" ") {
					t.Fatalf("Write() error = %v, want an *InputError about %s", err, field)
				}
				got, err := s.Read(context.Background())
				if err != nil || len(got.Folded)+len(got.Order)+len(got.Hidden)+len(got.Pinned)+len(got.Made)+len(got.Widths) != 0 {
					t.Errorf("Read() = %v, %v; want the refused layout not stored", got, err)
				}
			})
		}
	}
}

func TestRefusesWidthsThatAreNotValid(t *testing.T) {
	tooMany := make(map[string]int, MaxEntries+1)
	for i := range MaxEntries + 1 {
		tooMany[strconv.Itoa(i)] = 2
	}
	for name, widths := range map[string]map[string]int{
		"empty name": {"": 2},
		"long name":  {strings.Repeat("a", MaxNameBytes+1): 2},
		"control":    {"c\npu": 2},
		"too many":   tooMany,
		"one card":   {"cpu": 1},
		"three":      {"cpu": 3},
		"none":       {"cpu": 0},
	} {
		t.Run(name, func(t *testing.T) {
			s := openTestStore(t)
			var input *InputError
			if err := s.Write(context.Background(), Layout{Widths: widths}); !errors.As(err, &input) || !strings.HasPrefix(input.Message, "widths") && !strings.Contains(input.Message, " widths ") {
				t.Fatalf("Write() error = %v, want an *InputError about widths", err)
			}
			if got, err := s.Read(context.Background()); err != nil || len(got.Widths) != 0 {
				t.Errorf("Read() = %v, %v; want the refused layout not stored", got, err)
			}
		})
	}
}

func TestRefusesGroupsThatAreNotValid(t *testing.T) {
	tooMany := make(map[string]string, MaxEntries+1)
	for i := range MaxEntries + 1 {
		tooMany[strconv.Itoa(i)] = "Office"
	}
	for name, groups := range map[string]map[string]string{
		"empty device": {"": "Office"},
		"long device":  {strings.Repeat("a", MaxDeviceBytes+1): "Office"},
		"too many":     tooMany,
		"empty group":  {"pi": ""},
		"long group":   {"pi": strings.Repeat("a", MaxGroupBytes+1)},
		"control":      {"pi": "Off\nice"},
		"invalid utf8": {"pi": "\xff"},
		"space before": {"pi": " Office"},
		"space after":  {"pi": "Office "},
		"only a space": {"pi": " "},
	} {
		t.Run(name, func(t *testing.T) {
			s := openTestStore(t)
			var input *InputError
			if err := s.Write(context.Background(), Layout{Groups: groups}); !errors.As(err, &input) || !strings.HasPrefix(input.Message, "groups") && !strings.Contains(input.Message, " groups ") {
				t.Fatalf("Write() error = %v, want an *InputError about groups", err)
			}
			if got, err := s.Read(context.Background()); err != nil || len(got.Groups) != 0 {
				t.Errorf("Read() = %v, %v; want the refused layout not stored", got, err)
			}
		})
	}
}

func TestTakesTheLongestGroupAndDeviceWithSpacesInside(t *testing.T) {
	s := openTestStore(t)
	// A device named with 64 letters of 4 bytes each, the longest name, has the longest id.
	longest := strings.Repeat("𠀀", 64)
	groups := map[string]string{"pi": strings.Repeat("ü", MaxGroupBytes/2), "nas": "Living room", longest: "Office"}
	if err := s.Write(context.Background(), Layout{Groups: groups}); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if got, err := s.Read(context.Background()); err != nil || !reflect.DeepEqual(got.Groups, groups) {
		t.Errorf("Read() = %v, %v; want the groups %v", got.Groups, err, groups)
	}
}
