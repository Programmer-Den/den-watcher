package history

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func ap(id string, signal float64) metrics.NearbyAccessPoint {
	return metrics.NearbyAccessPoint{ID: id, SSID: "net-" + id, SignalPercent: signal}
}

func TestTownWiFiPlacesAccessPointsAndThePhonesByThem(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	// The pixel walks north along a street, 100 m a step, and then to a
	// place 3 km away, scanning a minute after each point.
	lat := func(step int) float64 { return 53.5755 + float64(step)*100/metersPerDegree }
	heard := [][]metrics.NearbyAccessPoint{
		{ap("a", 90), ap("hot", 80), {ID: "a", SSID: "net-a", SignalPercent: 90}},
		{ap("a", 30), ap("b", 30)},
		{ap("b", 90), ap("c", 30)},
		{ap("c", 90), ap("d", 30)},
		{ap("d", 90), ap("solo", 60)},
	}
	for step, found := range heard {
		at := hour.Add(time.Duration(step) * 10 * time.Minute)
		if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{routePoint(at, lat(step), 9.953, 20)}); err != nil {
			t.Fatal(err)
		}
		if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{{At: at.Add(time.Minute), Found: found}}); err != nil {
			t.Fatal(err)
		}
	}
	far := hour.Add(2 * time.Hour)
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{routePoint(far, lat(30), 9.953, 20)}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{{At: far.Add(time.Minute), Found: []metrics.NearbyAccessPoint{ap("hot", 80)}}}); err != nil {
		t.Fatal(err)
	}
	// The galaxy has its location off: it hears a well and b a little, and
	// later only networks the hub never placed.
	if err := store.AddPhoneScans(ctx, "galaxy", []FoundScan{
		{At: hour.Add(3 * time.Hour), Found: []metrics.NearbyAccessPoint{ap("a", 90), ap("b", 30)}},
		{At: hour.Add(4 * time.Hour), Found: []metrics.NearbyAccessPoint{ap("solo", 90), ap("new", 50)}},
	}); err != nil {
		t.Fatal(err)
	}

	town, err := store.TownWiFi(ctx, hour, hour.Add(5*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if town.Learned != 6 || town.LearnedFrom != hour.Add(time.Minute).Unix() {
		t.Errorf("learned from %d scans since %d, want the pixel's 6", town.Learned, town.LearnedFrom)
	}
	if town.Moving != 1 || town.Once != 1 {
		t.Errorf("moving %d, once %d, want the hotspot and solo", town.Moving, town.Once)
	}
	placed := map[string]TownAccessPoint{}
	for _, a := range town.AccessPoints {
		placed[a.ID] = a
	}
	if len(placed) != 4 || placed["a"].SSID != "net-a" || placed["a"].Points != 2 || placed["a"].Scans != 2 {
		t.Fatalf("placed = %+v, want a to d", town.AccessPoints)
	}
	// a was heard well at the first point and weakly 100 m on: close to the first.
	if d := distanceMeters(placed["a"].Lat, placed["a"].Lon, lat(0), 9.953); d > 15 {
		t.Errorf("a is %.0f m from where it was heard well, want close to it", d)
	}

	if len(town.Tracks) != 2 || town.Tracks[0].Device != "pixel" || town.Tracks[1].Device != "galaxy" {
		t.Fatalf("tracks = %+v", town.Tracks)
	}
	pixel := town.Tracks[0].Points
	if len(pixel) != 6 || pixel[2].GPS == nil || pixel[2].Known != 2 || pixel[2].GPS.OffMeters == 0 || pixel[2].GPS.OffMeters > 100 {
		t.Errorf("pixel's third scan = %+v, want it placed by b and c near its GPS", pixel[2])
	}
	// The far scan heard only the hotspot, which places nothing.
	if last := pixel[5]; last.Known != 0 || last.GPS == nil || last.Lat != 0 {
		t.Errorf("pixel's far scan = %+v, want a gap with its GPS", last)
	}
	galaxy := town.Tracks[1].Points
	between := distanceMeters(galaxy[0].Lat, galaxy[0].Lon, lat(0), 9.953)
	if galaxy[0].Known != 2 || galaxy[0].GPS != nil || between > 60 || galaxy[0].Meters < townMinMeters {
		t.Errorf("galaxy's first scan = %+v (%.0f m from a's point), want it near a, without GPS", galaxy[0], between)
	}
	if galaxy[1].Known != 0 {
		t.Errorf("galaxy's second scan = %+v, want a gap", galaxy[1])
	}
}

func TestTownWiFiIsEmptyWithoutScans(t *testing.T) {
	store := openTestStore(t)
	town, err := store.TownWiFi(context.Background(), time.Unix(0, 0), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if town.Learned != 0 || town.AccessPoints == nil || town.Tracks == nil {
		t.Errorf("town = %+v, want empty lists", town)
	}
}

func TestSpotLeavesOutAScanItLearnedFrom(t *testing.T) {
	var s spot
	p1 := positionPoint{lat: 53.5, lon: 10}
	p2 := positionPoint{lat: 53.5 + 100/metersPerDegree, lon: 10}
	s.add(p1, ScannedNetwork{ID: "a", SignalPercent: 50}, 1)
	s.add(p2, ScannedNetwork{ID: "a", SignalPercent: 50}, 2)
	lat, _, meters, ok := s.at(nil, 0)
	if !ok || math.Abs((lat-53.5)*metersPerDegree-50) > 0.5 || math.Abs(meters-50) > 0.5 {
		t.Errorf("both = %v, %v m, want the middle, heard 50 m around", lat, meters)
	}
	lat, _, meters, ok = s.at(&p1, 50)
	if !ok || math.Abs(lat-p2.lat) > 1e-9 || meters != townMinMeters {
		t.Errorf("without the first = %v, %v m, want the second point", lat, meters)
	}
	s2 := spot{}
	s2.add(p1, ScannedNetwork{ID: "a", SignalPercent: 50}, 1)
	if _, _, _, ok := s2.at(&p1, 50); ok {
		t.Error("a spot without its only scan places something")
	}
}
