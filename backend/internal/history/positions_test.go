package history

import (
	"context"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func TestWiFiPositionsCombineThePhonesScansByPlace(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	point := func(at time.Time, lat, lon, accuracy float64) RoutePoint {
		return RoutePoint{PhoneTime: at.UnixMilli(), Time: at.UnixMilli(), Lat: lat, Lon: lon, Accuracy: accuracy}
	}
	// The first phone stays at home from 10:00, then goes to the café 2 km
	// away at 10:30; its position at 11:00 is too vague to tell.
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{
		point(hour, 53.5755, 9.9530, 20),
		point(hour.Add(30*time.Minute), 53.5612, 9.9615, 30),
		point(hour.Add(60*time.Minute), 53.5612, 9.9615, 1500),
	}); err != nil {
		t.Fatal(err)
	}
	// The second phone is at home too, 40 m off, from 10:10.
	if err := store.AddRoutePoints(ctx, "galaxy", []RoutePoint{point(hour.Add(10*time.Minute), 53.5758, 9.9533, 15)}); err != nil {
		t.Fatal(err)
	}
	den := func(signal float64) metrics.NearbyAccessPoint {
		return metrics.NearbyAccessPoint{ID: "den-5", SSID: "Den", SignalPercent: signal, FrequencyMHz: 5180, Security: "WPA2/WPA3"}
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{
		{At: hour.Add(time.Minute), Found: []metrics.NearbyAccessPoint{den(80), {ID: "den-2", SSID: "Den", SignalPercent: 60, FrequencyMHz: 2437}, {ID: "h1", SignalPercent: 20}}},
		// 15 minutes after the point at home, with none since: still there.
		{At: hour.Add(15 * time.Minute), Found: []metrics.NearbyAccessPoint{den(70), {ID: "cafe", SSID: "Cafe", SignalPercent: 10, Connected: true}}},
		{At: hour.Add(31 * time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "cafe", SSID: "Cafe", SignalPercent: 90, Connected: true}}},
		// Placed by the vague point only, which is left out.
		{At: hour.Add(61 * time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "x", SSID: "Far", SignalPercent: 50}}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "galaxy", []FoundScan{
		{At: hour.Add(12 * time.Minute), Found: []metrics.NearbyAccessPoint{den(95), {ID: "h2", SignalPercent: 30}}},
		// Long after its only point: nowhere.
		{At: hour.Add(50 * time.Minute), Found: []metrics.NearbyAccessPoint{den(50)}},
	}); err != nil {
		t.Fatal(err)
	}

	got, err := store.WiFiPositions(ctx, hour, hour.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d places, want home and the café: %+v", len(got), got)
	}
	home, cafe := got[0], got[1]
	if home.Scans != 3 || home.First != hour.Add(time.Minute).Unix() || home.Last != hour.Add(15*time.Minute).Unix() {
		t.Errorf("home = %d scans from %d to %d", home.Scans, home.First, home.Last)
	}
	if len(home.Devices) != 2 || home.Devices[0] != "pixel" || home.Devices[1] != "galaxy" {
		t.Errorf("home devices = %v", home.Devices)
	}
	if home.Lat < 53.5755 || home.Lat > 53.5758 {
		t.Errorf("home at %v, want between the phones' points", home.Lat)
	}
	// Den heard best by galaxy, both its access points, then the two hidden
	// ones apart, then Cafe.
	if len(home.Networks) != 4 {
		t.Fatalf("home networks = %+v", home.Networks)
	}
	n := home.Networks[0]
	if n.SSID != "Den" || n.SignalPercent != 95 || n.AccessPoints != 2 || len(n.FrequenciesMHz) != 2 || n.FrequenciesMHz[0] != 2437 || n.Security != "WPA2/WPA3" || n.Last != hour.Add(15*time.Minute).Unix() {
		t.Errorf("Den = %+v", n)
	}
	if len(n.Devices) != 2 || n.Devices[0] != (PositionSighting{Device: "galaxy", SignalPercent: 95, Last: hour.Add(12 * time.Minute).Unix(), Scans: 1}) ||
		n.Devices[1] != (PositionSighting{Device: "pixel", SignalPercent: 80, Last: hour.Add(15 * time.Minute).Unix(), Scans: 2}) {
		t.Errorf("Den heard by %+v", n.Devices)
	}
	if home.Networks[1].ID != "h2" || home.Networks[1].SSID != "" || home.Networks[2].ID != "h1" {
		t.Errorf("hidden networks = %+v, %+v", home.Networks[1], home.Networks[2])
	}
	if c := home.Networks[3]; c.SSID != "Cafe" || c.ID != "" || !c.Connected {
		t.Errorf("Cafe at home = %+v", c)
	}
	if cafe.Scans != 1 || len(cafe.Networks) != 1 || cafe.Networks[0].SignalPercent != 90 {
		t.Errorf("café = %+v", cafe)
	}
	// Home heard the café's access point too: 1 of the 5 heard at either.
	if len(home.Related) != 1 || home.Related[0] != (RelatedPosition{Place: 1, Shared: 1, Percent: 20}) {
		t.Errorf("home related = %+v", home.Related)
	}
	if len(cafe.Related) != 1 || cafe.Related[0].Place != 0 {
		t.Errorf("café related = %+v", cafe.Related)
	}

	// Only the scans within the range count.
	got, err = store.WiFiPositions(ctx, hour.Add(20*time.Minute), hour.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Networks[0].SSID != "Cafe" {
		t.Errorf("from 10:20 = %+v, want the café only", got)
	}
}

func TestAScanIsPlacedAtThePointClosestInTime(t *testing.T) {
	at := func(minutes int64) int64 { return minutes * 60_000 }
	route := []positionPoint{{time: at(0), lat: 1}, {time: at(10), lat: 2}, {time: at(40), lat: 3}}
	for _, c := range []struct {
		minutes int64
		lat     float64
		found   bool
	}{
		{-6, 0, false}, // more than 5 minutes before the first point
		{-4, 1, true},
		{4, 1, true},
		{7, 2, true},  // the point after is closer
		{25, 2, true}, // 15 minutes after a point, none since
		{31, 0, false},
		{36, 3, true},
		{61, 0, false},
	} {
		p, found := pointAt(route, at(c.minutes))
		if found != c.found || p.lat != c.lat {
			t.Errorf("at %d minutes: %v %v, want %v %v", c.minutes, p.lat, found, c.lat, c.found)
		}
	}
}

func TestPlacesAreFoundAcrossTheCellsOfTheGrid(t *testing.T) {
	var g positionGrouper
	// 60 m apart, on either side of a border of the grid's cells.
	border := float64(cellRow(48.2)+1) * cellSize
	g.add(positionPoint{lat: border - 0.0003, lon: 16.37}, "a", 1, nil)
	g.add(positionPoint{lat: border + 0.00024, lon: 16.37}, "b", 2, nil)
	g.add(positionPoint{lat: border + 0.003, lon: 16.37}, "c", 3, nil)
	if got := g.positions(); len(got) != 2 || got[0].Scans != 2 {
		t.Errorf("places = %+v, want the first two together", got)
	}
}

func TestPlacesWithoutIDsAreRelatedByName(t *testing.T) {
	var g positionGrouper
	g.add(positionPoint{lat: 50, lon: 8}, "a", 1, []ScannedNetwork{{SSID: "Den"}, {SSID: "Cafe"}, {}})
	g.add(positionPoint{lat: 50.01, lon: 8}, "a", 2, []ScannedNetwork{{SSID: "Den"}})
	g.add(positionPoint{lat: 51, lon: 8}, "a", 3, []ScannedNetwork{{SSID: "Elsewhere"}})
	// Equal in scans, the newest first.
	got := g.positions()
	if len(got) != 3 || got[0].Lat != 51 || got[0].Related != nil || len(got[2].Related) != 1 || got[2].Related[0] != (RelatedPosition{Place: 1, Shared: 1, Percent: 50}) {
		t.Errorf("places = %+v", got)
	}
}

func TestWiFiPositionsDropAScanWhoseClosestPointIsVague(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	point := func(at time.Time, lat, lon, accuracy float64) RoutePoint {
		return RoutePoint{PhoneTime: at.UnixMilli(), Time: at.UnixMilli(), Lat: lat, Lon: lon, Accuracy: accuracy}
	}
	// At home at 10:00, then 10 km away at 10:10, told only vaguely.
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{
		point(hour, 53.5755, 9.9530, 20),
		point(hour.Add(10*time.Minute), 53.6655, 9.9530, 800),
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{
		{At: hour.Add(time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "den", SSID: "Den", SignalPercent: 80}}},
		// Made after the phone moved: not at home.
		{At: hour.Add(12 * time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "far", SSID: "Far", SignalPercent: 60}}},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFiPositions(ctx, hour, hour.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Scans != 1 || len(got[0].Networks) != 1 || got[0].Networks[0].SSID != "Den" {
		t.Fatalf("got %+v, want home with only its own scan", got)
	}
	if got[0].AnchorLat != 53.5755 || got[0].AnchorLon != 9.953 {
		t.Errorf("anchor = %v, %v, want the first scan's point", got[0].AnchorLat, got[0].AnchorLon)
	}
}

func TestWiFiPositionsWithoutScans(t *testing.T) {
	store := openTestStore(t)
	got, err := store.WiFiPositions(context.Background(), time.Unix(0, 0), time.Now())
	if err != nil || got == nil || len(got) != 0 {
		t.Fatalf("got %v, %v, want an empty list", got, err)
	}
}

func TestWiFiPositionsPlaceAScanByAPrecisePointInsideAVagueOne(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	point := func(at time.Time, lat, lon, accuracy float64) RoutePoint {
		return RoutePoint{PhoneTime: at.UnixMilli(), Time: at.UnixMilli(), Lat: lat, Lon: lon, Accuracy: accuracy}
	}
	// The phone stays at home: a precise point at 10:00, then the
	// quarter-hourly one at 10:15 is told only vaguely, but covers home.
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{
		point(hour, 53.5755, 9.9530, 20),
		point(hour.Add(15*time.Minute), 53.5765, 9.9530, 300),
	}); err != nil {
		t.Fatal(err)
	}
	// Another phone without scans has points too, which are not needed.
	if err := store.AddRoutePoints(ctx, "galaxy", []RoutePoint{point(hour, 50, 8, 10)}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{
		{At: hour.Add(time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "den", SSID: "Den", SignalPercent: 80}}},
		// Closer in time to the vague point, which home is inside of.
		{At: hour.Add(9 * time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "den", SSID: "Den", SignalPercent: 70}}},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFiPositions(ctx, hour, hour.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Scans != 2 || got[0].Lat != 53.5755 {
		t.Fatalf("got %+v, want both scans at home", got)
	}
}

func TestWiFiPositionsDropAScanAtAVeryVaguePointThatCoversTheOldOne(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	point := func(at time.Time, lat, lon, accuracy float64) RoutePoint {
		return RoutePoint{PhoneTime: at.UnixMilli(), Time: at.UnixMilli(), Lat: lat, Lon: lon, Accuracy: accuracy}
	}
	// Home at 10:00, then 1 km away at 10:14, told within 1,500 m: home is
	// inside, but too far off to tell the phone stayed.
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{
		point(hour, 53.5755, 9.9530, 20),
		point(hour.Add(14*time.Minute), 53.5845, 9.9530, 1500),
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{
		{At: hour.Add(13 * time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "cafe", SSID: "Cafe", SignalPercent: 80}}},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFiPositions(ctx, hour, hour.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("got %+v, want the café scan left out", got)
	}
}
