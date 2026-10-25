package alerts

import (
	"context"
	"errors"
	"path/filepath"
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

func openTest(t *testing.T, targets *[]Target) (*Watcher, *history.Store) {
	t.Helper()
	store, err := history.Open(context.Background(), filepath.Join(t.TempDir(), "alerts.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	w, err := Open(context.Background(), store.DB(), func() []Target { return *targets }, 24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return w, store
}

func disk(percent float64) metrics.Snapshot {
	return metrics.Snapshot{Disks: []metrics.Disk{{Path: "/", TotalBytes: 100, UsedPercent: percent}}}
}

func TestADiskStartsRisesAndEndsAnAlert(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: disk(50)}
	targets := []Target{{ID: "nas", Name: "NAS", Usage: u}}
	w, _ := openTest(t, &targets)
	now := time.Unix(1_800_000_000, 0)

	w.Check(ctx, now)
	if got := w.Active("nas"); len(got) != 0 {
		t.Fatalf("at 50 %%: %+v", got)
	}

	u.snapshot = disk(91)
	w.Check(ctx, now.Add(Interval))
	got := w.Active("nas")
	if len(got) != 1 || got[0].Kind != KindDisk || got[0].Subject != "/" || got[0].Level != Warning || *got[0].Value != 91 {
		t.Fatalf("at 91 %%: %+v", got)
	}

	u.snapshot = disk(96)
	w.Check(ctx, now.Add(2*Interval))
	if got := w.Active("nas"); len(got) != 1 || got[0].Level != Critical || *got[0].Value != 96 {
		t.Fatalf("at 96 %%: %+v", got)
	}

	// Just below the threshold it lasts, so it does not start and end again.
	u.snapshot = disk(94)
	w.Check(ctx, now.Add(3*Interval))
	if got := w.Active("nas"); len(got) != 1 || got[0].Level != Critical || *got[0].Value != 96 {
		t.Fatalf("at 94 %%: %+v", got)
	}

	// The device cannot be read for a moment: the alert lasts.
	u.err = errors.New("stale")
	w.Check(ctx, now.Add(4*Interval))
	if got := w.Active("nas"); len(got) != 1 {
		t.Fatalf("while unread: %+v", got)
	}
	u.err = nil

	u.snapshot = disk(80)
	w.Check(ctx, now.Add(5*Interval))
	if got := w.Active("nas"); len(got) != 0 {
		t.Fatalf("at 80 %%: %+v", got)
	}

	log, err := w.Log(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(log) != 1 || log[0].Ended == nil || !log[0].Ended.Equal(now.Add(5*Interval)) ||
		!log[0].Started.Equal(now.Add(Interval)) || log[0].Level != Critical || *log[0].Value != 96 || log[0].DeviceName != "NAS" {
		t.Fatalf("log: %+v", log)
	}
}

func TestCPUMustLastBeforeItIsAnAlert(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: metrics.Snapshot{CPU: metrics.CPU{Cores: 4, UsagePercent: 99}}}
	targets := []Target{{ID: "pi", Name: "Pi", Usage: u}}
	w, _ := openTest(t, &targets)
	start := time.Unix(1_800_000_000, 0)
	for at := start; at.Before(start.Add(5 * time.Minute)); at = at.Add(Interval) {
		w.Check(ctx, at)
		if got := w.Active("pi"); len(got) != 0 {
			t.Fatalf("after %v: %+v", at.Sub(start), got)
		}
	}
	w.Check(ctx, start.Add(5*time.Minute))
	got := w.Active("pi")
	if len(got) != 1 || got[0].Kind != KindCPU || !got[0].Started.Equal(start) {
		t.Fatalf("after 5 minutes: %+v", got)
	}

	// A short peak is forgotten once it is over.
	u.snapshot.CPU.UsagePercent = 10
	w.Check(ctx, start.Add(6*time.Minute))
	u.snapshot.CPU.UsagePercent = 99
	w.Check(ctx, start.Add(7*time.Minute))
	w.Check(ctx, start.Add(8*time.Minute))
	if got := w.Active("pi"); len(got) != 0 {
		t.Fatalf("one minute into a new peak: %+v", got)
	}
}

func TestAServerThatDoesNotAnswerIsAnAlertButAPCIsNot(t *testing.T) {
	ctx := context.Background()
	now := time.Unix(1_800_000_000, 0)
	targets := []Target{
		{ID: "server", Name: "Server", Unreachable: true, UnreachableSince: now.Add(-time.Minute)},
		{ID: "laptop", Name: "Laptop", PC: true, Unreachable: true, UnreachableSince: now.Add(-time.Hour)},
	}
	w, store := openTest(t, &targets)
	w.Check(ctx, now)
	if got := w.Active("server"); len(got) != 0 {
		t.Fatalf("after a minute: %+v", got)
	}
	w.Check(ctx, now.Add(time.Minute))
	got := w.Active("server")
	if len(got) != 1 || got[0].Kind != KindOffline || got[0].Level != Critical || !got[0].Started.Equal(now.Add(-time.Minute)) {
		t.Fatalf("after two minutes: %+v", got)
	}
	if got := w.Active("laptop"); len(got) != 0 {
		t.Fatalf("laptop: %+v", got)
	}

	// After a restart the alert is taken up again, and ends once the
	// server answers.
	again, err := Open(ctx, store.DB(), func() []Target { return targets }, 24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	targets[0].UnreachableSince = time.Time{}
	again.Check(ctx, now.Add(2*time.Minute))
	if got := again.Active("server"); len(got) != 1 {
		t.Fatalf("after a restart: %+v", got)
	}
	targets[0] = Target{ID: "server", Name: "Server", Usage: &usage{}}
	again.Check(ctx, now.Add(3*time.Minute))
	if got := again.Active("server"); len(got) != 0 {
		t.Fatalf("once it answers: %+v", got)
	}
}

func TestARemovedDeviceEndsItsAlerts(t *testing.T) {
	ctx := context.Background()
	targets := []Target{{ID: "nas", Name: "NAS", Usage: &usage{snapshot: disk(99)}}}
	w, _ := openTest(t, &targets)
	now := time.Unix(1_800_000_000, 0)
	w.Check(ctx, now)
	targets = nil
	w.Check(ctx, now.Add(Interval))
	if got := w.Active("nas"); len(got) != 0 {
		t.Fatalf("got %+v", got)
	}
}

func TestThrottlingAndSMART(t *testing.T) {
	ctx := context.Background()
	s := metrics.Snapshot{
		Throttling: &metrics.Throttling{Now: []string{"undervoltage", "throttled"}},
		Extras: []metrics.Extra{{ID: "smart-checks", Items: []metrics.ExtraItem{
			{ID: "sda-health", Section: "Disk (sda)", Unit: metrics.UnitText, Text: "✗"},
			{ID: "sdb-health", Section: "Disk (sdb)", Unit: metrics.UnitText, Text: "✓"},
		}}},
	}
	targets := []Target{{ID: "pi", Name: "Pi", Usage: &usage{snapshot: s}}}
	w, _ := openTest(t, &targets)
	w.Check(ctx, time.Unix(1_800_000_000, 0))
	got := w.Active("pi")
	if len(got) != 2 || got[0].Level != Critical || got[1].Level != Critical {
		t.Fatalf("got %+v", got)
	}
	kinds := map[Kind]string{got[0].Kind: got[0].Subject, got[1].Kind: got[1].Subject}
	if kinds[KindThrottling] != "undervoltage,throttled" || kinds[KindSMART] != "Disk (sda)" {
		t.Errorf("got %+v", got)
	}
}

func TestOldAlertsArePruned(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: disk(99)}
	targets := []Target{{ID: "nas", Name: "NAS", Usage: u}}
	w, _ := openTest(t, &targets)
	long := time.Now().Add(-48 * time.Hour)
	w.Check(ctx, long)
	u.snapshot = disk(10)
	w.Check(ctx, long.Add(Interval))
	w.prune(ctx)
	if log, _ := w.Log(ctx); len(log) != 0 {
		t.Errorf("got %+v", log)
	}
}

func TestAlertsLastWhileADeviceDoesNotAnswer(t *testing.T) {
	ctx := context.Background()
	targets := []Target{{ID: "nas", Name: "NAS", Usage: &usage{snapshot: disk(96)}}}
	w, _ := openTest(t, &targets)
	now := time.Unix(1_800_000_000, 0)
	w.Check(ctx, now)

	// A short blip is no outage, and the disk alert lasts through it.
	targets[0] = Target{ID: "nas", Name: "NAS", Unreachable: true, UnreachableSince: now}
	w.Check(ctx, now.Add(Interval))
	if got := w.Active("nas"); len(got) != 1 || got[0].Kind != KindDisk {
		t.Fatalf("during a blip: %+v", got)
	}
	// An outage that lasts adds the offline alert.
	w.Check(ctx, now.Add(3*time.Minute))
	if got := w.Active("nas"); len(got) != 2 {
		t.Fatalf("during an outage: %+v", got)
	}
	targets[0] = Target{ID: "nas", Name: "NAS", Usage: &usage{snapshot: disk(96)}}
	w.Check(ctx, now.Add(4*time.Minute))
	got := w.Active("nas")
	if len(got) != 1 || got[0].Kind != KindDisk || !got[0].Started.Equal(now) {
		t.Fatalf("once it answers: %+v", got)
	}
}

func TestTheLogKeepsAnAlertThatLasts(t *testing.T) {
	ctx := context.Background()
	disks := &usage{snapshot: disk(99)}
	flaps := &usage{snapshot: disk(99)}
	targets := []Target{{ID: "nas", Name: "NAS", Usage: disks}, {ID: "pi", Name: "Pi", Usage: flaps}}
	w, _ := openTest(t, &targets)
	now := time.Unix(1_800_000_000, 0)
	// The Pi starts and ends more alerts than the log holds, all newer than the NAS's.
	for i := range 2*LogLimit + 2 {
		flaps.snapshot = disk(float64(99 - 89*(i%2)))
		w.Check(ctx, now.Add(time.Duration(i)*Interval))
	}
	log, err := w.Log(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(log) != LogLimit || log[0].Device != "nas" || log[0].Ended != nil {
		t.Fatalf("got %d, first %+v", len(log), log[0])
	}
}

func TestAnOfflineAlertEndsWhenTheDeviceBecomesAPC(t *testing.T) {
	ctx := context.Background()
	now := time.Unix(1_800_000_000, 0)
	targets := []Target{{ID: "office", Name: "Office", Unreachable: true, UnreachableSince: now.Add(-3 * time.Minute)}}
	w, _ := openTest(t, &targets)
	w.Check(ctx, now)
	if got := w.Active("office"); len(got) != 1 || got[0].Kind != KindOffline {
		t.Fatalf("as a server: %+v", got)
	}
	targets[0].PC = true
	w.Check(ctx, now.Add(Interval))
	if got := w.Active("office"); len(got) != 0 {
		t.Fatalf("as a PC: %+v", got)
	}
}

func TestAPCThatIsOffHasNoAlertsAndStartsAHoldAgain(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: metrics.Snapshot{CPU: metrics.CPU{Cores: 4, UsagePercent: 99}}}
	targets := []Target{{ID: "pc", Name: "PC", PC: true, Usage: u}}
	w, _ := openTest(t, &targets)
	start := time.Unix(1_800_000_000, 0)
	for at := start; !at.After(start.Add(5 * time.Minute)); at = at.Add(Interval) {
		w.Check(ctx, at)
	}
	if got := w.Active("pc"); len(got) != 1 {
		t.Fatalf("before it is off: %+v", got)
	}
	targets[0] = Target{ID: "pc", Name: "PC", PC: true, Unreachable: true, UnreachableSince: start.Add(6 * time.Minute)}
	w.Check(ctx, start.Add(7*time.Minute))
	if got := w.Active("pc"); len(got) != 0 {
		t.Fatalf("while it is off: %+v", got)
	}
	// Back the next morning, one high reading is no alert yet.
	targets[0] = Target{ID: "pc", Name: "PC", PC: true, Usage: u}
	w.Check(ctx, start.Add(10*time.Hour))
	if got := w.Active("pc"); len(got) != 0 {
		t.Fatalf("once it is back: %+v", got)
	}
}

func TestAServerThatDoesNotAnswerDropsItsHolds(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: metrics.Snapshot{CPU: metrics.CPU{Cores: 4, UsagePercent: 99}}}
	targets := []Target{{ID: "nas", Name: "NAS", Usage: u}}
	w, _ := openTest(t, &targets)
	start := time.Unix(1_800_000_000, 0)
	w.Check(ctx, start)
	targets[0] = Target{ID: "nas", Name: "NAS", Unreachable: true, UnreachableSince: start.Add(time.Minute)}
	w.Check(ctx, start.Add(2*time.Minute))
	targets[0] = Target{ID: "nas", Name: "NAS", Usage: u}
	w.Check(ctx, start.Add(6*time.Minute))
	if got := w.Active("nas"); len(got) != 0 {
		t.Fatalf("after one reading back: %+v", got)
	}
}

func TestBetweenReturnsTheAlertsOfADeviceThatLastedInTheRange(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: disk(91)}
	other := &usage{snapshot: disk(91)}
	targets := []Target{{ID: "nas", Name: "NAS", Usage: u}, {ID: "pi", Name: "Pi", Usage: other}}
	w, _ := openTest(t, &targets)
	start := time.Unix(1_800_000_000, 0)
	w.Check(ctx, start)
	u.snapshot = disk(50)
	end := start.Add(time.Hour)
	w.Check(ctx, end)

	for _, tt := range []struct {
		from, to time.Time
		want     int
	}{
		{start.Add(-time.Hour), start.Add(-time.Minute), 0},
		{start.Add(-time.Hour), start, 1},
		{start.Add(time.Minute), start.Add(2 * time.Minute), 1},
		{end, end.Add(time.Hour), 1},
		{end.Add(time.Minute), end.Add(time.Hour), 0},
	} {
		got, err := w.Between(ctx, "nas", tt.from, tt.to)
		if err != nil || len(got) != tt.want {
			t.Errorf("Between(%v, %v) = %+v, %v; want %d alerts", tt.from, tt.to, got, err, tt.want)
		}
	}
	// The alert of the Pi lasts, so it is in every range after it started.
	got, err := w.Between(ctx, "pi", end.Add(24*time.Hour), end.Add(25*time.Hour))
	if err != nil || len(got) != 1 || got[0].Ended != nil {
		t.Errorf("the lasting alert: %+v, %v", got, err)
	}
}

