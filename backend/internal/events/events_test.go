package events

import (
	"context"
	"errors"
	"math"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// usage reads a snapshot, or fails while err is set.
type usage struct {
	snapshot metrics.Snapshot
	err      error
}

func (u *usage) Collect(context.Context) (metrics.Snapshot, error) {
	return u.snapshot, u.err
}

func openTest(t *testing.T, path string, targets *[]Target) *Log {
	t.Helper()
	store, err := history.Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	l, err := Open(context.Background(), store.DB(), func() []Target { return *targets }, 24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func reading(uptime uint64, version string) metrics.Snapshot {
	return metrics.Snapshot{UptimeSeconds: uptime, Version: version}
}

func between(t *testing.T, l *Log, device string) []Event {
	t.Helper()
	list, err := l.Between(context.Background(), device, time.Unix(0, 0), time.Unix(2_000_000_000, 0))
	if err != nil {
		t.Fatal(err)
	}
	return list
}

func TestKeepsRebootsAndUpdates(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: reading(3600, "1.4.0")}
	targets := []Target{{ID: "nas", Usage: u}}
	l := openTest(t, filepath.Join(t.TempDir(), "events.db"), &targets)
	now := time.Unix(1_800_000_000, 0)

	// The first reading only notes how the device is.
	l.Check(ctx, now)
	u.snapshot = reading(3615, "1.4.0")
	l.Check(ctx, now.Add(Interval))
	if got := between(t, l, "nas"); len(got) != 0 {
		t.Fatalf("without a change: %+v", got)
	}

	// It started again 10 seconds ago, with a new version.
	u.snapshot = reading(10, "1.5.0")
	at := now.Add(2 * Interval)
	l.Check(ctx, at)
	want := []Event{
		{Time: at.Add(-10 * time.Second), Kind: KindReboot},
		{Time: at, Kind: KindUpdate, Detail: "1.5.0"},
	}
	if got := between(t, l, "nas"); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}

	// A device that does not answer, and readings without uptime or version,
	// such as of a printer or a router, change nothing.
	u.err = errors.New("no answer")
	l.Check(ctx, at.Add(Interval))
	u.err = nil
	u.snapshot = reading(0, "")
	l.Check(ctx, at.Add(2*Interval))
	u.snapshot = reading(40, "1.5.0")
	l.Check(ctx, at.Add(3*Interval))
	if got := between(t, l, "nas"); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want only %+v", got, want)
	}
}

func TestNoticesARebootWhileTheHubWasStopped(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "events.db")
	u := &usage{snapshot: reading(86400, "1.4.0")}
	targets := []Target{{ID: "local", Usage: u}}
	now := time.Unix(1_800_000_000, 0)
	openTest(t, path, &targets).Check(ctx, now)

	u.snapshot = reading(120, "1.5.0")
	later := now.Add(time.Hour)
	l := openTest(t, path, &targets)
	l.Check(ctx, later)
	want := []Event{
		{Time: later.Add(-2 * time.Minute), Kind: KindReboot},
		{Time: later, Kind: KindUpdate, Detail: "1.5.0"},
	}
	if got := between(t, l, "local"); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}

func TestStoresAnUptimeTooLargeForTheDatabase(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "events.db")
	u := &usage{snapshot: reading(math.MaxUint64, "1.4.0")}
	targets := []Target{{ID: "nas", Usage: u}}
	now := time.Unix(1_800_000_000, 0)
	openTest(t, path, &targets).Check(ctx, now)

	// How it was seen was stored, so a start is noticed after a restart.
	u.snapshot = reading(120, "1.4.0")
	later := now.Add(time.Hour)
	l := openTest(t, path, &targets)
	l.Check(ctx, later)
	want := []Event{{Time: later.Add(-2 * time.Minute), Kind: KindReboot}}
	if got := between(t, l, "nas"); !reflect.DeepEqual(got, want) {
		t.Fatalf("events = %+v, want %+v", got, want)
	}
}

