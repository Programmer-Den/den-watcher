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
	if _, err := store.DeleteBefore(ctx, hour); err != nil {
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