func TestBetweenKeepsTheNewestAlerts(t *testing.T) {
	ctx := context.Background()
	targets := []Target{}
	w, store := openTest(t, &targets)
	start := time.Unix(1_800_000_000, 0)
	for i := range BetweenLimit + 10 {
		at := start.Add(time.Duration(i) * time.Minute)
		if _, err := store.DB().ExecContext(ctx, `
			INSERT INTO alerts (device, device_name, kind, subject, level, started, ended)
			VALUES ('nas', 'NAS', 'cpu', '', 'warning', ?, ?)`, at.UnixMilli(), at.Add(30*time.Second).UnixMilli()); err != nil {
			t.Fatal(err)
		}
	}
	got, err := w.Between(ctx, "nas", start, start.Add(24*time.Hour))
	if err != nil || len(got) != BetweenLimit {
		t.Fatalf("Between() = %d alerts, %v; want %d", len(got), err, BetweenLimit)
	}
	// The oldest are left out, so the newest are marked; still oldest first.
	if first, last := got[0].Started, got[len(got)-1].Started; !first.Equal(start.Add(10*time.Minute)) || !last.Equal(start.Add((BetweenLimit+9)*time.Minute)) {
		t.Errorf("alerts from %v to %v, want the newest %d", first, last, BetweenLimit)
	}
}