func TestBetweenAndPruneKeepToTheirTime(t *testing.T) {
	ctx := context.Background()
	targets := []Target{}
	l := openTest(t, filepath.Join(t.TempDir(), "events.db"), &targets)
	old := time.Now().Add(-48 * time.Hour).Truncate(time.Second)
	recent := time.Now().Add(-time.Hour).Truncate(time.Second)
	l.note(ctx, "pc", 1000, "1.0.0", old, 0)
	l.note(ctx, "pc", 10, "1.0.0", old.Add(time.Minute), 0)
	l.note(ctx, "pc", 1000, "1.0.0", recent, 0)
	l.note(ctx, "pc", 10, "1.0.0", recent.Add(time.Minute), 0)

	got, err := l.Between(ctx, "pc", recent.Add(-time.Minute), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || !got[0].Time.Equal(recent.Add(50*time.Second)) {
		t.Fatalf("between = %+v, want the recent reboot", got)
	}
	if got, _ := l.Between(ctx, "other", time.Unix(0, 0), time.Now()); len(got) != 0 {
		t.Fatalf("another device has %+v", got)
	}

	l.prune(ctx)
	if got := between(t, l, "pc"); len(got) != 1 {
		t.Fatalf("after pruning: %+v, want only the recent reboot", got)
	}
}

func TestBetweenKeepsTheNewestEvents(t *testing.T) {
	ctx := context.Background()
	targets := []Target{}
	l := openTest(t, filepath.Join(t.TempDir(), "events.db"), &targets)
	start := time.Unix(1_800_000_000, 0)
	for i := range BetweenLimit + 10 {
		if _, err := l.db.ExecContext(ctx, `INSERT INTO events (device, time, kind, detail) VALUES ('pc', ?, 'reboot', '')`,
			start.Add(time.Duration(i)*time.Minute).UnixMilli()); err != nil {
			t.Fatal(err)
		}
	}
	got := between(t, l, "pc")
	if len(got) != BetweenLimit {
		t.Fatalf("Between() = %d events, want %d", len(got), BetweenLimit)
	}
	// The oldest are left out, so the newest are marked; still oldest first.
	if first, last := got[0].Time, got[len(got)-1].Time; !first.Equal(start.Add(10*time.Minute)) || !last.Equal(start.Add((BetweenLimit+9)*time.Minute)) {
		t.Errorf("events from %v to %v, want the newest %d", first, last, BetweenLimit)
	}
}

func TestForgetStartsADeviceAnew(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "events.db")
	u := &usage{snapshot: reading(86400, "1.4.0")}
	targets := []Target{{ID: "nas", Usage: u}}
	l := openTest(t, path, &targets)
	now := time.Unix(1_800_000_000, 0)
	l.Check(ctx, now)
	u.snapshot = reading(10, "1.4.0")
	l.Check(ctx, now.Add(Interval))
	u.snapshot = reading(86400, "1.4.0")
	l.Check(ctx, now.Add(2*Interval))

	// Removed without its history, then another device is added under the
	// same name, with a lower uptime and an older version.
	if err := l.Forget(ctx, "nas"); err != nil {
		t.Fatalf("Forget() error = %v", err)
	}
	if got := between(t, l, "nas"); len(got) != 0 {
		t.Fatalf("events after Forget = %+v, want none", got)
	}
	u.snapshot = reading(60, "1.3.0")
	l.Check(ctx, now.Add(time.Hour))
	if got := between(t, l, "nas"); len(got) != 0 {
		t.Errorf("events of the new device = %+v, want no reboot or update", got)
	}
	// Also after a restart: how the old one was last seen is gone.
	if err := l.Forget(ctx, "nas"); err != nil {
		t.Fatal(err)
	}
	u.snapshot = reading(30, "1.2.0")
	again := openTest(t, path, &targets)
	again.Check(ctx, now.Add(2*time.Hour))
	if got := between(t, again, "nas"); len(got) != 0 {
		t.Errorf("events after a restart = %+v, want none", got)
	}
}

// removedWhileRead is a device that is removed while its usage is read, so
// its events are forgotten before the reading is noted.
type removedWhileRead struct {
	usage
	l *Log
}

func (r *removedWhileRead) Collect(ctx context.Context) (metrics.Snapshot, error) {
	if err := r.l.Forget(ctx, "nas"); err != nil {
		return metrics.Snapshot{}, err
	}
	return r.usage.Collect(ctx)
}

func TestACheckDoesNotBringBackADeviceForgottenMeanwhile(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: reading(86400, "1.4.0")}
	targets := []Target{{ID: "nas", Usage: u}}
	l := openTest(t, filepath.Join(t.TempDir(), "events.db"), &targets)
	now := time.Unix(1_800_000_000, 0)
	l.Check(ctx, now)

	targets[0].Usage = &removedWhileRead{usage: usage{snapshot: reading(86460, "1.4.0")}, l: l}
	l.Check(ctx, now.Add(Interval))
	var rows int
	if err := l.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM events_seen WHERE device = 'nas'`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("events_seen rows of the forgotten device = %d, %v; want none", rows, err)
	}

	// Added again under the same name, the newer device is looked at anew.
	targets[0].Usage = u
	u.snapshot = reading(60, "1.3.0")
	l.Check(ctx, now.Add(time.Hour))
	u.snapshot = reading(10, "1.3.0")
	l.Check(ctx, now.Add(time.Hour+Interval))
	if got := between(t, l, "nas"); len(got) != 1 || got[0].Kind != KindReboot {
		t.Errorf("events of the device added again = %+v, want only its reboot", got)
	}
}
