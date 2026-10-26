package wifi

import (
	"strings"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func TestChannelAndBandFollowFromTheFrequency(t *testing.T) {
	for _, c := range []struct {
		mhz     int
		channel int
		band    string
		de      string
	}{
		{2412, 1, "2.4 GHz", "2,4 GHz"},
		{2437, 6, "2.4 GHz", "2,4 GHz"},
		{2484, 14, "2.4 GHz", "2,4 GHz"},
		{5180, 36, "5 GHz", "5 GHz"},
		{5825, 165, "5 GHz", "5 GHz"},
		{5935, 2, "6 GHz", "6 GHz"},
		{5955, 1, "6 GHz", "6 GHz"},
		{6115, 33, "6 GHz", "6 GHz"},
		{0, 0, "", ""},
	} {
		if got := Channel(c.mhz); got != c.channel {
			t.Errorf("Channel(%d) = %d, want %d", c.mhz, got, c.channel)
		}
		band, bands := Band(c.mhz)
		if de := bands["de"]; de == "" {
			bands = map[string]string{"de": band}
		}
		if band != c.band || bands["de"] != c.de {
			t.Errorf("Band(%d) = %q, %v, want %q and %q in German", c.mhz, band, bands, c.band, c.de)
		}
	}
}

func TestSecurityText(t *testing.T) {
	for _, c := range []struct {
		security Security
		want     string
	}{
		{Security{}, "Open"},
		{Security{Privacy: true}, "WEP"},
		{Security{Privacy: true, WPA: true, WPA2: true}, "WPA/WPA2"},
		{Security{Privacy: true, WPA2: true, WPA3: true}, "WPA2/WPA3"},
		{Security{Privacy: true, WPA2: true, Enterprise: true}, "WPA2 Enterprise"},
		{Security{Privacy: true, OWE: true}, "OWE (Enhanced Open)"},
	} {
		if got, _ := c.security.Text(); got != c.want {
			t.Errorf("%+v.Text() = %q, want %q", c.security, got, c.want)
		}
	}
	if _, texts := (Security{}).Text(); texts["de"] != "Offen" || texts["fr"] != "Ouvert" || texts["es"] != "Abierta" {
		t.Errorf("an open network's translations = %v", texts)
	}
}

// nearby is what a machine sees: a home network with two access points on
// two bands, which it is connected to, an open café network, a hidden one
// and a neighbour's.
func nearby() []AccessPoint {
	return []AccessPoint{
		{
			SSID: "Home", BSSID: "aa:00:00:00:00:01", SignalPercent: 60, SignalDBm: -62, HasDBm: true, FrequencyMHz: 2437, WidthMHz: 20,
			Security: Security{Privacy: true, WPA2: true}, Generation: 6, MaxRateMbps: 286,
		},
		{
			SSID: "Home", BSSID: "aa:00:00:00:00:02", SignalPercent: 80, SignalDBm: -48, HasDBm: true, FrequencyMHz: 5180, WidthMHz: 80,
			Security: Security{Privacy: true, WPA2: true, WPA3: true}, Generation: 6, MaxRateMbps: 1201, Connected: true,
		},
		{SSID: "Café\x00 ", BSSID: "aa:00:00:00:00:03", SignalPercent: 30, FrequencyMHz: 2412},
		{SSID: "", BSSID: "aa:00:00:00:00:04", SignalPercent: 50, FrequencyMHz: 5500},
		{SSID: "Neighbour", BSSID: "aa:00:00:00:00:05", SignalPercent: 40, FrequencyMHz: 5955, Security: Security{Privacy: true, WPA3: true}},
	}
}

// item returns the value id of the group, or fails the test.
func item(t *testing.T, group metrics.Extra, id string) metrics.ExtraItem {
	t.Helper()
	for _, i := range group.Items {
		if i.ID == id {
			return i
		}
	}
	t.Fatalf("no value %s in %+v", id, group.Items)
	return metrics.ExtraItem{}
}

func TestNetworkExtrasDescribeEachNetwork(t *testing.T) {
	got := NetworkExtras(nearby())

	if len(got) != 1 || got[0].ID != "wifi-networks" || got[0].Titles["de"] == "" {
		t.Fatalf("NetworkExtras() = %+v, want one group of nearby networks", got)
	}
	group := got[0]
	if v := item(t, group, "in-range"); *v.Value != 3 || !v.History {
		t.Errorf("networks in range = %+v, want 3 with history", v)
	}
	if v := item(t, group, "hidden"); *v.Value != 1 {
		t.Errorf("hidden networks = %v, want 1", *v.Value)
	}
	if v := item(t, group, "connected"); v.Text != "Home" {
		t.Errorf("connected to %q, want Home", v.Text)
	}
	signal := item(t, group, "home-signal")
	if *signal.Value != 80 || !signal.History || signal.Section != "Home" || signal.Label != "Home: signal" || signal.Labels["de"] != "Home: Signal" {
		t.Errorf("Home's signal = %+v, want its strongest access point's, with history, in its section", signal)
	}
	if v := item(t, group, "home-channel"); v.Text != "36 · 5 GHz · 80 MHz (also 2.4 GHz)" || v.Texts["de"] != "36 · 5 GHz · 80 MHz (auch 2,4 GHz)" {
		t.Errorf("Home's channel = %q, %v", v.Text, v.Texts)
	}
	if v := item(t, group, "home-security"); v.Text != "WPA2/WPA3" {
		t.Errorf("Home's security = %q, want its best access point's", v.Text)
	}
	if v := item(t, group, "home-details"); v.Text != "-48 dBm · Wi-Fi 6 · up to 1201 Mbit/s · 2 access points" ||
		v.Texts["fr"] != "-48 dBm · Wi-Fi 6 · jusqu'à 1201 Mbit/s · 2 points d'accès" {
		t.Errorf("Home's details = %q, %v", v.Text, v.Texts)
	}
	if v := item(t, group, "caf-security"); v.Section != "Café" || v.Text != "Open" || v.Texts["es"] != "Abierta" {
		t.Errorf("the café's security = %+v", v)
	}
	if v := item(t, group, "neighbour-channel"); v.Text != "1 · 6 GHz" {
		t.Errorf("the neighbour's channel = %q", v.Text)
	}
	for _, i := range group.Items {
		if strings.HasPrefix(i.ID, "caf-details") {
			t.Errorf("the café has details, though nothing more is known of it: %+v", i)
		}
	}
	// Shown by name, whatever their signal.
	var sections []string
	for _, i := range group.Items {
		if i.Section != "" && (len(sections) == 0 || sections[len(sections)-1] != i.Section) {
			sections = append(sections, i.Section)
		}
	}
	if strings.Join(sections, ",") != "Café,Home,Neighbour" {
		t.Errorf("sections = %v, want them by name", sections)
	}
	if clean := metrics.CleanExtras(got, 64); len(clean[0].Items) != len(group.Items) {
		t.Errorf("CleanExtras keeps %d of %d values", len(clean[0].Items), len(group.Items))
	}
}

func TestNetworkExtrasKeepTheStrongestWithinAGroupsValues(t *testing.T) {
	var aps []AccessPoint
	for i := range 40 {
		aps = append(aps, AccessPoint{
			SSID: "Network " + string(rune('A'+i%26)) + string(rune('a'+i/26)), SignalPercent: float64(i), FrequencyMHz: 2412,
			Security: Security{Privacy: true, WPA2: true}, MaxRateMbps: 54,
		})
	}
	group := NetworkExtras(aps)[0]

	if len(group.Items) > 64 {
		t.Errorf("%d values, more than a group keeps by default", len(group.Items))
	}
	if v := item(t, group, "in-range"); *v.Value != 40 {
		t.Errorf("networks in range = %v, want all 40", *v.Value)
	}
	signals := 0
	for _, i := range group.Items {
		if strings.HasSuffix(i.ID, "-signal") {
			signals++
			if *i.Value < 40-maxNetworks {
				t.Errorf("%s with %v %% is among the strongest", i.Section, *i.Value)
			}
		}
	}
	if signals != maxNetworks {
		t.Errorf("%d networks, want %d", signals, maxNetworks)
	}
}

func TestNetworkExtrasWithoutWiFiReportNothing(t *testing.T) {
	if got := NetworkExtras(nil); got != nil {
		t.Errorf("NetworkExtras(nil) = %+v, want nothing", got)
	}
	got := NetworkExtras([]AccessPoint{})
	if len(got) != 1 || *item(t, got[0], "in-range").Value != 0 {
		t.Errorf("NetworkExtras() with nothing nearby = %+v, want no networks in range", got)
	}
}

func TestNetworkIDsStayApart(t *testing.T) {
	used := map[string]bool{}
	first := networkID("My Wi-Fi", used)
	second := networkID("my_wi.fi", used)
	emoji := networkID("📶📶", used)
	long := networkID(strings.Repeat("a", 32), used)

	if first != "my-wi-fi" || second == first || !strings.HasPrefix(second, "my-wi-fi-") {
		t.Errorf("ids %q and %q, want them apart", first, second)
	}
	for _, id := range []string{first, second, emoji, long} {
		if len(id)+len("-security") > 40 || id == "" || id[0] == '-' {
			t.Errorf("id %q does not fit", id)
		}
	}
	if again := networkID("📶📶", map[string]bool{}); again != emoji {
		t.Errorf("the id of a name changed from %q to %q", emoji, again)
	}
}

func TestNearbyReportsEachAccessPoint(t *testing.T) {
	got := Nearby([]AccessPoint{
		{
			SSID: "Den", BSSID: "aa:bb:cc:dd:ee:ff", SignalPercent: 70, SignalDBm: -55, HasDBm: true, FrequencyMHz: 5180, WidthMHz: 80,
			Security: Security{Privacy: true, WPA2: true, WPA3: true}, Generation: 6, Connected: true,
		},
		{SSID: "Den", BSSID: "aa:bb:cc:dd:ee:fb", SignalPercent: 60, FrequencyMHz: 2437},
		{SSID: "broken", BSSID: "not a mac", SignalPercent: 60},
	})
	if len(got.AccessPoints) != 2 {
		t.Fatalf("Nearby() = %+v, want both access points with an address", got.AccessPoints)
	}
	first := got.AccessPoints[0]
	if first.ID != "17226b1f68ae" || first.Box != "74c108fcc2a3" || first.Security != "WPA2/WPA3" || !first.Connected ||
		first.SignalDBm == nil || *first.SignalDBm != -55 || first.FrequencyMHz != 5180 || first.Generation != 6 {
		t.Errorf("Nearby()[0] = %+v", first)
	}
	if second := got.AccessPoints[1]; second.Box != first.Box || second.SignalDBm != nil || second.Security != "Open" {
		t.Errorf("Nearby()[1] = %+v, want the same box, no dBm and an open network", second)
	}
	if Nearby(nil) != nil {
		t.Error("Nearby(nil) should be nil on a machine without Wi-Fi")
	}
}
