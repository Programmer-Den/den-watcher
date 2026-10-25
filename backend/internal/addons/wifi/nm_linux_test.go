package wifi

import (
	"reflect"
	"testing"
	"time"

	"github.com/godbus/dbus/v5"
)

// nmObjects is what NetworkManager lists on a machine with one Wi-Fi
// device, connected to the first of three access points it found: one with
// WPA2 and WPA3, an open one, and one it last found an hour ago.
func nmObjects() managedObjects {
	return managedObjects{
		"/org/freedesktop/NetworkManager": {"org.freedesktop.NetworkManager": {}},
		"/org/freedesktop/NetworkManager/Devices/3": {
			"org.freedesktop.NetworkManager.Device": {"Interface": dbus.MakeVariant("wlan0")},
			wirelessInterface: {
				"ActiveAccessPoint": dbus.MakeVariant(dbus.ObjectPath("/org/freedesktop/NetworkManager/AccessPoint/1")),
			},
		},
		"/org/freedesktop/NetworkManager/AccessPoint/1": {
			accessPointInterface: {
				"Ssid":       dbus.MakeVariant([]byte("Home")),
				"HwAddress":  dbus.MakeVariant("AA:00:00:00:00:01"),
				"Strength":   dbus.MakeVariant(byte(78)),
				"Frequency":  dbus.MakeVariant(uint32(5180)),
				"Bandwidth":  dbus.MakeVariant(uint32(80)),
				"MaxBitrate": dbus.MakeVariant(uint32(866700)),
				"Flags":      dbus.MakeVariant(uint32(apFlagPrivacy)),
				"WpaFlags":   dbus.MakeVariant(uint32(0)),
				"RsnFlags":   dbus.MakeVariant(uint32(0x88 | keyMgmtPSK | keyMgmtSAE)),
				"LastSeen":   dbus.MakeVariant(int32(1000)),
			},
		},
		"/org/freedesktop/NetworkManager/AccessPoint/2": {
			accessPointInterface: {
				"Ssid":      dbus.MakeVariant([]byte("Café")),
				"HwAddress": dbus.MakeVariant("AA:00:00:00:00:02"),
				"Strength":  dbus.MakeVariant(byte(35)),
				"Frequency": dbus.MakeVariant(uint32(2412)),
				"Flags":     dbus.MakeVariant(uint32(0)),
				"LastSeen":  dbus.MakeVariant(int32(990)),
			},
		},
		"/org/freedesktop/NetworkManager/AccessPoint/3": {
			accessPointInterface: {
				"Ssid":     dbus.MakeVariant([]byte("Gone")),
				"Strength": dbus.MakeVariant(byte(20)),
				"LastSeen": dbus.MakeVariant(int32(1000 - 3600)),
			},
		},
	}
}

func TestAccessPointsOfNetworkManager(t *testing.T) {
	got := accessPointsOf(nmObjects(), 1010*time.Second)

	want := []AccessPoint{
		{
			SSID: "Home", BSSID: "aa:00:00:00:00:01", SignalPercent: 78, FrequencyMHz: 5180, WidthMHz: 80,
			Security: Security{Privacy: true, WPA2: true, WPA3: true}, MaxRateMbps: 866.7, Connected: true,
		},
		{SSID: "Café", BSSID: "aa:00:00:00:00:02", SignalPercent: 35, FrequencyMHz: 2412},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("accessPointsOf() = %+v, want %+v", got, want)
	}
}

func TestAccessPointsWithoutWiFiDevice(t *testing.T) {
	objects := nmObjects()
	delete(objects, "/org/freedesktop/NetworkManager/Devices/3")
	if got := accessPointsOf(objects, time.Hour); got != nil {
		t.Errorf("accessPointsOf() without a Wi-Fi device = %+v, want nothing", got)
	}
}

func TestSecurityOfNetworkManagerFlags(t *testing.T) {
	for _, c := range []struct {
		flags, wpa, rsn uint32
		want            Security
	}{
		{0, 0, 0, Security{}},
		{apFlagPrivacy, 0, 0, Security{Privacy: true}},
		{apFlagPrivacy, keyMgmtPSK, keyMgmtPSK, Security{Privacy: true, WPA: true, WPA2: true}},
		{apFlagPrivacy, 0, keyMgmt8021X, Security{Privacy: true, WPA2: true, Enterprise: true}},
		{apFlagPrivacy, 0, keyMgmtSuiteB, Security{Privacy: true, WPA3: true, Enterprise: true}},
		{apFlagPrivacy, 0, keyMgmtOWE, Security{Privacy: true, OWE: true}},
	} {
		if got := securityOf(c.flags, c.wpa, c.rsn); got != c.want {
			t.Errorf("securityOf(%#x, %#x, %#x) = %+v, want %+v", c.flags, c.wpa, c.rsn, got, c.want)
		}
	}
}
