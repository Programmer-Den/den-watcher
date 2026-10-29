package alerts

import (
	"context"
	"slices"
	"strings"
	"time"
	"unicode"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// offlineAfter is how long a server must not answer before it is an alert,
// so a restart is none.
const offlineAfter = 2 * time.Minute

// threshold turns a value into a level: from Warn a warning, from Alert an
// alert. An active alert ends only once the value is Ease below the
// threshold, so a value around it does not start and end alerts all the time.
type threshold struct {
	Warn, Alert, Ease float64
}

// level returns the level of value, or "" for none, given the level the
// alert has while it is active.
func (t threshold) level(value float64, active Level) Level {
	ease := 0.0
	if active != "" {
		ease = t.Ease
	}
	switch {
	case t.Alert > 0 && value >= t.Alert-ease && (active == Critical || value >= t.Alert):
		return Critical
	case value >= t.Warn-ease:
		return Warning
	}
	return ""
}

// The thresholds of the values that are watched.
var (
	diskThreshold        = threshold{Warn: 90, Alert: 95, Ease: 2}
	memoryThreshold      = threshold{Warn: 90, Alert: 95, Ease: 5}
	cpuThreshold         = threshold{Warn: 95, Ease: 10}
	temperatureThreshold = threshold{Warn: 85, Alert: 95, Ease: 5}
)

// conditions returns what of a device needs attention now; levels has the
// level of each active alert by key. It returns false when the device's usage
// could not be read, so nothing is known about it.
func conditions(ctx context.Context, target Target, now time.Time, levels map[string]Level) ([]Alert, bool) {
	base := Alert{Device: target.ID, DeviceName: target.Name}
	if target.Unreachable {
		// A PC that is off is not in use, so nothing of it needs attention.
		if target.PC {
			return nil, true
		}
		// While a server does not answer, its last values are not looked
		// at, so its alerts last on, an offline one from before a restart
		// too. Only an outage that lasts is an alert of its own.
		if target.UnreachableSince.IsZero() || now.Sub(target.UnreachableSince) < offlineAfter {
			return nil, false
		}
		a := base
		a.Kind, a.Level, a.Started = KindOffline, Critical, target.UnreachableSince
		return []Alert{a}, false
	}
	if target.Usage == nil {
		return nil, false
	}
	s, err := target.Usage.Collect(ctx)
	if err != nil {
		return nil, false
	}
	var list []Alert
	add := func(kind Kind, subject string, value float64, t threshold) {
		a := base
		a.Kind, a.Subject = kind, subject
		if a.Level = t.level(value, levels[a.key()]); a.Level != "" {
			a.Value = &value
			list = append(list, a)
		}
	}
	for _, d := range s.Disks {
		if d.TotalBytes > 0 {
			add(KindDisk, d.Path, d.UsedPercent, diskThreshold)
		}
	}
	if s.Memory.TotalBytes > 0 {
		add(KindMemory, "", s.Memory.UsedPercent, memoryThreshold)
	}
	if s.CPU.Cores > 0 {
		add(KindCPU, "", s.CPU.UsagePercent, cpuThreshold)
	}
	for _, t := range s.Temperatures {
		add(KindTemperature, t.Sensor, t.Celsius, temperatureThreshold)
	}
	if s.Throttling != nil && len(s.Throttling.Now) > 0 {
		a := base
		a.Kind, a.Subject, a.Level = KindThrottling, strings.Join(s.Throttling.Now, ","), Warning
		for _, c := range s.Throttling.Now {
			if c == "undervoltage" {
				a.Level = Critical
			}
		}
		// The subject is what it reports, so a new condition is a new alert.
		list = append(list, a)
	}
	list = append(list, smartFailures(base, s.Extras)...)
	list = append(list, lookalikes(base, s.WiFiNearby)...)
	return list, true
}

// smartFailures returns an alert for each disk whose SMART check failed or
// that cannot be read, from the extras of the smart add-on.
func smartFailures(base Alert, extras []metrics.Extra) []Alert {
	var list []Alert
	for _, group := range extras {
		if group.ID != "smart-checks" {
			continue
		}
		for _, item := range group.Items {
			if strings.HasSuffix(item.ID, "-health") && item.Text == "✗" {
				a := base
				a.Kind, a.Subject, a.Level = KindSMART, item.Section, Critical
				list = append(list, a)
			}
		}
	}
	return list
}

// lookalikes returns a warning for each network the device is connected to
// that a router of its own sends nearby with other security: it may be a copy
// set up to catch the passwords of the devices that join it. Names are
// compared without case, spaces, hyphens and underscores. Security counts as
// other only when the two have no kind in common, so a mesh router that
// offers WPA2 next to one with WPA2/WPA3 is none, and an access point whose
// security is unknown is left out. Wi-Fi 6E allows only WPA3 and OWE at 6
// GHz, which a mesh with WPA2 or Open below has to use there: so one at 6
// GHz, which catches no password, counts its WPA3 as WPA2 and OWE as Open
// next to a network the device joins below. Joined at 6 GHz, the network
// has the security too that its router sends it with below, as a mesh with
// WPA2 there; a WPA2 or Open copy below of a network the router sends only
// with WPA3 is still told, as it can catch what devices send to join it.
func lookalikes(base Alert, nearby *metrics.NearbyWiFi) []Alert {
	if nearby == nil {
		return nil
	}
	var list []Alert
	for _, home := range nearby.AccessPoints {
		if !home.Connected || home.SSID == "" || home.Security == "" {
			continue
		}
		for _, other := range nearby.AccessPoints {
			if other.Box == home.Box || other.Security == "" || foldSSID(other.SSID) != foldSSID(home.SSID) {
				continue
			}
			if sharesSecurity(other, home, nearby.AccessPoints) {
				continue
			}
			a := base
			a.Kind, a.Subject, a.Level = KindWiFiLookalike, home.SSID, Warning
			list = append(list, a)
			break
		}
	}
	return list
}

// sixGHz reports whether an access point sends in the 6 GHz band.
func sixGHz(ap metrics.NearbyAccessPoint) bool {
	return ap.FrequencyMHz > 5925
}

// foldSSID returns a network name as lookalikes compares it.
func foldSSID(ssid string) string {
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '-' || r == '_' {
			return -1
		}
		return unicode.ToLower(r)
	}, ssid)
}

