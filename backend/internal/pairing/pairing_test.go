package pairing

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

const (
	office = "0123456789abcdef0123456789abcdef"
	garage = "fedcba9876543210fedcba9876543210"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "pairing.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func open(t *testing.T, db *sql.DB, existed bool, known ...string) *Pairing {
	t.Helper()
	p, err := Open(context.Background(), db, existed, known)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	return p
}

func TestTheCodeIsMadeOnceAndKept(t *testing.T) {
	db := openTestDB(t)
	first := open(t, db, false)
	if !regexp.MustCompile(`^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$`).MatchString(first.Code()) {
		t.Fatalf("Code() = %q, want two groups of four characters without 0, 1, I and O", first.Code())
	}
	if again := open(t, db, true); again.Code() != first.Code() {
		t.Fatalf("Code() after a restart = %q, want %q", again.Code(), first.Code())
	}
}

func TestAHubIsPairedByTheCode(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t)
	p := open(t, db, false)
	for _, none := range []string{"", " ", "-"} {
		if got := p.Allow(ctx, office, none); got != Needed {
			t.Fatalf("Allow() with the code %q = %v, want Needed", none, got)
		}
	}
	p.code = "7KQMX2RP"
	if got := p.Allow(ctx, office, "7KQM-X2RQ"); got != Wrong {
		t.Fatalf("Allow() with another code = %v, want Wrong", got)
	}
	// Written as it may be typed: in small letters, with spaces.
	const typed = " 7kqm x2rp "
	if got := p.Allow(ctx, office, typed); got != Paired {
		t.Fatalf("Allow() with the code %q = %v, want Paired", typed, got)
	}
	if got := p.Allow(ctx, office, ""); got != Paired {
		t.Fatalf("Allow() of a paired hub without a code = %v, want Paired", got)
	}
	if got := p.Allow(ctx, garage, ""); got != Needed {
		t.Fatalf("Allow() of another hub = %v, want Needed", got)
	}
	// Kept over a restart.
	if got := open(t, db, true).Allow(ctx, office, ""); got != Paired {
		t.Fatalf("Allow() after a restart = %v, want Paired", got)
	}
}

func TestNormalize(t *testing.T) {
	if got := Normalize(" 7kqm-x2rp "); got != "7KQMX2RP" {
		t.Fatalf("Normalize() = %q, want 7KQMX2RP", got)
	}
}

func TestValid(t *testing.T) {
	for code, want := range map[string]bool{
		"7KQM-X2RP":  true,
		"7kqm-x2rp":  false,
		"7KQMX2RP":   false,
		"7KQM-X2R0":  false, // no 0, 1, I and O
		"7KQM-X2RPA": false,
		"7KQM X2RP":  false,
		"7KQM-X2R\n": false,
		"":           false,
	} {
		if got := Valid(code); got != want {
			t.Errorf("Valid(%q) = %v, want %v", code, got, want)
		}
	}
	if code := open(t, openTestDB(t), false).Code(); !Valid(code) {
		t.Errorf("Valid(%q) = false for the code a device shows", code)
	}
}

func TestAnUpdatedDevicePairsTheHubsThatCollectAlready(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t)
	// A database from before pairing, with a hub the buffer knows.
	p := open(t, db, true, garage)
	if got := p.Allow(ctx, office, ""); got != Paired {
		t.Fatalf("Allow() right after the update = %v, want Paired", got)
	}
	later := time.Now().Add(OpenFor + time.Second)
	p.clock = func() time.Time { return later }
	if got := p.Allow(ctx, garage, ""); got != Paired {
		t.Fatalf("Allow() of a hub the buffer knew = %v, want Paired", got)
	}
	const other = "00000000000000000000000000000000"
	if got := p.Allow(ctx, other, ""); got != Needed {
		t.Fatalf("Allow() of a new hub once the time is over = %v, want Needed", got)
	}
	// A restart does not open it again, as the code is kept by then.
	if got := open(t, db, true).Allow(ctx, other, ""); got != Needed {
		t.Fatalf("Allow() of a new hub after a restart = %v, want Needed", got)
	}
}

func TestANewDevicePairsNoHubWithoutTheCode(t *testing.T) {
	p := open(t, openTestDB(t), false)
	if got := p.Allow(context.Background(), office, ""); got != Needed {
		t.Fatalf("Allow() on a new device = %v, want Needed", got)
	}
}

func TestAnUpdatedDevicePairsAFewHubsWithoutTheCode(t *testing.T) {
	ctx := context.Background()
	p := open(t, openTestDB(t), true)
	for i := range maxOpenHubs {
		if got := p.Allow(ctx, fmt.Sprintf("%032x", i), ""); got != Paired {
			t.Fatalf("Allow() of hub %d right after the update = %v, want Paired", i, got)
		}
	}
	if got := p.Allow(ctx, office, ""); got != Needed {
		t.Fatalf("Allow() of one hub more than %d right after the update = %v, want Needed", maxOpenHubs, got)
	}
	if got := p.Allow(ctx, office, p.Code()); got != Paired {
		t.Fatalf("Allow() of that hub with the code = %v, want Paired", got)
	}
}

func TestTheEmptyHubIDIsNeverPaired(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t)
	p := open(t, db, true)
	for _, code := range []string{"", p.Code()} {
		if got := p.Allow(ctx, "", code); got != Needed {
			t.Fatalf("Allow() of the empty hub id with the code %q right after the update = %v, want Needed", code, got)
		}
	}
	// One that an earlier version stored is forgotten at the next start.
	if _, err := db.Exec(`INSERT INTO pairing_hubs (hub, paired) VALUES ('', 0)`); err != nil {
		t.Fatalf("store the empty hub id: %v", err)
	}
	if got := open(t, db, true).Allow(ctx, "", ""); got != Needed {
		t.Fatalf("Allow() of a stored empty hub id after a restart = %v, want Needed", got)
	}
}
