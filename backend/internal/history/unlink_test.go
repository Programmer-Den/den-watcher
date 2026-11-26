package history

import (
	"context"
	"testing"
	"time"
)

func TestUnlinkPhoneDataKeepsTheRouteAndWiFiButNotWhoseTheyWere(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	for _, phone := range []string{"pixel", "other"} {
		if err := store.AddRoutePoints(ctx, phone, []RoutePoint{{PhoneTime: 1, Time: ms(hour), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
			t.Fatal(err)
		}
		if err := store.AddPhoneScans(ctx, phone, []FoundScan{{At: hour}}); err != nil {
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
	if !IsRemovedPhone(unlinked) {
		t.Fatalf("route kept under %q, want an id of a removed phone", unlinked)
	}
	for _, table := range []string{"route_points", "phone_scans", "wifi_connections"} {
		if n := count(`SELECT COUNT(*) FROM `+table+` WHERE device = ?`, unlinked); n != 1 {
			t.Errorf("%d rows of %s under %q, want 1", n, table, unlinked)
		}
	}
	if n := count(`SELECT COUNT(*) FROM app_uses WHERE device != 'other'`); n != 0 {
		t.Errorf("%d app uses kept, want none", n)
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
