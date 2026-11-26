package history

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"
)

// kept is DeleteRoute's listed for a phone that is still kept.
func kept(context.Context) (bool, error) { return true, nil }

func TestDeleteRouteRemembersNothingForAPhoneNoLongerKept(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	point := []RoutePoint{{PhoneTime: 1, Time: day.Add(8 * time.Hour).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}}
	if err := store.AddRoutePoints(ctx, "pixel", point); err != nil {
		t.Fatal(err)
	}
	gone := func(context.Context) (bool, error) { return false, nil }
	if _, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24), gone); !errors.Is(err, ErrDeviceGone) {
		t.Fatalf("DeleteRoute() error = %v, want ErrDeviceGone", err)
	}
	var stretches int
	if err := store.DB().QueryRowContext(ctx, `SELECT COUNT(*) FROM route_deleted`).Scan(&stretches); err != nil {
		t.Fatal(err)
	}
	if stretches != 0 {
		t.Errorf("%d stretches remembered, want none", stretches)
	}
	if points, _, err := store.RoutePoints(ctx, "pixel", day, day.Add(day24)); err != nil || len(points) != 1 {
		t.Errorf("RoutePoints() = %v, %v; want the point kept", points, err)
	}
}

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
	got, _, err := store.RoutePoints(ctx, "pixel", hour, hour.Add(2*time.Hour))
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

	if err := store.UnlinkPhoneData(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if got, _, err := store.RoutePoints(ctx, "pixel", hour.Add(-24*time.Hour), hour.Add(24*time.Hour)); err != nil || len(got) != 0 {
		t.Errorf("after the phone's data was unlinked: %+v, %v; want none under its id", got, err)
	}
	if _, err := store.DeletePhoneDataBefore(ctx, hour); err != nil {
		t.Fatal(err)
	}
	got, _, err = store.RoutePoints(ctx, "other", hour.Add(-24*time.Hour), hour.Add(24*time.Hour))
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

	deleted, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24), kept)

	if err != nil || deleted != 1 {
		t.Fatalf("DeleteRoute() = %d, %v; want the one point of the day", deleted, err)
	}
	left, _, err := store.RoutePoints(ctx, "pixel", day.Add(-day24), day.Add(2*day24))
	if err != nil || len(left) != 2 {
		t.Errorf("pixel's points left = %+v, %v; want those before and after the day", left, err)
	}
	if other, _, err := store.RoutePoints(ctx, "other", day.Add(-day24), day.Add(2*day24)); err != nil || len(other) != 3 {
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
	// A place the phone was at on another day only stays, also with a point
	// of the day there too vague to place a scan.
	scanAt(t, store, day.Add(-day24), 53.5300, 9.9900, "Station")
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{routePoint(day.Add(10*time.Hour), 53.5300, 9.9900, 1500)}); err != nil {
		t.Fatal(err)
	}
	places := placesBy(t, store, day.Add(-day24), day.Add(day24))
	if err := store.RenamePositionPlace(ctx, places["Den"].ID, "Home"); err != nil {
		t.Fatal(err)
	}

	if _, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24), kept); err != nil {
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
	if left, _, err := store.RoutePoints(ctx, "pixel", day, day.Add(day24)); err != nil || len(left) != 0 {
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
	if left, _, err := store.RoutePoints(ctx, "pixel", day, day.Add(2*day24)); err != nil || len(left) != 1 {
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
	if _, err := store.DeleteRoute(ctx, "pixel", now.Add(-2*time.Hour), now.Add(22*time.Hour), kept); err != nil {
		t.Fatal(err)
	}
	stretches, err := store.DeletedStretches(ctx, "pixel")
	if err != nil || !DeletedRouteIn(stretches, now.Add(-time.Minute)) {
		t.Errorf("deleted stretches %v, %v; want one over a minute ago", stretches, err)
	}
	// Recorded after the delete, so it is stored.
	later := time.Now().Add(time.Minute)
	scanAt(t, store, later, 53.5755, 9.9530, "Den")
	if left, _, err := store.RoutePoints(ctx, "pixel", now.Add(-2*time.Hour), now.Add(22*time.Hour)); err != nil || len(left) != 1 {
		t.Errorf("points = %+v, %v; want the one after the delete", left, err)
	}
	if DeletedRouteIn(stretches, later) {
		t.Errorf("deleted stretches %v reach past the delete", stretches)
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
		{SSID: "Mesh", PhoneStart: 5, Start: ms(-time.Hour), End: ms(26 * time.Hour)},
	}); err != nil {
		t.Fatal(err)
	}

	if _, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24), kept); err != nil {
		t.Fatal(err)
	}

	got, err := store.WiFiConnections(ctx, "pixel", day.Add(-day24), day.Add(2*day24))
	if err != nil {
		t.Fatal(err)
	}
	// One over the whole day keeps the hours before and after it.
	want := []PhoneConnection{
		{SSID: "Home", Start: day.Add(-2 * time.Hour).Unix(), End: day.Unix()},
		{SSID: "Mesh", Start: day.Add(-time.Hour).Unix(), End: day.Unix()},
		{SSID: "Mesh", Start: day.Add(day24).Unix(), End: day.Add(26 * time.Hour).Unix()},
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
	// So does one cut at its start sent again with a later end.
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{
		{SSID: "Home", PhoneStart: 1, Start: ms(-2 * time.Hour), End: ms(30 * time.Hour)},
	}); err != nil {
		t.Fatal(err)
	}
	got, err = store.WiFiConnections(ctx, "pixel", day.Add(-2*time.Hour), day.Add(2*day24))
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range got {
		if c.End > day.Unix() && c.Start < day.Add(day24).Unix() {
			t.Errorf("connection %+v reaches into the deleted day", c)
		}
	}
	if gym := slices.IndexFunc(got, func(c PhoneConnection) bool { return c.SSID == "Gym" }); gym < 0 || got[gym].End != day.Unix() {
		t.Errorf("connections = %+v; want the gym ending at midnight", got)
	}
}

