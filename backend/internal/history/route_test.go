package history

import (
	"context"
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

// day24 is a day, for the tests of the phones' retention.
const day24 = 24 * time.Hour
