package history

import (
	"context"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func openBatchedStore(t *testing.T) *Store {
	t.Helper()
	store := openTestStore(t)
	store.SetFlushInterval(10 * time.Minute)
	return store
}

func TestMinutesWaitForTheFlushAndReadsSeeThem(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	start := time.Unix(1_800_000_000, 0)
	for i := range 5 {
		if err := store.Add(ctx, LocalDevice, start.Add(time.Duration(i)*time.Minute), map[string]float64{MetricCPU: float64(10 * (i + 1))}); err != nil {
			t.Fatal(err)
		}
	}
	if got := countRows(t, store, "history_minutes", LocalDevice); got != 0 {
		t.Fatalf("%d minutes written before the flush, want none", got)
	}

	want := []Series{{Metric: MetricCPU, Points: []Point{{start.Unix(), 15}, {start.Unix() + 120, 35}, {start.Unix() + 240, 50}}}}
	got, err := store.Range(ctx, LocalDevice, start, start.Add(5*time.Minute), 2*time.Minute)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Errorf("Range() before the flush = %+v, %v; want %+v", got, err, want)
	}
	if newest, ok, err := store.Newest(ctx, LocalDevice); err != nil || !ok || !newest.Equal(start.Add(4*time.Minute)) {
		t.Errorf("Newest() = %v, %v, %v; want the last minute that waits", newest, ok, err)
	}
	minutes, more, err := Reader{Store: store, Device: LocalDevice}.Since(ctx, "", start.Add(time.Minute), 10, 100)
	if err != nil || more || len(minutes) != 3 || minutes[0].Time != start.Unix()+120 {
		t.Errorf("Since() = %+v, %v, %v; want the 3 minutes after the first two", minutes, more, err)
	}

	if err := store.Flush(ctx); err != nil {
		t.Fatalf("Flush() error = %v", err)
	}
	if got := countRows(t, store, "history_minutes", LocalDevice); got != 5 {
		t.Errorf("%d minutes after the flush, want 5", got)
	}
	again, err := store.Range(ctx, LocalDevice, start, start.Add(5*time.Minute), 2*time.Minute)
	if err != nil || !reflect.DeepEqual(again, want) {
		t.Errorf("Range() after the flush = %+v, %v; want the same", again, err)
	}
}

