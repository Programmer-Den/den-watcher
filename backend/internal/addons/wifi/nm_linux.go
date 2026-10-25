package wifi

import (
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/godbus/dbus/v5"
)

// managedObjects is what NetworkManager's GetManagedObjects returns: the
// properties of each interface of each object it has, such as a device or
// an access point.
type managedObjects = map[dbus.ObjectPath]map[string]map[string]dbus.Variant

const (
	wirelessInterface    = "org.freedesktop.NetworkManager.Device.Wireless"
	accessPointInterface = "org.freedesktop.NetworkManager.AccessPoint"
)

// NetworkManager's NM80211ApFlags and NM80211ApSecurityFlags.
const (
	apFlagPrivacy  = 0x1
	keyMgmtPSK     = 0x100
	keyMgmt8021X   = 0x200
	keyMgmtSAE     = 0x400
	keyMgmtOWE     = 0x800
	keyMgmtOWETM   = 0x1000
	keyMgmtSuiteB  = 0x2000
	anyKeyMgmtMask = keyMgmtPSK | keyMgmt8021X | keyMgmtSAE | keyMgmtSuiteB
)

// accessPointsOf returns the access points NetworkManager lists, leaving out
// those it last found longer than staleAfter before bootNow (the time since
// boot, which NetworkManager's LastSeen counts in), or nil when it has no
// Wi-Fi device.
func accessPointsOf(objects managedObjects, bootNow time.Duration) []AccessPoint {
	devices := 0
	active := map[dbus.ObjectPath]bool{}
	for _, interfaces := range objects {
		device, ok := interfaces[wirelessInterface]
		if !ok {
			continue
		}
		devices++
		if path, ok := device["ActiveAccessPoint"].Value().(dbus.ObjectPath); ok && path != "/" {
			active[path] = true
		}
	}
	if devices == 0 {
		return nil
	}
	aps := []AccessPoint{}
	// By path, so the same objects give the same order.
	for _, path := range slices.Sorted(maps.Keys(objects)) {
		props, ok := objects[path][accessPointInterface]
		if !ok {
			continue
		}
		if seen, ok := props["LastSeen"].Value().(int32); ok && (seen < 0 || bootNow-time.Duration(seen)*time.Second > staleAfter) {
			continue
		}
		ssid, _ := props["Ssid"].Value().([]byte)
		address, _ := props["HwAddress"].Value().(string)
		strength, _ := props["Strength"].Value().(byte)
		frequency, _ := props["Frequency"].Value().(uint32)
		width, _ := props["Bandwidth"].Value().(uint32)
		bitrate, _ := props["MaxBitrate"].Value().(uint32)
		flags, _ := props["Flags"].Value().(uint32)
		wpa, _ := props["WpaFlags"].Value().(uint32)
		rsn, _ := props["RsnFlags"].Value().(uint32)
		aps = append(aps, AccessPoint{
			SSID:          string(ssid),
			BSSID:         strings.ToLower(address),
			SignalPercent: float64(min(strength, 100)),
			FrequencyMHz:  int(frequency),
			WidthMHz:      int(width),
			Security:      securityOf(flags, wpa, rsn),
			MaxRateMbps:   float64(bitrate) / 1000,
			Connected:     active[path],
		})
	}
	return aps
}

// securityOf turns NetworkManager's flags of an access point into how its
// network is secured.
func securityOf(flags, wpa, rsn uint32) Security {
	return Security{
		Privacy:    flags&apFlagPrivacy != 0,
		WPA:        wpa&anyKeyMgmtMask != 0,
		WPA2:       rsn&(keyMgmtPSK|keyMgmt8021X) != 0,
		WPA3:       rsn&(keyMgmtSAE|keyMgmtSuiteB) != 0,
		Enterprise: (wpa|rsn)&(keyMgmt8021X|keyMgmtSuiteB) != 0,
		OWE:        rsn&(keyMgmtOWE|keyMgmtOWETM) != 0,
	}
}