func TestAnAlertWhoseEndCannotBeWrittenEndsLater(t *testing.T) {
	ctx := context.Background()
	u := &usage{snapshot: disk(99)}
	targets := []Target{{ID: "nas", Name: "NAS", Usage: u}}
	w, store := openTest(t, &targets)
	now := time.Unix(1_800_000_000, 0)
	w.Check(ctx, now)
	if _, err := store.DB().ExecContext(ctx, `
		CREATE TRIGGER fail_end BEFORE UPDATE OF ended ON alerts
		BEGIN SELECT RAISE(FAIL, 'disk full'); END`); err != nil {
		t.Fatal(err)
	}

	u.snapshot = disk(10)
	w.Check(ctx, now.Add(Interval))
	if got := w.Active("nas"); len(got) != 1 {
		t.Fatalf("while its end cannot be written: %+v, want it to last", got)
	}
	if _, err := store.DB().ExecContext(ctx, `DROP TRIGGER fail_end`); err != nil {
		t.Fatal(err)
	}
	w.Check(ctx, now.Add(2*Interval))
	if got := w.Active("nas"); len(got) != 0 {
		t.Fatalf("once its end can be written: %+v", got)
	}
	if log, err := w.Log(ctx); err != nil || len(log) != 1 || log[0].Ended == nil {
		t.Errorf("log = %+v, %v; want the alert ended", log, err)
	}
}

