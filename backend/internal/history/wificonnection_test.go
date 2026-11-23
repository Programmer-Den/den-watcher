package history

import (
	"context"
	"slices"
	"testing"
	"time"
)

func TestWiFiConnectionsGrowAndAreReadByTheirRange(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 4, 10, 0, 0, 0, time.UTC)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	connections := []WiFiConnection{
		// From 7:00 to 9:00, before the range.
		{SSID: "Home", PhoneStart: 1, Start: ms(hour.Add(-3 * time.Hour)), End: ms(hour.Add(-time.Hour))},
		// From 9:30 into the range.
		{SSID: "Work", PhoneStart: 2, Start: ms(hour.Add(-30 * time.Minute)), End: ms(hour.Add(10 * time.Minute))},
		// After the range.
		{SSID: "Café", PhoneStart: 3, Start: ms(hour.Add(3 * time.Hour)), End: ms(hour.Add(4 * time.Hour))},
	}
	if err := store.AddWiFiConnections(ctx, "pixel", connections); err != nil {
		t.Fatal(err)
	}
	// The open one went on, and an older copy of it comes late.
	longer := connections[1]
	longer.End = ms(hour.Add(50 * time.Minute))
	if err := store.AddWiFiConnections(ctx, "pixel", []WiFiConnection{longer, connections[1]}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddWiFiConnections(ctx, "other", connections); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFiConnections(ctx, "pixel", hour, hour.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	want := PhoneConnection{SSID: "Work", Start: hour.Add(-30 * time.Minute).Unix(), End: hour.Add(50 * time.Minute).Unix()}
	if len(got) != 1 || got[0] != want {
		t.Errorf("connections = %+v, want only %+v", got, want)
	}

	if err := store.DeleteDevice(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if got, err := store.WiFiConnections(ctx, "pixel", hour.Add(-time.Hour*24), hour.Add(24*time.Hour)); err != nil || len(got) != 0 {
		t.Errorf("after the device was deleted: %+v, %v; want none", got, err)
	}
	if _, err := store.DeletePhoneDataBefore(ctx, hour); err != nil {
		t.Fatal(err)
	}
	got, err = store.WiFiConnections(ctx, "other", hour.Add(-24*time.Hour), hour.Add(24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].SSID != "Work" || got[1].SSID != "Café" {
		t.Errorf("after the retention: %+v, want the ones that end after it, Work and Café", got)
	}
}

func TestWithoutStretches(t *testing.T) {
	for _, tt := range []struct {
		start, end int64
		stretches  [][2]int64
		want       [][2]int64
	}{
		{10, 20, nil, [][2]int64{{10, 20}}},
		{10, 20, [][2]int64{{0, 5}, {25, 30}}, [][2]int64{{10, 20}}},
		{10, 20, [][2]int64{{0, 12}}, [][2]int64{{12, 20}}},
		{10, 20, [][2]int64{{15, 30}}, [][2]int64{{10, 15}}},
		{10, 20, [][2]int64{{12, 14}, {16, 18}}, [][2]int64{{10, 12}, {14, 16}, {18, 20}}},
		{10, 20, [][2]int64{{5, 15}, {15, 25}}, nil},
		{10, 20, [][2]int64{{0, 20}}, nil},
		{10, 20, [][2]int64{{20, 30}}, [][2]int64{{10, 20}}},
		{10, 10, nil, [][2]int64{{10, 10}}},
		{10, 10, [][2]int64{{5, 15}}, nil},
	} {
		if got := withoutStretches(tt.start, tt.end, tt.stretches); !slices.Equal(got, tt.want) {
			t.Errorf("withoutStretches(%d, %d, %v) = %v, want %v", tt.start, tt.end, tt.stretches, got, tt.want)
		}
	}
}
