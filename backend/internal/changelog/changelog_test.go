package changelog

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func openTestLog(t *testing.T, retention time.Duration) *Log {
	t.Helper()
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	l, err := Open(context.Background(), db, retention)
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func TestKeepsTheChangesNewestFirstForTheRetention(t *testing.T) {
	ctx := context.Background()
	l := openTestLog(t, 30*24*time.Hour)
	start := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	l.Add(ctx, start, Entry{Address: "192.168.1.20", Action: ActionAdd, Device: "office-pc"})
	l.Add(ctx, start.Add(time.Hour), Entry{Address: "192.168.1.21", Action: ActionRename, Device: "office-pc", Detail: "Desk PC"})
	got, err := l.Latest(ctx)
	if err != nil {
		t.Fatal(err)
	}
	want := []Entry{
		{Time: start.Add(time.Hour).Unix(), Address: "192.168.1.21", Action: ActionRename, Device: "office-pc", Detail: "Desk PC"},
		{Time: start.Unix(), Address: "192.168.1.20", Action: ActionAdd, Device: "office-pc"},
	}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("Latest() = %+v, want %+v", got, want)
	}

	// A change 31 days later deletes the ones older than the retention.
	l.Add(ctx, start.Add(31*24*time.Hour), Entry{Address: "192.168.1.20", Action: ActionWrongPassword})
	got, err = l.Latest(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Action != ActionWrongPassword {
		t.Errorf("Latest() after the retention = %+v, want only the newest change", got)
	}
}

func TestReturnsAtMostTheLatestChanges(t *testing.T) {
	ctx := context.Background()
	l := openTestLog(t, 0)
	start := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	for i := range Latest + 5 {
		l.Add(ctx, start.Add(time.Duration(i)*time.Minute), Entry{Address: "192.168.1.20", Action: ActionBackup})
	}
	got, err := l.Latest(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != Latest || got[0].Time != start.Add((Latest+4)*time.Minute).Unix() {
		t.Errorf("Latest() = %d changes from %d, want %d from the newest", len(got), got[0].Time, Latest)
	}
}