func TestForgetDeletesTheAlertsOfADevice(t *testing.T) {
	ctx := context.Background()
	nas := &usage{snapshot: disk(99)}
	targets := []Target{{ID: "nas", Name: "NAS", Usage: nas}, {ID: "pi", Name: "Pi", Usage: &usage{snapshot: disk(99)}}}
	w, _ := openTest(t, &targets)
	now := time.Unix(1_800_000_000, 0)
	w.Check(ctx, now)
	nas.snapshot = disk(10)
	w.Check(ctx, now.Add(Interval))
	nas.snapshot = disk(99)
	w.Check(ctx, now.Add(2*Interval))

	// Removed without its history.
	targets = targets[1:]
	if err := w.Forget(ctx, "nas"); err != nil {
		t.Fatalf("Forget() error = %v", err)
	}
	w.Check(ctx, now.Add(3*Interval))
	if got := w.Active("nas"); len(got) != 0 {
		t.Errorf("active = %+v, want none", got)
	}
	if got, err := w.Between(ctx, "nas", now, now.Add(time.Hour)); err != nil || len(got) != 0 {
		t.Errorf("Between() = %+v, %v; want none", got, err)
	}
	if log, err := w.Log(ctx); err != nil || len(log) != 1 || log[0].Device != "pi" {
		t.Errorf("log = %+v, %v; want only the Pi's alert", log, err)
	}
}

