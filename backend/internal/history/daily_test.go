package history

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestTheDailyAveragesOutlastTheRetention(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	now := time.Now().UTC()
	old := now.Add(-400 * Day).Truncate(Day)
	for i, v := range []float64{10, 20, 30} {
		if err := store.Add(ctx, LocalDevice, old.Add(time.Duration(i)*time.Hour), map[string]float64{MetricCPU: v}); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.Add(ctx, LocalDevice, now.Add(-time.Hour), map[string]float64{MetricCPU: 50}); err != nil {
		t.Fatal(err)
	}

	if _, err := store.DeleteBefore(ctx, now.Add(-30*Day)); err != nil {
		t.Fatal(err)
	}

	reader := Reader{Store: store, Recent: &Recent{}, Device: LocalDevice, Retention: 30 * Day}
	series, step, err := reader.Range(ctx, now.Add(-500*Day), now)
	if err != nil || step%Day != 0 || len(series) != 1 || len(series[0].Points) != 2 {
		t.Fatalf("Range(500 d) = %+v, %v, %v; want two points in whole days", series, step, err)
	}
	if got := series[0].Points[0].Value; got != 20 {
		t.Errorf("the old day's average = %v, want 20", got)
	}
	// Within the retention, the same range of hours still reads the hours.
	recent, step, err := reader.Range(ctx, now.Add(-7*Day), now)
	if err != nil || step != time.Hour || len(recent) != 1 || recent[0].Points[0].Value != 50 {
		t.Errorf("Range(7 d) = %+v, %v, %v; want the hour's value in hours", recent, step, err)
	}
}

func TestDeleteDeviceDeletesItsDailyAverages(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	if err := store.Add(ctx, "nas", time.Now().Add(-time.Hour), map[string]float64{MetricCPU: 1}); err != nil {
		t.Fatal(err)
	}

	if err := store.DeleteDevice(ctx, "nas"); err != nil {
		t.Fatal(err)
	}

	var rows int
	if err := store.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM samples_daily`).Scan(&rows); err != nil || rows != 0 {
		t.Errorf("daily rows = %d, %v; want none", rows, err)
	}
}

func TestOpenFillsTheDailyAveragesFromTheHoursOnce(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "history.db")
	store, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	day := time.Now().Add(-3 * Day).Truncate(Day).Unix()
	// A database from before the daily averages: hours, and no samples_daily.
	if _, err := store.db.ExecContext(ctx, `DROP TABLE samples_daily;
		INSERT INTO samples_hourly (device, time, metric, value, count) VALUES
			('local', ?1, 'cpu', 10, 60), ('local', ?1 + 3600, 'cpu', 40, 20)`, day); err != nil {
		t.Fatal(err)
	}
	_ = store.Close()

	for range 2 {
		store, err = Open(ctx, path)
		if err != nil {
			t.Fatal(err)
		}
		var value float64
		var count int64
		if err := store.db.QueryRowContext(ctx, `SELECT value, count FROM samples_daily WHERE device = 'local' AND time = ?`, day).Scan(&value, &count); err != nil || value != 17.5 || count != 80 {
			t.Errorf("the day = %v over %d, %v; want 17.5 over 80", value, count, err)
		}
		_ = store.Close()
	}
}
