package history

import (
	"context"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// nearby is what a device's Wi-Fi sees: access points by ID, each with its
// signal; the first one is connected to.
func nearby(signals ...float64) *metrics.NearbyWiFi {
	ids := []string{"0000000000aa", "0000000000bb"}
	n := &metrics.NearbyWiFi{AccessPoints: []metrics.NearbyAccessPoint{}}
	for i, signal := range signals {
		n.AccessPoints = append(n.AccessPoints, metrics.NearbyAccessPoint{
			ID: ids[i], Box: "00000000000b", SSID: "Den", SignalPercent: signal, SignalDBm: new(signal - 110),
			FrequencyMHz: 5180, WidthMHz: 80, Security: "WPA2", Generation: 6, Connected: i == 0,
		})
	}
	return n
}

func TestWiFiAddsUpEachHourAcrossFlushes(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	hour := time.Now().Truncate(time.Hour).Add(-2 * time.Hour)
	store.AddWiFi("a", hour.Add(time.Minute), nearby(60, 30))
	store.AddWiFi("a", hour.Add(2*time.Minute), nearby(80))
	store.AddWiFi("b", hour.Add(time.Minute), nearby(40))
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	// After a restart in the same hour, the readings add to those stored.
	store.AddWiFi("a", hour.Add(3*time.Minute), nearby(70, 50))
	store.AddWiFi("a", hour.Add(time.Hour), nearby(20))
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}

	got, err := store.WiFi(ctx, hour, hour.Add(2*time.Hour), time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if got.StepSeconds != 3600 {
		t.Errorf("StepSeconds = %d, want a whole hour", got.StepSeconds)
	}
	if len(got.Devices) != 2 || got.Devices[0].Device != "a" || len(got.Devices[0].Steps) != 2 || got.Devices[0].Steps[0].Readings != 3 {
		t.Fatalf("Devices = %+v, want a with 3 readings in the first hour and one in the next, and b", got.Devices)
	}
	if len(got.AccessPoints) != 2 {
		t.Fatalf("AccessPoints = %+v, want two", got.AccessPoints)
	}
	ap := got.AccessPoints[0]
	if ap.ID != "0000000000aa" || ap.SSID != "Den" || ap.FrequencyMHz != 5180 || ap.Security != "WPA2" || ap.FirstSeen != hour.Unix() || ap.LastSeen != hour.Add(time.Hour).Unix() {
		t.Errorf("AccessPoints[0] = %+v", ap)
	}
	if len(ap.SeenBy) != 2 || ap.SeenBy[0].Device != "a" || len(ap.SeenBy[0].Points) != 2 {
		t.Fatalf("SeenBy = %+v, want a in two hours and b", ap.SeenBy)
	}
	first := ap.SeenBy[0].Points[0]
	if first.Seen != 3 || first.Connected != 3 || first.SignalPercent != 70 || first.MinPercent != 60 || first.MaxPercent != 80 ||
		first.SignalDBm == nil || *first.SignalDBm != -40 || first.FrequencyMHz != 5180 {
		t.Errorf("a's first hour = %+v, want seen 3 times at 70%% on average from 60 to 80, -40 dBm, on 5180 MHz", first)
	}
	other := got.AccessPoints[1].SeenBy[0].Points[0]
	if other.Seen != 2 || other.Connected != 0 || other.SignalPercent != 40 {
		t.Errorf("the other access point = %+v, want seen twice at 40%% and not connected to", other)
	}
}

func TestWiFiOfLongerStepsAddsUpTheirHours(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	day := time.Now().Truncate(24 * time.Hour).Add(-48 * time.Hour)
	store.AddWiFi("a", day.Add(time.Hour), nearby(60))
	store.AddWiFi("a", day.Add(3*time.Hour), nearby(40))
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFi(ctx, day, day.Add(24*time.Hour), 90*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if got.StepSeconds != 7200 {
		t.Errorf("StepSeconds = %d, want 90 minutes rounded up to two hours", got.StepSeconds)
	}
	points := got.AccessPoints[0].SeenBy[0].Points
	if len(points) != 2 || points[0].Time != day.Unix() || points[1].Time != day.Add(2*time.Hour).Unix() {
		t.Errorf("points = %+v, want one in each two-hour step", points)
	}
}

func TestWiFiIsDeletedWithTheDeviceAndAfterTheRetention(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	old := time.Now().Add(-10 * 24 * time.Hour)
	store.AddWiFi("a", old, nearby(60))
	store.AddWiFi("a", time.Now(), nearby(60))
	store.AddWiFi("b", time.Now(), nearby(60))
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := store.DeleteBefore(ctx, time.Now().Add(-24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if got := countRows(t, store, "wifi_hours", "a"); got != 1 {
		t.Errorf("a has %d hours left, want the old one deleted", got)
	}
	if got := countRows(t, store, "wifi_scans", "a"); got != 1 {
		t.Errorf("a has %d hours of readings left, want the old one deleted", got)
	}
	store.AddWiFi("b", time.Now(), nearby(60))
	if err := store.DeleteDevice(ctx, "b"); err != nil {
		t.Fatal(err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	if got := countRows(t, store, "wifi_hours", "b") + countRows(t, store, "wifi_scans", "b"); got != 0 {
		t.Errorf("b has %d rows left, want none, also of the readings that waited", got)
	}
}

func TestRecorderKeepsWhatTheWiFiSeesOncePerReading(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	now := time.Now().Truncate(time.Second)
	recorder := &Recorder{
		Store:  store,
		Recent: &Recent{},
		Collector: &sequenceCollector{[]metrics.Snapshot{
			{Time: now.Add(-10 * time.Second), WiFiNearby: nearby(60)},
			// The same reading again, as when a page asked meanwhile.
			{Time: now.Add(-10 * time.Second), WiFiNearby: nearby(60)},
			// Without the Wi-Fi add-on.
			{Time: now.Add(-5 * time.Second)},
		}},
		Device: "a",
		WiFi:   store,
	}
	for range 3 {
		recorder.read(ctx)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFi(ctx, now.Add(-time.Hour), now.Add(time.Second), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Devices) != 1 || got.Devices[0].Steps[len(got.Devices[0].Steps)-1].Readings != 1 {
		t.Errorf("Devices = %+v, want one reading with the Wi-Fi", got.Devices)
	}
}

func TestWiFiGivesAnAccessPointAsItWasLastSeen(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	hour := time.Now().Truncate(time.Hour).Add(-3 * time.Hour)
	moved := nearby(60)
	moved.AccessPoints[0].FrequencyMHz, moved.AccessPoints[0].Security = 5500, "WPA2/WPA3"
	store.AddWiFi("a", hour.Add(time.Hour), nearby(60))
	store.AddWiFi("a", hour.Add(2*time.Hour), moved)
	// An earlier hour, stored after the later ones.
	store.AddWiFi("b", hour, nearby(60))
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFi(ctx, hour, hour.Add(3*time.Hour), time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.AccessPoints) != 1 {
		t.Fatalf("AccessPoints = %+v, want one", got.AccessPoints)
	}
	ap := got.AccessPoints[0]
	if ap.FrequencyMHz != 5500 || ap.Security != "WPA2/WPA3" || ap.FirstSeen != hour.Unix() || ap.LastSeen != hour.Add(2*time.Hour).Unix() {
		t.Errorf("AccessPoint = %+v, want it on 5500 MHz with WPA2/WPA3 as last seen, first seen in the first hour", ap)
	}
}