// day24 is a day, for the tests of the phones' retention.
const day24 = 24 * time.Hour

func TestDeleteDeviceForgetsItsDeletedStretches(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	for _, phone := range []string{"pixel", "other"} {
		if _, err := store.DeleteRoute(ctx, phone, day, day.Add(day24), kept); err != nil {
			t.Fatal(err)
		}
	}

	if err := store.DeleteDevice(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}

	// A phone added again under the same id stores that day again.
	if stretches, err := store.DeletedStretches(ctx, "pixel"); err != nil || len(stretches) != 0 {
		t.Errorf("pixel's deleted stretches = %v, %v; want none", stretches, err)
	}
	if stretches, err := store.DeletedStretches(ctx, "other"); err != nil || len(stretches) != 1 {
		t.Errorf("other's deleted stretches = %v, %v; want its one", stretches, err)
	}
}

func TestDeleteRouteForgetsTheStretchWhenItFails(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	// A later step of the deletion fails.
	if _, err := store.db.ExecContext(ctx, `DROP TABLE wifi_connections`); err != nil {
		t.Fatal(err)
	}

	if _, err := store.DeleteRoute(ctx, "pixel", day, day.Add(day24), kept); err == nil {
		t.Fatal("DeleteRoute() without wifi_connections did not fail")
	}

	if stretches, err := store.DeletedStretches(ctx, "pixel"); err != nil || len(stretches) != 0 {
		t.Errorf("deleted stretches = %v, %v; want none after the failed deletion", stretches, err)
	}
}

func TestRoutePointsReturnsTheNewestAndTellsWhenThereWereMore(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	start := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	points := make([]RoutePoint, MaxRoutePoints)
	for i := range points {
		points[i] = RoutePoint{PhoneTime: int64(i), Time: start.Add(time.Duration(i) * time.Second).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}
	}
	if err := store.AddRoutePoints(ctx, "pixel", points); err != nil {
		t.Fatal(err)
	}
	end := start.Add(MaxRoutePoints * time.Second)
	if got, cut, err := store.RoutePoints(ctx, "pixel", start, end); err != nil || cut || len(got) != MaxRoutePoints {
		t.Fatalf("with exactly MaxRoutePoints: %d points, cut %t, %v; want all, not cut", len(got), cut, err)
	}
	more := []RoutePoint{{PhoneTime: MaxRoutePoints, Time: end.UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}}
	if err := store.AddRoutePoints(ctx, "pixel", more); err != nil {
		t.Fatal(err)
	}
	got, cut, err := store.RoutePoints(ctx, "pixel", start, end.Add(time.Second))
	if err != nil || !cut || len(got) != MaxRoutePoints || got[0].Time != start.Unix()+1 || got[len(got)-1].Time != end.Unix() {
		t.Fatalf("with one more: %d points, cut %t, %v; want the newest MaxRoutePoints, cut", len(got), cut, err)
	}
}