// securityKinds returns the kinds of a security: "WPA2/WPA3" is WPA2 and
// WPA3, and "WPA2/WPA3 Enterprise", where Enterprise is written once for all
// of them, is WPA2 Enterprise and WPA3 Enterprise.
func securityKinds(security string) []string {
	base, enterprise := strings.CutSuffix(security, " Enterprise")
	kinds := strings.Split(base, "/")
	if enterprise {
		for i := range kinds {
			kinds[i] += " Enterprise"
		}
	}
	return kinds
}

// sharesSecurity reports whether other, which sends a network named like
// home, has a kind of security in common with it, such as "WPA2/WPA3" with
// "WPA2". Between one at 6 GHz and one below (see lookalikes), other's WPA3
// at 6 GHz also counts as WPA2 and OWE as Open, and home at 6 GHz also has
// the securities its router, of aps, sends the network with below.
func sharesSecurity(other, home metrics.NearbyAccessPoint, aps []metrics.NearbyAccessPoint) bool {
	kindsOther, kindsHome := securityKinds(other.Security), securityKinds(home.Security)
	switch {
	case sixGHz(other) && !sixGHz(home):
		kindsOther = append(kindsOther, belowSixGHz(kindsOther)...)
	case sixGHz(home) && !sixGHz(other):
		for _, ap := range aps {
			if ap.Box == home.Box && !sixGHz(ap) && ap.Security != "" && foldSSID(ap.SSID) == foldSSID(home.SSID) {
				kindsHome = append(kindsHome, securityKinds(ap.Security)...)
			}
		}
	}
	for _, kind := range kindsOther {
		if slices.Contains(kindsHome, kind) {
			return true
		}
	}
	return false
}

// belowSixGHz returns what the kinds of a security sent at 6 GHz are sent as
// below it: WPA3 as WPA2, and OWE as Open.
func belowSixGHz(kinds []string) []string {
	var below []string
	for _, kind := range kinds {
		switch {
		case strings.HasPrefix(kind, "WPA3"):
			below = append(below, "WPA2"+strings.TrimPrefix(kind, "WPA3"))
		case strings.HasPrefix(kind, "OWE"):
			below = append(below, "Open")
		}
	}
	return below
}
