package history

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func TestUnlinkPhoneDataKeepsTheRouteAndScansButNotWhoseTheyWere(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	for _, phone := range []string{"pixel", "other"} {
		if err := store.AddRoutePoints(ctx, phone, []RoutePoint{{PhoneTime: 1, Time: ms(hour), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
			t.Fatal(err)
		}
		found := []metrics.NearbyAccessPoint{
			{SSID: "Den", SignalPercent: 80, Connected: true},
			{SSID: "Café", SignalPercent: 40},
		}
		if err := store.AddPhoneScans(ctx, phone, []FoundScan{{At: hour, Found: found}}); err != nil {
			t.Fatal(err)
		}
		if err := store.AddWiFiConnections(ctx, phone, []WiFiConnection{{SSID: "Den", PhoneStart: 1, Start: ms(hour), End: ms(hour.Add(time.Minute))}}); err != nil {
			t.Fatal(err)
		}
		if err := store.AddAppUses(ctx, phone, []AppUse{{App: "chat", PhoneStart: 1, Start: ms(hour), Millis: 1000}}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := store.DeleteRoute(ctx, "pixel", hour.Add(time.Hour), hour.Add(2*time.Hour), kept); err != nil {
		t.Fatal(err)
	}

	if err := store.NoteUnlink(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if err := store.UnlinkPhoneData(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}

	count := func(query string, args ...any) int {
		t.Helper()
		var n int
		if err := store.DB().QueryRowContext(ctx, query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	for _, table := range []string{"route_points", "phone_scans", "wifi_connections", "app_uses", "route_deleted"} {
		if n := count(`SELECT COUNT(*) FROM ` + table + ` WHERE device = 'pixel'`); n != 0 {
			t.Errorf("%d rows of %s left under the phone, want none", n, table)
		}
		if n := count(`SELECT COUNT(*) FROM ` + table + ` WHERE device = 'other'`); n != 1 && table != "route_deleted" {
			t.Errorf("%d rows of %s of the other phone, want 1", n, table)
		}
	}
	// The route and Wi-Fi stay, together under one new id.
	var unlinked string
	if err := store.DB().QueryRowContext(ctx, `SELECT device FROM route_points WHERE device != 'other'`).Scan(&unlinked); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(unlinked, RemovedPhonePrefix) {
		t.Fatalf("route kept under %q, want an id of a removed phone", unlinked)
	}
	for _, table := range []string{"route_points", "phone_scans"} {
		if n := count(`SELECT COUNT(*) FROM `+table+` WHERE device = ?`, unlinked); n != 1 {
			t.Errorf("%d rows of %s under %q, want 1", n, table, unlinked)
		}
	}
	// Which network it was connected to goes from its scans; the networks stay, in order.
	var networks string
	if err := store.DB().QueryRowContext(ctx, `SELECT networks FROM phone_scans WHERE device = ?`, unlinked).Scan(&networks); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(networks, "connected") || strings.Index(networks, "Den") > strings.Index(networks, "Café") || !strings.Contains(networks, `"signalPercent":80`) {
		t.Errorf("networks kept as %s, want both, in order, without which one it was connected to", networks)
	}
	if n := count(`SELECT COUNT(*) FROM phone_scans WHERE device = 'other' AND networks LIKE '%connected%'`); n != 1 {
		t.Errorf("the other phone's scan lost its connected network")
	}
	for _, table := range []string{"app_uses", "wifi_connections"} {
		if n := count(`SELECT COUNT(*) FROM ` + table + ` WHERE device != 'other'`); n != 0 {
			t.Errorf("%d rows of %s kept, want none", n, table)
		}
	}
	// What a phone added again under the same id sends is its own and kept.
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{{PhoneTime: 2, Time: ms(hour.Add(90 * time.Minute)), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
		t.Fatal(err)
	}
	if points, _, err := store.RoutePoints(ctx, "pixel", hour.Add(-time.Hour), hour.Add(3*time.Hour)); err != nil || len(points) != 1 {
		t.Errorf("RoutePoints() of the new phone = %v, %v; want only its own point", points, err)
	}
}

func TestUnlinkPhoneDataMovesMoreThanAChunk(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	start := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	points := make([]RoutePoint, deleteChunkRows+1)
	for i := range points {
		points[i] = RoutePoint{PhoneTime: int64(i), Time: start.Add(time.Duration(i) * time.Second).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}
	}
	if err := store.AddRoutePoints(ctx, "pixel", points); err != nil {
		t.Fatal(err)
	}
	if err := store.NoteUnlink(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if err := store.UnlinkPhoneData(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	var left, moved int
	if err := store.DB().QueryRowContext(ctx, `SELECT COUNT(*) FILTER (WHERE device = 'pixel'), COUNT(*) FILTER (WHERE device != 'pixel') FROM route_points`).Scan(&left, &moved); err != nil {
		t.Fatal(err)
	}
	if left != 0 || moved != len(points) {
		t.Errorf("%d points left, %d moved; want all %d moved", left, moved, len(points))
	}
}

func TestUnlinkPhoneDataGoesOnUnderTheSameIDAfterItWasCutShort(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{{PhoneTime: 1, Time: hour.UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
		t.Fatal(err)
	}
	// Cut short after the route moved: its scans are still the phone's.
	if _, err := store.DB().ExecContext(ctx, `INSERT INTO phone_unlinking (device, unlinked) VALUES ('pixel', 'removed:0000000000000001')`); err != nil {
		t.Fatal(err)
	}
	if _, err := store.DB().ExecContext(ctx, `UPDATE route_points SET device = 'removed:0000000000000001'`); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{{At: hour}}); err != nil {
		t.Fatal(err)
	}
	if err := store.UnlinkPhoneData(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	var device string
	if err := store.DB().QueryRowContext(ctx, `SELECT device FROM phone_scans`).Scan(&device); err != nil {
		t.Fatal(err)
	}
	if device != "removed:0000000000000001" {
		t.Errorf("scans moved to %q, want the id the route moved to", device)
	}
	var left int
	if err := store.DB().QueryRowContext(ctx, `SELECT COUNT(*) FROM phone_unlinking`).Scan(&left); err != nil {
		t.Fatal(err)
	}
	if left != 0 {
		t.Errorf("%d moves still noted, want none once done", left)
	}
}

func TestUnlinkPhoneDataMovesNothingThatIsNotNoted(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	// A phone added again once its old data moved: a late second call leaves
	// its new data alone.
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{{PhoneTime: 1, Time: hour.UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
		t.Fatal(err)
	}
	if err := store.UnlinkPhoneData(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if points, _, err := store.RoutePoints(ctx, "pixel", hour.Add(-time.Hour), hour.Add(time.Hour)); err != nil || len(points) != 1 {
		t.Errorf("RoutePoints() = %v, %v; want the phone's point still its own", points, err)
	}
	if unlinking, err := store.Unlinking(ctx, "pixel"); err != nil || unlinking {
		t.Errorf("Unlinking() = %v, %v; want nothing noted", unlinking, err)
	}
}

func TestPhoneDataDevicesListsEachPhoneOnceButNotRemovedOnes(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	for i, device := range []string{"pixel", "galaxy", "pixel", RemovedPhonePrefix + "0000000000000001"} {
		if err := store.AddRoutePoints(ctx, device, []RoutePoint{{PhoneTime: int64(i), Time: hour.UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.AddAppUses(ctx, "moto", []AppUse{{App: "chat", PhoneStart: 1, Start: hour.UnixMilli(), Millis: 1000}}); err != nil {
		t.Fatal(err)
	}
	got, err := store.PhoneDataDevices(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"galaxy", "pixel", "moto"}; !slices.Equal(got, want) {
		t.Errorf("PhoneDataDevices() = %v, want %v", got, want)
	}
}

func TestNoteUnlinkNotesOnlyAPhone(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	if err := store.NoteUnlink(ctx, "nas"); err != nil {
		t.Fatal(err)
	}
	if unlinking, err := store.Unlinking(ctx, "nas"); err != nil || unlinking {
		t.Errorf("Unlinking() of a device without data of a phone = %v, %v; want false", unlinking, err)
	}
}

func TestWiFiPositionsWaitForTheScansOfAPhoneWhosePointsAreMoving(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	const unlinked = RemovedPhonePrefix + "0000000000000001"
	// Its scans moved, its points not yet.
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{routePoint(hour, 53.5755, 9.9530, 20)}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, unlinked, []FoundScan{{At: hour.Add(time.Minute), Found: []metrics.NearbyAccessPoint{{ID: "den", SSID: "Den", SignalPercent: 80}}}}); err != nil {
		t.Fatal(err)
	}
	if _, err := store.DB().ExecContext(ctx, `INSERT INTO phone_unlinking (device, unlinked) VALUES ('pixel', ?)`, unlinked); err != nil {
		t.Fatal(err)
	}
	if _, err := store.DB().ExecContext(ctx, `UPDATE route_points SET device = ?`, unlinked); err != nil {
		t.Fatal(err)
	}
	if got, err := store.WiFiPositions(ctx, hour, hour.Add(time.Hour)); err != nil || len(got) != 0 {
		t.Errorf("WiFiPositions() while moving = %+v, %v; want none", got, err)
	}
	if town, err := store.TownWiFi(ctx, hour, hour.Add(time.Hour)); err != nil || len(town.Tracks) != 0 {
		t.Errorf("TownWiFi() tracks while moving = %+v, %v; want none", town.Tracks, err)
	}
	if err := store.UnlinkPhoneData(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if got, err := store.WiFiPositions(ctx, hour, hour.Add(time.Hour)); err != nil || len(got) != 1 || got[0].Devices[0] != unlinked {
		t.Errorf("WiFiPositions() once moved = %+v, %v; want the removed phone's place", got, err)
	}
}

func TestUnlinkPhoneDataMovesAScanThatIsNoListOfNetworks(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{{At: time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)}}); err != nil {
		t.Fatal(err)
	}
	for _, networks := range []string{`["x",{"ssid":"Den","connected":true}]`, `"x"`, `not json`} {
		if _, err := store.DB().ExecContext(ctx, `UPDATE phone_scans SET device = 'pixel', networks = ?`, networks); err != nil {
			t.Fatal(err)
		}
		if err := store.NoteUnlink(ctx, "pixel"); err != nil {
			t.Fatal(err)
		}
		if err := store.UnlinkPhoneData(ctx, "pixel"); err != nil {
			t.Fatalf("UnlinkPhoneData() with networks %s: %v", networks, err)
		}
		var moved string
		if err := store.DB().QueryRowContext(ctx, `SELECT networks FROM phone_scans`).Scan(&moved); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(moved, "connected") {
			t.Errorf("networks %s moved as %s, want without connected", networks, moved)
		}
	}
}
