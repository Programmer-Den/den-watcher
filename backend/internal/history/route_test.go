package history

import (
	"context"
	"slices"
	"testing"
	"time"
)

func TestRoutePointsAreKeptOnceAndReadByTheirRange(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	points := []RoutePoint{
		// Before the range.
		{PhoneTime: 1, Time: ms(hour.Add(-time.Hour)), Lat: 53.55, Lon: 9.99, Accuracy: 20},
		// In it, sent out of order.
		{PhoneTime: 3, Time: ms(hour.Add(40 * time.Minute)), Lat: 53.56, Lon: 10.01, Accuracy: 35},
		{PhoneTime: 2, Time: ms(hour.Add(10 * time.Minute)), Lat: 53.551, Lon: 9.995, Accuracy: 12},
		// After it.
		{PhoneTime: 4, Time: ms(hour.Add(3 * time.Hour)), Lat: 53.6, Lon: 10.1, Accuracy: 50},
	}
	if err := store.AddRoutePoints(ctx, "pixel", points); err != nil {
		t.Fatal(err)
	}
	// A point sent again, as when the phone did not hear the answer, is kept once.
	if err := store.AddRoutePoints(ctx, "pixel", points[1:2]); err != nil {
		t.Fatal(err)
	}
	if err := store.AddRoutePoints(ctx, "other", points); err != nil {
		t.Fatal(err)
	}
	got, err := store.RoutePoints(ctx, "pixel", hour, hour.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	want := []PhonePoint{
		{Time: hour.Add(10 * time.Minute).Unix(), Lat: 53.551, Lon: 9.995, Accuracy: 12},
		{Time: hour.Add(40 * time.Minute).Unix(), Lat: 53.56, Lon: 10.01, Accuracy: 35},
	}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("points = %+v, want %+v", got, want)
	}

	if err := store.DeleteDevice(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if got, err := store.RoutePoints(ctx, "pixel", hour.Add(-24*time.Hour), hour.Add(24*time.Hour)); err != nil || len(got) != 0 {
		t.Errorf("after the device was deleted: %+v, %v; want none", got, err)
	}
	if _, err := store.DeletePhoneDataBefore(ctx, hour); err != nil {
		t.Fatal(err)
	}
	got, err = store.RoutePoints(ctx, "other", hour.Add(-24*time.Hour), hour.Add(24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 || got[0].Time != hour.Add(10*time.Minute).Unix() {
		t.Errorf("after the retention: %+v, want the 3 points from its start on", got)
	}
}

func TestTheRouteAndScansHaveARetentionOfTheirOwn(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	old := time.Now().Add(-100 * day24)
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{{PhoneTime: 1, Time: old.UnixMilli(), Lat: 53.55, Lon: 9.99, Accuracy: 20}}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{{At: old}}); err != nil {
		t.Fatal(err)
	}
	count := func(table string) int {
		t.Helper()
		var n int
		if err := store.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM `+table).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	if _, err := store.DeleteBefore(ctx, time.Now().Add(-30*day24)); err != nil {
		t.Fatal(err)
	}
	if count("route_points") != 1 || count("phone_scans") != 1 {
		t.Fatalf("after the history's retention: %d points, %d scans; want both kept", count("route_points"), count("phone_scans"))
	}

	if _, err := store.DeletePhoneDataBefore(ctx, time.Now().Add(-30*day24)); err != nil {
		t.Fatal(err)
	}
	if count("route_points") != 0 || count("phone_scans") != 0 {
		t.Errorf("after the phones' retention: %d points, %d scans; want none", count("route_points"), count("phone_scans"))
	}
}

func TestDeleteRouteDeletesAStretchOfOnePhone(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	points := []RoutePoint{
		{PhoneTime: 1, Time: day.Add(-time.Minute).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5},
		{PhoneTime: 2, Time: day.Add(8 * time.Hour).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5},
		{PhoneTime: 3, Time: day.Add(day24).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5},
	}
	for _, phone := range []string{"pixel", "other"} {
		if err := store.AddRoutePoints(ctx, phone, points); err != nil {
			t.Fatal(err)
		}
		if err := store.AddPhoneScans(ctx, phone, []FoundScan{{At: day.Add(8 * time.Hour)}, {At: day.Add(day24)}}); err != nil {
			t.Fatal(err)
		}
	}

	deleted, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24))

	if err != nil || deleted != 1 {
		t.Fatalf("DeleteRoute() = %d, %v; want the one point of the day", deleted, err)
	}
	left, err := store.RoutePoints(ctx, "pixel", day.Add(-day24), day.Add(2*day24))
	if err != nil || len(left) != 2 {
		t.Errorf("pixel's points left = %+v, %v; want those before and after the day", left, err)
	}
	if other, err := store.RoutePoints(ctx, "other", day.Add(-day24), day.Add(2*day24)); err != nil || len(other) != 3 {
		t.Errorf("other's points = %+v, %v; want all three", other, err)
	}
	var scans int
	if err := store.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM phone_scans WHERE device = 'pixel'`).Scan(&scans); err != nil || scans != 1 {
		t.Errorf("pixel's scans left = %d, %v; want the one after the day", scans, err)
	}
}

func TestDeleteRouteTakesWhatTellsWhereThePhoneWasAndKeepsItOut(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	scanAt(t, store, day.Add(8*time.Hour), 53.5755, 9.9530, "Den")
	scanAt(t, store, day.Add(9*time.Hour), 53.5400, 9.9800, "Park")
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{
		{SSID: "Den", PhoneStart: 1, Start: day.Add(8 * time.Hour).UnixMilli(), End: day.Add(9 * time.Hour).UnixMilli()},
	}); err != nil {
		t.Fatal(err)
	}
	// A place the phone was at on another day only stays.
	scanAt(t, store, day.Add(-day24), 53.5300, 9.9900, "Station")
	places := placesBy(t, store, day.Add(-day24), day.Add(day24))
	if err := store.RenamePositionPlace(ctx, places["Den"].ID, "Home"); err != nil {
		t.Fatal(err)
	}

	if _, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24)); err != nil {
		t.Fatal(err)
	}

	var names []string
	rows, err := store.db.QueryContext(ctx, `SELECT name FROM position_places ORDER BY name`)
	if err != nil {
		t.Fatal(err)
	}
	if err := scanRows(rows, func() error {
		var name string
		err := rows.Scan(&name)
		names = append(names, name)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(names, []string{"", "Home"}) {
		t.Errorf("places left = %q; want the one the user named and the station of another day", names)
	}
	if got, err := store.WiFiConnections(ctx, "pixel", day, day.Add(day24)); err != nil || len(got) != 0 {
		t.Errorf("connections left = %+v, %v; want none", got, err)
	}

	// What the phone had not sent yet of the day comes later, and is left out.
	scanAt(t, store, day.Add(20*time.Hour), 53.5612, 9.9615, "Cafe")
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{
		{SSID: "Cafe", PhoneStart: 2, Start: day.Add(20 * time.Hour).UnixMilli(), End: day.Add(21 * time.Hour).UnixMilli()},
	}); err != nil {
		t.Fatal(err)
	}
	if left, err := store.RoutePoints(ctx, "pixel", day, day.Add(day24)); err != nil || len(left) != 0 {
		t.Errorf("points of the deleted day = %+v, %v; want none", left, err)
	}
	var scans int
	if err := store.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM phone_scans WHERE time >= ?`, day.Unix()).Scan(&scans); err != nil || scans != 0 {
		t.Errorf("scans of the deleted day = %d, %v; want none", scans, err)
	}
	if got, err := store.WiFiConnections(ctx, "pixel", day, day.Add(day24)); err != nil || len(got) != 0 {
		t.Errorf("connections of the deleted day = %+v, %v; want none", got, err)
	}
	// The next day is stored as before.
	scanAt(t, store, day.Add(day24+time.Hour), 53.5612, 9.9615, "Cafe")
	if left, err := store.RoutePoints(ctx, "pixel", day, day.Add(2*day24)); err != nil || len(left) != 1 {
		t.Errorf("points of the next day = %+v, %v; want one", left, err)
	}
}

func TestDeleteRouteOfTodayKeepsWhatComesAfterIt(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	now := time.Now()
	scanAt(t, store, now.Add(-time.Minute), 53.5755, 9.9530, "Den")
	// Connected since an hour ago, and still.
	home := WiFiConnection{SSID: "Home", PhoneStart: 1, Start: now.Add(-time.Hour).UnixMilli(), End: now.UnixMilli()}
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{home}); err != nil {
		t.Fatal(err)
	}

	// The stretch reaches into the future, as today until midnight would.
	if _, err := store.DeleteRoute(ctx, "pixel", now.Add(-2*time.Hour), now.Add(22*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if deleted, err := store.DeletedRouteAt(ctx, "pixel", now.Add(-time.Minute)); err != nil || !deleted {
		t.Errorf("DeletedRouteAt(a minute ago) = %v, %v; want true", deleted, err)
	}
	// Recorded after the delete, so it is stored.
	later := time.Now().Add(time.Minute)
	scanAt(t, store, later, 53.5755, 9.9530, "Den")
	if left, err := store.RoutePoints(ctx, "pixel", now.Add(-2*time.Hour), now.Add(22*time.Hour)); err != nil || len(left) != 1 {
		t.Errorf("points = %+v, %v; want the one after the delete", left, err)
	}
	if deleted, err := store.DeletedRouteAt(ctx, "pixel", later); err != nil || deleted {
		t.Errorf("DeletedRouteAt(after the delete) = %v, %v; want false", deleted, err)
	}
	// The connection, sent again with its new end, is kept from the end of
	// the deleted stretch on.
	home.End = later.UnixMilli()
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{home}); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFiConnections(ctx, "pixel", now.Add(-2*time.Hour), now.Add(time.Hour))
	if err != nil || len(got) != 1 || got[0].Start < now.Unix() || got[0].End != later.Unix() {
		t.Errorf("connections = %+v, %v; want Home from the delete on, ending %d", got, err, later.Unix())
	}
}

func TestDeleteRouteCutsTheWiFiConnectionsAcrossTheStretch(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	ms := func(d time.Duration) int64 { return day.Add(d).UnixMilli() }
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{
		{SSID: "Home", PhoneStart: 1, Start: ms(-2 * time.Hour), End: ms(9 * time.Hour)},
		{SSID: "Cafe", PhoneStart: 2, Start: ms(12 * time.Hour), End: ms(13 * time.Hour)},
		{SSID: "Office", PhoneStart: 3, Start: ms(23 * time.Hour), End: ms(32 * time.Hour)},
	}); err != nil {
		t.Fatal(err)
	}

	if _, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24)); err != nil {
		t.Fatal(err)
	}

	got, err := store.WiFiConnections(ctx, "pixel", day.Add(-day24), day.Add(2*day24))
	if err != nil {
		t.Fatal(err)
	}
	want := []PhoneConnection{
		{SSID: "Home", Start: day.Add(-2 * time.Hour).Unix(), End: day.Unix()},
		{SSID: "Office", Start: day.Add(day24).Unix(), End: day.Add(32 * time.Hour).Unix()},
	}
	if !slices.Equal(got, want) {
		t.Errorf("connections = %+v, want %+v: the day taken out of them", got, want)
	}
	// Sent again later, a connection that ends in the day ends at its start.
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{
		{SSID: "Gym", PhoneStart: 4, Start: ms(-time.Hour), End: ms(2 * time.Hour)},
	}); err != nil {
		t.Fatal(err)
	}
	got, err = store.WiFiConnections(ctx, "pixel", day.Add(-2*time.Hour), day)
	if err != nil || len(got) != 2 || got[1].SSID != "Gym" || got[1].End != day.Unix() {
		t.Errorf("connections before the day = %+v, %v; want the gym ending at midnight", got, err)
	}
}

// day24 is a day, for the tests of the phones' retention.
const day24 = 24 * time.Hour
