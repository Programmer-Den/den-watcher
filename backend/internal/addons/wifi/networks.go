package wifi

import (
	"cmp"
	"fmt"
	"hash/crc32"
	"net"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// AccessPoint is one access point (BSS) the machine's Wi-Fi sees nearby, as
// its system last found it in the scans it makes on its own: the add-on
// starts no scan, it only reads what the system keeps.
type AccessPoint struct {
	// SSID is the network's name, empty for a hidden network.
	SSID string
	// BSSID is the access point's hardware address, such as
	// "aa:bb:cc:dd:ee:ff". It tells the access points of a network apart
	// and is never shown.
	BSSID string
	// SignalPercent is the signal from 0 to 100, as the system rates it.
	SignalPercent float64
	// SignalDBm is the signal in dBm, when HasDBm is true: NetworkManager
	// gives only the percentage.
	SignalDBm float64
	HasDBm    bool
	// FrequencyMHz is the centre of the primary channel in MHz, 0 when
	// unknown.
	FrequencyMHz int
	// WidthMHz is the width of the channel in MHz, 0 when unknown.
	WidthMHz int
	Security Security
	// Generation is the newest Wi-Fi generation the access point offers,
	// such as 6 for Wi-Fi 6 (802.11ax), 0 when unknown or older than Wi-Fi 4.
	Generation int
	// MaxRateMbps is the fastest rate the access point offers in Mbit/s, 0
	// when unknown.
	MaxRateMbps float64
	// Connected is whether the machine is connected to this access point.
	Connected bool
}

// Security is how a network is secured, from what its access point
// announces.
type Security struct {
	// Privacy is whether the network is encrypted at all; without any of the
	// others that means WEP.
	Privacy bool
	// WPA, WPA2 and WPA3 are the WPA versions offered: WPA2 with a
	// pre-shared key or 802.1X, WPA3 with SAE or Suite B.
	WPA, WPA2, WPA3 bool
	// Enterprise is whether it logs in through 802.1X, with a user or
	// certificate of its own, rather than a shared password.
	Enterprise bool
	// OWE is Opportunistic Wireless Encryption ("Enhanced Open"): encrypted
	// without a password.
	OWE bool
}

// Text returns how the network is secured in English, such as "WPA2/WPA3"
// or "WPA2 Enterprise", and the same in other languages where it differs.
func (s Security) Text() (string, map[string]string) {
	var versions []string
	for _, v := range []struct {
		on   bool
		name string
	}{{s.WPA, "WPA"}, {s.WPA2, "WPA2"}, {s.WPA3, "WPA3"}} {
		if v.on {
			versions = append(versions, v.name)
		}
	}
	switch {
	case len(versions) > 0:
		text := strings.Join(versions, "/")
		if s.Enterprise {
			text += " Enterprise"
		}
		return text, nil
	case s.OWE:
		return "OWE (Enhanced Open)", nil
	case s.Privacy:
		return "WEP", nil
	}
	return "Open", map[string]string{"de": "Offen", "fr": "Ouvert", "es": "Abierta"}
}

// strongerSecurity reports whether a is secured better than b, so a network
// whose access points differ shows its best one.
func strongerSecurity(a, b Security) bool {
	rank := func(s Security) int {
		switch {
		case s.WPA3:
			return 5
		case s.WPA2:
			return 4
		case s.WPA:
			return 3
		case s.OWE:
			return 2
		case s.Privacy:
			return 1
		}
		return 0
	}
	return rank(a) > rank(b)
}

// Channel returns the channel number of the frequency f in MHz, as Wi-Fi
// counts them in each band, or 0 for a frequency of none.
func Channel(f int) int {
	switch {
	case f == 2484:
		return 14
	case f >= 2412 && f <= 2472:
		return (f - 2407) / 5
	case f >= 5150 && f <= 5925:
		return (f - 5000) / 5
	case f > 5925 && f <= 7125:
		if f == 5935 {
			return 2
		}
		return (f - 5950) / 5
	case f >= 58320 && f <= 70200:
		return (f - 56160) / 2160
	}
	return 0
}

// Band returns the band of the frequency f in MHz in English, such as
// "2.4 GHz", and the same with a decimal comma for German, French and
// Spanish, or "" for a frequency of none.
func Band(f int) (string, map[string]string) {
	switch {
	case f >= 2400 && f < 2500:
		return "2.4 GHz", map[string]string{"de": "2,4 GHz", "fr": "2,4 GHz", "es": "2,4 GHz"}
	case f >= 5150 && f <= 5925:
		return "5 GHz", nil
	case f > 5925 && f <= 7125:
		return "6 GHz", nil
	case f >= 58320 && f <= 70200:
		return "60 GHz", nil
	}
	return "", nil
}

// maxNetworks is how many networks the add-on reports, the strongest: each
// takes four values, and with the group's three that keeps it within the 64
// values a group of extras keeps by default (HISTORY_MAX_ENTRIES).
const maxNetworks = 15

// staleAfter is how long after the system last found an access point in a
// scan it still counts as nearby. Systems scan on their own every few
// minutes, less often while connected with a good signal (NetworkManager's
// wpa_supplicant every 5 minutes then), and keep the access points they no
// longer find for a while.
const staleAfter = 15 * time.Minute

// network is what the access points of one network add up to.
type network struct {
	ssid string
	// best is the access point with the strongest signal.
	best         AccessPoint
	bands        map[string]bool
	security     Security
	generation   int
	maxRateMbps  float64
	accessPoints int
	connected    bool
}

// networksOf gathers the access points into networks by name, leaving out
// hidden networks, which have none, and returns the networks and how many
// hidden access points there were.
func networksOf(aps []AccessPoint) ([]*network, int) {
	byName := map[string]*network{}
	var networks []*network
	hidden := 0
	for _, ap := range aps {
		ssid := metrics.CleanSSID(ap.SSID)
		if ssid == "" {
			hidden++
			continue
		}
		n := byName[ssid]
		if n == nil {
			n = &network{ssid: ssid, best: ap, security: ap.Security, bands: map[string]bool{}}
			byName[ssid] = n
			networks = append(networks, n)
		} else if ap.SignalPercent > n.best.SignalPercent {
			n.best = ap
		}
		if band, _ := Band(ap.FrequencyMHz); band != "" {
			n.bands[band] = true
		}
		if strongerSecurity(ap.Security, n.security) {
			n.security = ap.Security
		}
		n.generation = max(n.generation, ap.Generation)
		n.maxRateMbps = max(n.maxRateMbps, ap.MaxRateMbps)
		n.accessPoints++
		n.connected = n.connected || ap.Connected
	}
	return networks, hidden
}

// NetworkExtras returns the nearby networks as the group of extras the
// collector shows: how many networks are in range (with its history), how
// many hidden access points, which network the machine is connected to, and
// for each of the maxNetworks strongest networks, in a section named after
// it, its signal (with its history, which shows when it was in range), its
// channel, how it is secured, and the rest that is known of it. A machine
// without Wi-Fi, or one whose system cannot be asked, reports nothing.
func NetworkExtras(aps []AccessPoint) []metrics.Extra {
	if aps == nil {
		return nil
	}
	networks, hidden := networksOf(aps)
	group := metrics.Extra{
		ID:     "wifi-networks",
		Title:  "Nearby Wi-Fi networks",
		Titles: map[string]string{"de": "WLAN-Netze in der Nähe", "fr": "Réseaux Wi-Fi à proximité", "es": "Redes Wi-Fi cercanas"},
		Description: "The Wi-Fi networks this device sees, from the scans its system makes on its own: " +
			"each one's signal, with its history showing when it was in range, channel, band and security.",
		Descriptions: map[string]string{
			"de": "Die WLAN-Netze, die dieses Gerät sieht, aus den Suchläufen, die sein System von sich aus macht: " +
				"Signal jedes Netzes, dessen Verlauf zeigt, wann es in Reichweite war, Kanal, Band und Sicherheit.",
			"fr": "Les réseaux Wi-Fi que cet appareil voit, d'après les recherches que son système fait de lui-même : " + //nolint:misspell // French
				"le signal de chacun, dont l'historique montre quand il était à portée, son canal, sa bande et sa sécurité.",
			"es": "Las redes Wi-Fi que ve este dispositivo, según las búsquedas que su sistema hace por sí mismo: " +
				"la señal de cada una, cuyo historial muestra cuándo estuvo al alcance, su canal, su banda y su seguridad.",
		},
		Items: []metrics.ExtraItem{
			{
				ID:      "in-range",
				Label:   "Networks in range",
				Labels:  map[string]string{"de": "Netze in Reichweite", "fr": "Réseaux à portée", "es": "Redes al alcance"},
				Unit:    metrics.UnitNumber,
				Value:   new(float64(len(networks))),
				History: true,
			},
			{
				ID:     "hidden",
				Label:  "Hidden networks",
				Labels: map[string]string{"de": "Versteckte Netze", "fr": "Réseaux masqués", "es": "Redes ocultas"},
				Unit:   metrics.UnitNumber,
				Value:  new(float64(hidden)),
			},
		},
	}
	for _, n := range networks {
		if n.connected {
			group.Items = append(group.Items, metrics.ExtraItem{
				ID:     "connected",
				Label:  "Connected to",
				Labels: map[string]string{"de": "Verbunden mit", "fr": "Connecté à", "es": "Conectado a"},
				Unit:   metrics.UnitText,
				Text:   n.ssid,
			})
			break
		}
	}
	// The strongest, then shown by name, so they keep their place while
	// their signal changes.
	slices.SortStableFunc(networks, func(a, b *network) int { return cmp.Compare(b.best.SignalPercent, a.best.SignalPercent) })
	networks = networks[:min(len(networks), maxNetworks)]
	slices.SortStableFunc(networks, func(a, b *network) int {
		return cmp.Or(cmp.Compare(strings.ToLower(a.ssid), strings.ToLower(b.ssid)), cmp.Compare(a.ssid, b.ssid))
	})
	for _, n := range networks {
		group.Items = append(group.Items, networkItems(n, networkID(n.ssid))...)
	}
	return []metrics.Extra{group}
}

// networkItems returns the values of one network, with ids that start with
// id.
func networkItems(n *network, id string) []metrics.ExtraItem {
	item := func(suffix, what string, whats map[string]string) metrics.ExtraItem {
		labels := map[string]string{}
		for language, w := range whats {
			labels[language] = n.ssid + ": " + w
		}
		return metrics.ExtraItem{ID: id + suffix, Label: n.ssid + ": " + what, Labels: labels, Section: n.ssid}
	}
	signal := item("-signal", "signal", map[string]string{"de": "Signal", "fr": "signal", "es": "señal"})
	signal.Unit, signal.Value, signal.History = metrics.UnitPercent, new(n.best.SignalPercent), true
	items := []metrics.ExtraItem{signal}

	if text, texts := channelText(n); text != "" {
		channel := item("-channel", "channel", map[string]string{"de": "Kanal", "fr": "canal", "es": "canal"})
		channel.Unit, channel.Text, channel.Texts = metrics.UnitText, text, texts
		items = append(items, channel)
	}

	security := item("-security", "security", map[string]string{"de": "Sicherheit", "fr": "sécurité", "es": "seguridad"})
	security.Unit = metrics.UnitText
	security.Text, security.Texts = n.security.Text()
	items = append(items, security)

	if text, texts := detailsText(n); text != "" {
		details := item("-details", "details", map[string]string{"de": "Details", "fr": "détails", "es": "detalles"})
		details.Unit, details.Text, details.Texts = metrics.UnitText, text, texts
		items = append(items, details)
	}
	return items
}

// languages are the languages the add-on's texts come in besides English.
var languages = []string{"de", "fr", "es"}

// channelText returns the channel of a network's strongest access point,
// with its band and width, such as "36 · 5 GHz · 80 MHz", and the bands of
// its other access points, such as "6 · 2.4 GHz · 20 MHz (also 5 GHz)".
func channelText(n *network) (string, map[string]string) {
	f := n.best.FrequencyMHz
	band, bands := Band(f)
	if band == "" {
		return "", nil
	}
	parts := map[string][]string{}
	add := func(en string, texts map[string]string) {
		parts["en"] = append(parts["en"], en)
		for _, language := range languages {
			parts[language] = append(parts[language], cmp.Or(texts[language], en))
		}
	}
	if channel := Channel(f); channel > 0 {
		add(strconv.Itoa(channel), nil)
	}
	add(band, bands)
	if n.best.WidthMHz > 0 {
		add(fmt.Sprintf("%d MHz", n.best.WidthMHz), nil)
	}
	en := strings.Join(parts["en"], " · ")
	texts := map[string]string{}
	for _, language := range languages {
		texts[language] = strings.Join(parts[language], " · ")
	}
	var others []string
	for other := range n.bands {
		if other != band {
			others = append(others, other)
		}
	}
	if len(others) > 0 {
		slices.Sort(others)
		also := strings.Join(others, ", ")
		en += " (also " + also + ")"
		decimal := strings.ReplaceAll(also, "2.4", "2,4")
		texts["de"] += " (auch " + decimal + ")"
		texts["fr"] += " (aussi " + decimal + ")"
		texts["es"] += " (también " + decimal + ")"
	}
	return en, texts
}

// detailsText returns what else is known of a network: the signal of its
// strongest access point in dBm, its Wi-Fi generation, its fastest rate and
// how many access points it has, such as "-58 dBm · Wi-Fi 6 · up to
// 1201 Mbit/s · 3 access points".
func detailsText(n *network) (string, map[string]string) {
	parts := map[string][]string{}
	add := func(en, de, fr, es string) {
		parts["en"] = append(parts["en"], en)
		parts["de"] = append(parts["de"], de)
		parts["fr"] = append(parts["fr"], fr)
		parts["es"] = append(parts["es"], es)
	}
	if n.best.HasDBm {
		dBm := fmt.Sprintf("%d dBm", int(n.best.SignalDBm))
		add(dBm, dBm, dBm, dBm)
	}
	if n.generation >= 4 {
		name := fmt.Sprintf("Wi-Fi %d", n.generation)
		if n.generation == 6 && n.bands["6 GHz"] {
			name = "Wi-Fi 6E"
		}
		add(name, name, name, name)
	}
	if n.maxRateMbps > 0 {
		rate := strconv.FormatFloat(n.maxRateMbps, 'f', 0, 64)
		add("up to "+rate+" Mbit/s", "bis "+rate+" Mbit/s", "jusqu'à "+rate+" Mbit/s", "hasta "+rate+" Mbit/s")
	}
	if n.accessPoints > 1 {
		count := strconv.Itoa(n.accessPoints)
		add(count+" access points", count+" Zugangspunkte", count+" points d'accès", count+" puntos de acceso")
	}
	if len(parts["en"]) == 0 {
		return "", nil
	}
	texts := map[string]string{}
	for _, language := range languages {
		texts[language] = strings.Join(parts[language], " · ")
	}
	return strings.Join(parts["en"], " · "), texts
}

// networkID returns the id the values of the network ssid start with: its
// name in lowercase letters and digits, short enough for the longest suffix
// ("-security") to fit in an id's 40 characters. Only a name that is such an
// id already keeps it as it is; any other ends in a checksum of the whole
// name, so two names that turn into the same letters, such as "My Wi-Fi"
// and "my_wi.fi", keep ids of their own whichever of them is in range.
func networkID(ssid string) string {
	const room = 40 - len("-security")
	if id := metrics.ShortID(ssid, room); id == ssid {
		return id
	}
	sum := fmt.Sprintf("%08x", crc32.ChecksumIEEE([]byte(ssid)))
	return strings.TrimLeft(metrics.ShortID(ssid, room-9)+"-"+sum, "-")
}

// Nearby returns each access point on its own, for a hub to compare what its
// devices see (see metrics.NearbyWiFi), leaving out those whose hardware
// address cannot be read. A machine without Wi-Fi, or one whose system
// cannot be asked, reports nothing.
func Nearby(aps []AccessPoint) *metrics.NearbyWiFi {
	if aps == nil {
		return nil
	}
	nearby := &metrics.NearbyWiFi{AccessPoints: []metrics.NearbyAccessPoint{}}
	for _, ap := range aps {
		address, err := net.ParseMAC(ap.BSSID)
		if err != nil || len(address) != 6 {
			continue
		}
		security, _ := ap.Security.Text()
		n := metrics.NearbyAccessPoint{
			ID:            metrics.AccessPointID(address, false),
			Box:           metrics.AccessPointID(address, true),
			SSID:          metrics.CleanSSID(ap.SSID),
			SignalPercent: ap.SignalPercent,
			FrequencyMHz:  ap.FrequencyMHz,
			WidthMHz:      ap.WidthMHz,
			Security:      security,
			Generation:    ap.Generation,
			MaxRateMbps:   ap.MaxRateMbps,
			Connected:     ap.Connected,
		}
		if ap.HasDBm {
			n.SignalDBm = new(ap.SignalDBm)
		}
		nearby.AccessPoints = append(nearby.AccessPoints, n)
	}
	return metrics.CleanNearbyWiFi(nearby)
}
