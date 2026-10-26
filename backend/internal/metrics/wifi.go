package metrics

import (
	"cmp"
	"crypto/sha256"
	"encoding/hex"
	"math"
	"regexp"
	"slices"
	"strings"
	"unicode"
)

// NearbyWiFi is what a device's Wi-Fi sees nearby, each access point on its
// own, so a hub can compare what its devices see: which networks each one
// has in range, how strong, and which access point of a network it is
// nearest to. The Wi-Fi add-on reports it besides its extras, which show the
// networks by name.
type NearbyWiFi struct {
	AccessPoints []NearbyAccessPoint `json:"accessPoints"`
}

// NearbyAccessPoint is one access point (BSS) a device's Wi-Fi sees.
type NearbyAccessPoint struct {
	// ID tells the access point apart: a hash of its hardware address
	// (BSSID), which is the same on every device that sees it but does not
	// give the address away (see AccessPointID).
	ID string `json:"id"`
	// Box is the same for the radios of one router, whose hardware addresses
	// mostly differ only in the first or last byte: a hash of the four bytes
	// between, so its 2.4 GHz and 5 GHz networks count as one access point.
	Box string `json:"box"`
	// SSID is the network's name, empty for a hidden network.
	SSID          string  `json:"ssid,omitempty"`
	SignalPercent float64 `json:"signalPercent"`
	// SignalDBm is left out where the system gives only the percentage.
	SignalDBm    *float64 `json:"signalDBm,omitempty"`
	FrequencyMHz int      `json:"frequencyMHz,omitempty"`
	WidthMHz     int      `json:"widthMHz,omitempty"`
	// Security is how the network is secured in English, such as
	// "WPA2/WPA3", "WPA2 Enterprise" or "Open".
	Security string `json:"security,omitempty"`
	// Generation is the newest Wi-Fi generation it offers, such as 6, left
	// out when unknown.
	Generation  int     `json:"generation,omitempty"`
	MaxRateMbps float64 `json:"maxRateMbps,omitempty"`
	// Connected is set for the access point the device is connected to.
	Connected bool `json:"connected,omitempty"`
}

const (
	// MaxNearbyAccessPoints is how many access points a device's report
	// keeps, the strongest.
	MaxNearbyAccessPoints = 64
	// maxSSIDLength is the most characters of an SSID that are kept: an SSID
	// is up to 32 bytes.
	maxSSIDLength = 32
)

// validAccessPointID matches an access point's ID or Box.
var validAccessPointID = regexp.MustCompile(`^[0-9a-f]{12}$`)

// AccessPointID returns the ID of an access point with the given hardware
// address, or its Box when box is set: the first 12 hex digits of the
// SHA-256 of the address's bytes, of the four bytes in the middle for a box.
// Every device and the hub compute the same, so a hub can tell which
// access point a router's own list means. It returns "" for an address
// that is not six bytes.
func AccessPointID(hardwareAddress []byte, box bool) string {
	if len(hardwareAddress) != 6 {
		return ""
	}
	if box {
		hardwareAddress = hardwareAddress[1:5]
	}
	sum := sha256.Sum256(hardwareAddress)
	return hex.EncodeToString(sum[:6])
}

// CleanNearbyWiFi returns what can safely be stored and shown of what a
// device reports seeing: access points with a valid ID and Box, once each,
// with a signal from 0 to 100, cut to the MaxNearbyAccessPoints strongest.
func CleanNearbyWiFi(wifi *NearbyWiFi) *NearbyWiFi {
	if wifi == nil {
		return nil
	}
	clean := &NearbyWiFi{AccessPoints: []NearbyAccessPoint{}}
	seen := map[string]bool{}
	for _, ap := range wifi.AccessPoints {
		if !validAccessPointID.MatchString(ap.ID) || !validAccessPointID.MatchString(ap.Box) || seen[ap.ID] {
			continue
		}
		if math.IsNaN(ap.SignalPercent) || ap.SignalPercent < 0 || ap.SignalPercent > 100 {
			continue
		}
		if ap.SignalDBm != nil && (math.IsNaN(*ap.SignalDBm) || *ap.SignalDBm < -150 || *ap.SignalDBm > 0) {
			ap.SignalDBm = nil
		}
		if math.IsNaN(ap.MaxRateMbps) || math.IsInf(ap.MaxRateMbps, 0) || ap.MaxRateMbps < 0 {
			ap.MaxRateMbps = 0
		}
		ap.SSID = CleanSSID(ap.SSID)
		ap.Security = CleanText(ap.Security)
		ap.FrequencyMHz = max(ap.FrequencyMHz, 0)
		ap.WidthMHz = max(ap.WidthMHz, 0)
		ap.Generation = max(ap.Generation, 0)
		seen[ap.ID] = true
		clean.AccessPoints = append(clean.AccessPoints, ap)
	}
	if len(clean.AccessPoints) > MaxNearbyAccessPoints {
		slices.SortStableFunc(clean.AccessPoints, func(a, b NearbyAccessPoint) int { return cmp.Compare(b.SignalPercent, a.SignalPercent) })
		clean.AccessPoints = clean.AccessPoints[:MaxNearbyAccessPoints]
	}
	return clean
}

// CleanSSID returns an SSID fit to show: valid UTF-8, without control
// characters and the spaces around it, of at most 32 characters. An SSID is
// up to 32 bytes of anything.
func CleanSSID(ssid string) string {
	ssid = strings.ToValidUTF8(ssid, "�")
	ssid = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, ssid)
	return cutTo(strings.TrimSpace(ssid), maxSSIDLength)
}
