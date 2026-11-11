package history

import (
	"context"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func TestPhoneScansAreReadClosestToATime(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	dbm := -48.0
	first := []metrics.NearbyAccessPoint{
		{ID: "a", SSID: "Cafe", SignalPercent: 40, FrequencyMHz: 2437, Security: "Open"},
		{ID: "b", SSID: "Den", SignalPercent: 80, SignalDBm: &dbm, FrequencyMHz: 5180, Security: "WPA2/WPA3", Generation: 6, Connected: true},
	}
	if err := store.AddPhoneScan(ctx, "pixel", hour, first); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScan(ctx, "pixel", hour.Add(5*time.Minute), first[:1]); err != nil {
		t.Fatal(err)
	}
	// One sent again is kept as it is.
	if err := store.AddPhoneScan(ctx, "pixel", hour, nil); err != nil {
		t.Fatal(err)
	}

	got, err := store.PhoneScanNear(ctx, "pixel", hour.Add(2*time.Minute), 5*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Time != hour.Unix() || len(got.Networks) != 2 {
		t.Fatalf("scan = %+v, want the one at the hour with both networks", got)
	}
	// The strongest first, with what the page shows of it.
	if n := got.Networks[0]; n.SSID != "Den" || !n.Connected || n.SignalDBm == nil || *n.SignalDBm != dbm || n.Generation != 6 {
		t.Errorf("first network = %+v", n)
	}
	if got, err := store.PhoneScanNear(ctx, "pixel", hour.Add(4*time.Minute), 5*time.Minute); err != nil || got == nil || got.Time != hour.Add(5*time.Minute).Unix() {
		t.Errorf("scan closest to 10:04 = %+v, %v; want the one at 10:05", got, err)
	}
	if got, err := store.PhoneScanNear(ctx, "pixel", hour.Add(time.Hour), 5*time.Minute); err != nil || got != nil {
		t.Errorf("scan an hour later = %+v, %v; want none", got, err)
	}
	if got, err := store.PhoneScanNear(ctx, "other", hour, 5*time.Minute); err != nil || got != nil {
		t.Errorf("scan of another phone = %+v, %v; want none", got, err)
	}

	if _, err := store.DeleteBefore(ctx, hour.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if got, err := store.PhoneScanNear(ctx, "pixel", hour, 5*time.Minute); err != nil || got == nil || got.Time != hour.Add(5*time.Minute).Unix() {
		t.Errorf("after the retention: %+v, %v; want only the later scan", got, err)
	}
	if err := store.DeleteDevice(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if got, err := store.PhoneScanNear(ctx, "pixel", hour, time.Hour); err != nil || got != nil {
		t.Errorf("after the device was deleted: %+v, %v; want none", got, err)
	}
}