// removedWhileRead is a device that is removed while its usage is read, so
// its alerts are forgotten before the check ends.
type removedWhileRead struct {
	usage
	w *Watcher
}

func (r *removedWhileRead) Collect(ctx context.Context) (metrics.Snapshot, error) {
	if err := r.w.Forget(ctx, "nas"); err != nil {
		return metrics.Snapshot{}, err
	}
	return r.usage.Collect(ctx)
}

func TestACheckDoesNotBringBackADeviceForgottenMeanwhile(t *testing.T) {
	ctx := context.Background()
	targets := []Target{{ID: "nas", Name: "NAS"}}
	w, _ := openTest(t, &targets)
	targets[0].Usage = &removedWhileRead{usage: usage{snapshot: disk(99)}, w: w}
	now := time.Unix(1_800_000_000, 0)

	w.Check(ctx, now)
	if got := w.Active("nas"); len(got) != 0 {
		t.Fatalf("active = %+v, want none of the forgotten device", got)
	}
	if log, err := w.Log(ctx); err != nil || len(log) != 0 {
		t.Fatalf("log = %+v, %v; want none", log, err)
	}

	// Added again under the same name, the device has alerts again.
	targets[0].Usage = &usage{snapshot: disk(99)}
	w.Check(ctx, now.Add(Interval))
	if got := w.Active("nas"); len(got) != 1 {
		t.Errorf("active of the device added again = %+v, want its disk", got)
	}
}
