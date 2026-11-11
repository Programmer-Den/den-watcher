// Package layout keeps how the page is arranged, such as which categories of
// cards are folded, on the machine that serves it, so every browser that opens
// the page shows the same arrangement.
package layout

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxEntries and MaxNameBytes limit each list of a layout sent by the page:
// more entries than the page has cards, and longer names than it uses.
const (
	MaxEntries   = 200
	MaxNameBytes = 100
)

// MaxGroupBytes is the longest name of a group of devices, as long as the
// longest name of a device.
const MaxGroupBytes = 64

// Layout is how the page is arranged.
type Layout struct {
	// Folded are the categories of cards that show only their title, such
	// as "storage".
	Folded []string `json:"folded"`
	// Order are the cards the page was arranged in, by id, such as "cpu" or
	// "extra:wifi"; within its category, a listed card comes before the
	// others, in this order.
	Order []string `json:"order"`
	// Hidden are the cards the page does not show, by id.
	Hidden []string `json:"hidden"`
	// Pinned are the cards shown above the categories, by id, in their order
	// there.
	Pinned []string `json:"pinned"`
	// Made are the values of the details made into cards of their own, by
	// the card's id, such as "value:kernel/forks".
	Made []string `json:"made"`
	// Widths are the cards set wider than one card, by id, in cards: 2 or 4.
	Widths map[string]int `json:"widths"`
	// Ungrouped shows the cards in one section instead of grouped by their
	// category; false, the page groups them.
	Ungrouped bool `json:"ungrouped"`
	// Groups are the groups the devices are put in, such as a room, by the
	// device's id; a device that is in none is not listed. The page shows
	// one group at a time when asked to.
	Groups map[string]string `json:"groups"`
}

// list is one list of a layout, with its name in JSON.
type list struct {
	name    string
	entries *[]string
}

// lists are the lists of the layout, in a fixed order, so the first one that
// is not valid is always the one a refusal names.
func (l *Layout) lists() []list {
	return []list{{"folded", &l.Folded}, {"order", &l.Order}, {"hidden", &l.Hidden}, {"pinned", &l.Pinned}, {"made", &l.Made}}
}

// InputError tells what is wrong with a layout sent by the page.
type InputError struct{ Message string }

func (e *InputError) Error() string { return e.Message }

const schema = `
CREATE TABLE IF NOT EXISTS page_layout (
	id     INTEGER PRIMARY KEY CHECK (id = 1), -- there is only one layout
	layout TEXT NOT NULL                       -- the Layout as JSON
);
`

// Store keeps the layout in the database.
type Store struct{ db *sql.DB }

// Open creates the layout's table in db when it does not exist yet.
func Open(ctx context.Context, db *sql.DB) (*Store, error) {
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

// Read returns the stored layout; an empty one when none was stored yet.
func (s *Store) Read(ctx context.Context) (Layout, error) {
	var stored string
	err := s.db.QueryRowContext(ctx, `SELECT layout FROM page_layout WHERE id = 1`).Scan(&stored)
	if errors.Is(err, sql.ErrNoRows) {
		return Layout{Folded: []string{}, Order: []string{}, Hidden: []string{}, Pinned: []string{}, Made: []string{}, Widths: map[string]int{}, Groups: map[string]string{}}, nil
	}
	if err != nil {
		return Layout{}, err
	}
	var layout Layout
	if err := json.Unmarshal([]byte(stored), &layout); err != nil {
		return Layout{}, fmt.Errorf("read the stored layout: %w", err)
	}
	// A layout stored before a list was added has none.
	for _, list := range layout.lists() {
		if *list.entries == nil {
			*list.entries = []string{}
		}
	}
	if layout.Widths == nil {
		layout.Widths = map[string]int{}
	}
	if layout.Groups == nil {
		layout.Groups = map[string]string{}
	}
	return layout, nil
}

// Write checks the layout and stores it in place of the one before. A layout
// that is not valid is an *InputError.
func (s *Store) Write(ctx context.Context, layout Layout) error {
	for _, list := range layout.lists() {
		if err := check(list.name, *list.entries); err != nil {
			return err
		}
	}
	if err := checkWidths(layout.Widths); err != nil {
		return err
	}
	if err := checkGroups(layout.Groups); err != nil {
		return err
	}
	stored, err := json.Marshal(layout)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO page_layout (id, layout) VALUES (1, ?)
		ON CONFLICT (id) DO UPDATE SET layout = excluded.layout`, string(stored))
	return err
}

// check checks one list of the layout: few enough, each short, printable and
// named once.
func check(field string, names []string) error {
	if len(names) > MaxEntries {
		return &InputError{fmt.Sprintf("%s has more than %d entries", field, MaxEntries)}
	}
	seen := make(map[string]bool, len(names))
	for _, name := range names {
		if !printable(name, MaxNameBytes) {
			return &InputError{fmt.Sprintf("each entry of %s must be printable text of 1 to %d bytes", field, MaxNameBytes)}
		}
		if seen[name] {
			return &InputError{fmt.Sprintf("%s names %q twice", field, name)}
		}
		seen[name] = true
	}
	return nil
}

// checkWidths checks the widths of the layout: named like the entries of a
// list, each 2 or 4 cards.
func checkWidths(widths map[string]int) error {
	cards := slices.Sorted(maps.Keys(widths))
	if err := check("widths", cards); err != nil {
		return err
	}
	for _, card := range cards {
		if width := widths[card]; width != 2 && width != 4 {
			return &InputError{fmt.Sprintf("widths gives %q %d cards, but a card is 2 or 4 cards wide", card, width)}
		}
	}
	return nil
}

// checkGroups checks the groups of the devices: the devices named like the
// entries of a list, each group printable text without spaces around it.
func checkGroups(groups map[string]string) error {
	devices := slices.Sorted(maps.Keys(groups))
	if err := check("groups", devices); err != nil {
		return err
	}
	for _, device := range devices {
		group := groups[device]
		if !printable(group, MaxGroupBytes) || strings.TrimSpace(group) != group {
			return &InputError{fmt.Sprintf("groups puts %q in %q, but a group must be printable text of 1 to %d bytes without spaces around it", device, group, MaxGroupBytes)}
		}
	}
	return nil
}

// printable reports whether text is valid UTF-8 of 1 to limit bytes with
// only printable characters.
func printable(text string, limit int) bool {
	return text != "" && len(text) <= limit && utf8.ValidString(text) && !strings.ContainsFunc(text, func(r rune) bool { return !unicode.IsPrint(r) })
}