func TestAFlushAveragesEachHourOnceForAllItsMinutes(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	hour := time.Unix(1_800_000_000, 0)
	for i := range 10 {
		at := hour.Add(time.Duration(i) * time.Minute)
		for _, device := range []string{LocalDevice, "nas"} {
			if err := store.Add(ctx, device, at, map[string]float64{MetricCPU: float64(i)}); err != nil {
				t.Fatal(err)
			}
		}
	}
	// A late value for a minute that waits: the others are not counted twice.
	if err := store.Add(ctx, LocalDevice, hour, map[string]float64{MetricCPU: 99, MetricResponse: 5}); err != nil {
		t.Fatal(err)
	}

	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}

	got, err := store.Range(ctx, LocalDevice, hour, hour.Add(time.Hour), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	want := []Series{
		{Metric: MetricCPU, Points: []Point{{hour.Unix(), 4.5}}},
		{Metric: MetricResponse, Points: []Point{{hour.Unix(), 5}}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Range(1 h) = %+v, want %+v", got, want)
	}
	var rows, count int
	if err := store.db.QueryRow(`SELECT COUNT(*), SUM(count) FROM samples_hourly WHERE device = ? AND metric = ?`, LocalDevice, MetricCPU).Scan(&rows, &count); err != nil || rows != 1 || count != 10 {
		t.Errorf("hourly rows of the cpu = %d over %d values, %v; want 1 over 10", rows, count, err)
	}
}

func TestAFailedFlushKeepsTheMinutes(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	at := time.Unix(1_800_000_000, 0)
	if err := store.Add(ctx, LocalDevice, at, map[string]float64{MetricCPU: 7}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.db.Exec(`DROP TABLE history_minutes`); err != nil {
		t.Fatal(err)
	}

	if err := store.Flush(ctx); err == nil {
		t.Fatal("Flush() without a table succeeded, want an error")
	}
	if got, err := store.Range(ctx, LocalDevice, at, at.Add(time.Minute), time.Minute); err != nil && len(got) != 0 {
		t.Fatal(err)
	}

	if _, err := store.db.Exec(packedSchema); err != nil {
		t.Fatal(err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatalf("Flush() error = %v", err)
	}
	if got := countRows(t, store, "history_minutes", LocalDevice); got != 1 {
		t.Errorf("%d minutes after the second flush, want the one that waited", got)
	}
}

func TestCloseWritesTheMinutesThatWait(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "history.db")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	store.SetFlushInterval(time.Hour)
	at := time.Unix(1_800_000_000, 0)
	if err := store.Add(ctx, LocalDevice, at, map[string]float64{MetricCPU: 3}); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}

	store, err = Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()
	if newest, ok, err := store.Newest(ctx, LocalDevice); err != nil || !ok || !newest.Equal(at) {
		t.Errorf("Newest() after a restart = %v, %v, %v; want %v", newest, ok, err, at)
	}
}

func TestDeleteDeviceForgetsItsMinutesThatWait(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	at := time.Unix(1_800_000_000, 0)
	for _, device := range []string{LocalDevice, "nas"} {
		if err := store.Add(ctx, device, at, map[string]float64{MetricCPU: 3}); err != nil {
			t.Fatal(err)
		}
	}

	if err := store.DeleteDevice(ctx, "nas"); err != nil {
		t.Fatal(err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}

	if got := countRows(t, store, "history_minutes", "nas"); got != 0 {
		t.Errorf("%d minutes of the deleted device, want none", got)
	}
	if got := countRows(t, store, "history_minutes", LocalDevice); got != 1 {
		t.Errorf("%d minutes of the other device, want 1", got)
	}
}

func TestTooManyMinutesAreWrittenAtOnce(t *testing.T) {
	store := openBatchedStore(t)
	addMany(t, store, LocalDevice, time.Unix(1_800_000_000, 0), maxPendingMinutes+1)
	if got := countRows(t, store, "history_minutes", LocalDevice); got != maxPendingMinutes+1 {
		t.Errorf("%d minutes written, want all %d at once", got, maxPendingMinutes+1)
	}
}

func TestTheFlusherWritesEveryInterval(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	store := openTestStore(t)
	store.SetFlushInterval(10 * time.Millisecond)
	done := make(chan struct{})
	go func() { store.RunFlusher(ctx); close(done) }()
	if err := store.Add(ctx, LocalDevice, time.Unix(1_800_000_000, 0), map[string]float64{MetricCPU: 3}); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(5 * time.Second)
	for countRows(t, store, "history_minutes", LocalDevice) == 0 {
		if time.Now().After(deadline) {
			t.Fatal("the flusher wrote nothing within 5 seconds")
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	<-done
}

func TestSinceHandsOutMinutesThatWaitAfterTheStoredOnes(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	start := time.Unix(1_800_000_000, 0)
	addMany(t, store, LocalDevice, start, 2)
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	addMany(t, store, LocalDevice, start.Add(2*time.Minute), 2)

	reader := Reader{Store: store, Device: LocalDevice}
	minutes, more, err := reader.Since(ctx, "", start.Add(-time.Minute), 3, 100)
	if err != nil || !more || len(minutes) != 3 || minutes[2].Time != start.Unix()+120 {
		t.Errorf("Since(3 minutes) = %+v, %v, %v; want the 2 stored and the first that waits, and more", minutes, more, err)
	}
	minutes, more, err = reader.Since(ctx, "", start.Add(time.Minute), 10, 100)
	if err != nil || more || len(minutes) != 2 {
		t.Errorf("Since(after the second) = %+v, %v, %v; want the last 2, no more", minutes, more, err)
	}
	minutes, more, err = reader.Since(ctx, "", start.Add(-time.Minute), 10, 5)
	if err != nil || !more || len(minutes) != 1 {
		t.Errorf("Since(5 values) = %d minutes, %v, %v; want one minute (4 values) and more", len(minutes), more, err)
	}
}

func TestRangeCountsAMinuteThatIsStoredAndWaitingOnce(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	at := time.Unix(1_800_000_000, 0)
	if err := store.Add(ctx, LocalDevice, at, map[string]float64{MetricCPU: 10}); err != nil {
		t.Fatal(err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	// As between a flush's commit and its end, or a late value of the same
	// minute: the stored value counts, the new metric is added.
	store.pend.add(LocalDevice, []Minute{{Time: at.Unix(), Values: map[string]float64{MetricCPU: 99, MetricMemory: 40}}})

	got, err := store.Range(ctx, LocalDevice, at, at.Add(time.Minute), time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	want := []Series{
		{Metric: MetricCPU, Points: []Point{{at.Unix(), 10}}},
		{Metric: MetricMemory, Points: []Point{{at.Unix(), 40}}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Range() = %+v, want %+v", got, want)
	}
}

func TestFailingWritesKeepABoundedNumberOfMinutes(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	if _, err := store.db.Exec(`DROP TABLE history_minutes`); err != nil {
		t.Fatal(err)
	}
	start := time.Unix(1_800_000_000, 0)
	var minutes []Minute
	for i := range maxPendingMinutes + 10 {
		minutes = append(minutes, Minute{Time: start.Unix() + int64(i)*60, Values: map[string]float64{MetricCPU: 1}})
	}

	if err := store.AddMinutes(ctx, LocalDevice, minutes); err == nil {
		t.Fatal("AddMinutes() without a table succeeded, want the error of its flush")
	}

	if store.pend.count != maxPendingMinutes/2 {
		t.Errorf("%d minutes wait, want %d", store.pend.count, maxPendingMinutes/2)
	}
	if newest, ok := store.pend.newest(LocalDevice); !ok || newest != minutes[len(minutes)-1].Time {
		t.Errorf("newest minute that waits = %d, %v; want the newest added, %d", newest, ok, minutes[len(minutes)-1].Time)
	}
}

func TestDeleteBeforeDropsWaitingMinutesOlderThanTheRetention(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	start := time.Unix(1_800_000_000, 0)
	addMany(t, store, LocalDevice, start, 10)

	if _, err := store.DeleteBefore(ctx, start.Add(4*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}

	if got := countRows(t, store, "history_minutes", LocalDevice); got != 6 {
		t.Errorf("%d minutes written, want the 6 within the retention", got)
	}
}

func TestDeleteBeforeWaitsForAFlushThatIsWriting(t *testing.T) {
	ctx := context.Background()
	store := openBatchedStore(t)
	// A flush writing minutes older than the retention would bring them back
	// after they were deleted.
	store.flushing.Lock()
	done := make(chan error)
	go func() {
		_, err := store.DeleteBefore(ctx, time.Unix(1_800_000_000, 0))
		done <- err
	}()
	select {
	case <-done:
		t.Fatal("DeleteBefore() ran while a flush was writing")
	case <-time.After(50 * time.Millisecond):
	}
	store.flushing.Unlock()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}
