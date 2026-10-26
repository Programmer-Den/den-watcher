package metrics

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestAccessPointIDHashesTheAddressAndItsMiddleForTheBox(t *testing.T) {
	address := []byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff}
	if got := AccessPointID(address, false); got != "17226b1f68ae" {
		t.Errorf("AccessPointID(address) = %q, want the first 12 hex digits of its SHA-256", got)
	}
	if got := AccessPointID(address, true); got != "74c108fcc2a3" {
		t.Errorf("AccessPointID(address, box) = %q, want those of the four bytes in the middle", got)
	}
	// The 5 GHz radio of the same router differs in the last byte.
	other := []byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xfb}
	if AccessPointID(other, true) != AccessPointID(address, true) || AccessPointID(other, false) == AccessPointID(address, false) {
		t.Error("two radios of one router should have the same box and IDs of their own")
	}
	if got := AccessPointID([]byte{1, 2, 3}, false); got != "" {
		t.Errorf("AccessPointID(3 bytes) = %q, want empty", got)
	}
}

func TestCleanNearbyWiFiKeepsValidAccessPointsOnce(t *testing.T) {
	dBm, bad := -60.0, 20.0
	got := CleanNearbyWiFi(&NearbyWiFi{AccessPoints: []NearbyAccessPoint{
		{ID: "17226b1f68ae", Box: "74c108fcc2a3", SSID: " Den\x07 ", SignalPercent: 70, SignalDBm: &dBm, Security: "WPA2"},
		{ID: "17226b1f68ae", Box: "74c108fcc2a3", SSID: "twice", SignalPercent: 50},
		{ID: "not-an-id", Box: "74c108fcc2a3", SignalPercent: 50},
		{ID: "000000000001", Box: "short", SignalPercent: 50},
		{ID: "000000000002", Box: "74c108fcc2a3", SignalPercent: 101},
		{ID: "000000000003", Box: "74c108fcc2a3", SignalPercent: math.NaN()},
		{ID: "000000000004", Box: "74c108fcc2a3", SignalPercent: 10, SignalDBm: &bad, MaxRateMbps: math.Inf(1), FrequencyMHz: -1},
	}})
	if len(got.AccessPoints) != 2 {
		t.Fatalf("CleanNearbyWiFi() kept %d access points, want 2: %+v", len(got.AccessPoints), got.AccessPoints)
	}
	first, last := got.AccessPoints[0], got.AccessPoints[1]
	if first.SSID != "Den" || first.SignalDBm == nil || *first.SignalDBm != -60 {
		t.Errorf("first = %+v, want the SSID cleaned and its dBm kept", first)
	}
	if last.SignalDBm != nil || last.MaxRateMbps != 0 || last.FrequencyMHz != 0 {
		t.Errorf("last = %+v, want the impossible dBm, rate and frequency dropped", last)
	}
	if CleanNearbyWiFi(nil) != nil {
		t.Error("CleanNearbyWiFi(nil) should stay nil, for a device without the Wi-Fi add-on")
	}
}

func TestCleanNearbyWiFiKeepsTheStrongest(t *testing.T) {
	var aps []NearbyAccessPoint
	for i := range MaxNearbyAccessPoints + 10 {
		aps = append(aps, NearbyAccessPoint{ID: fmt.Sprintf("%012x", i), Box: "74c108fcc2a3", SignalPercent: float64(i)})
	}
	got := CleanNearbyWiFi(&NearbyWiFi{AccessPoints: aps})
	if len(got.AccessPoints) != MaxNearbyAccessPoints {
		t.Fatalf("CleanNearbyWiFi() kept %d, want %d", len(got.AccessPoints), MaxNearbyAccessPoints)
	}
	for _, ap := range got.AccessPoints {
		if ap.SignalPercent < 10 {
			t.Fatalf("CleanNearbyWiFi() kept %+v, one of the weakest", ap)
		}
	}
}

func TestAddOnsWiFiComesFromAFreshReport(t *testing.T) {
	dir := t.TempDir()
	folder := openRoot(t, dir)
	now := time.Now().UTC().Truncate(time.Second)
	nearby := &NearbyWiFi{AccessPoints: []NearbyAccessPoint{{ID: "17226b1f68ae", Box: "74c108fcc2a3", SSID: "Den", SignalPercent: 70}}}
	if err := WriteAddOnReport(folder, "wifi.json", AddOnReport{Time: now, WiFi: nearby}); err != nil {
		t.Fatal(err)
	}
	if err := WriteAddOnReport(folder, "gpu.json", AddOnReport{Time: now}); err != nil {
		t.Fatal(err)
	}
	addOns := &AddOns{Dir: dir, MaxEntries: 64}
	addOns.Read(now)
	got := addOns.WiFi(now)
	if got == nil || len(got.AccessPoints) != 1 || got.AccessPoints[0].SSID != "Den" {
		t.Fatalf("WiFi() = %+v, want the Wi-Fi add-on's access point", got)
	}
	addOns.Read(now.Add(time.Minute))
	if got := addOns.WiFi(now.Add(time.Minute)); got != nil {
		t.Errorf("WiFi() of a stale report = %+v, want nil", got)
	}
}
