package history

import (
	"cmp"
	"context"
	"encoding/json"
	"math"
	"slices"
	"sort"
	"strings"
	"time"
)

const (
	// PositionMeters is how close the phones' scans must be to the first
	// scan of a place to count as made at that place: about as far as a
	// Wi-Fi reaches.
	PositionMeters = 100
	// PositionMaxAccuracy is the vaguest point of a route, in meters, that
	// places a scan: a position from a far cell tower tells nothing of which
	// networks are where.
	PositionMaxAccuracy = 250
	// positionBefore is how long before a scan the point of the route that
	// places it may be: the app keeps a point every 15 minutes while the
	// phone stays where it is, and a new one as soon as it moves.
	positionBefore = 20 * time.Minute
	// positionAfter is how long after a scan the point may be, when it is
	// closer in time than the one before.
	positionAfter = 5 * time.Minute
	// MaxPositionScans is how many scans WiFiPositions reads at most: the
	// newest, a month of a few phones.
	MaxPositionScans = 20000
	// MaxPositions is how many places WiFiPositions returns at most: those
	// with the most scans.
	MaxPositions = 300
)

// WiFiPosition is a place the phones scanned the Wi-Fi networks at, with
// every network they heard there, all phones together.
type WiFiPosition struct {
	// Lat and Lon are the middle of the scans' points, in degrees.
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
	// AnchorLat and AnchorLon are the point of the first scan, which the
	// others are measured from: they stay while new scans move the middle,
	// and are more than PositionMeters from every other place's, so the
	// page keeps a picked place by them.
	AnchorLat float64 `json:"anchorLat"`
	AnchorLon float64 `json:"anchorLon"`
	// Scans is how many scans were made there, First and Last when, in
	// Unix seconds.
	Scans int   `json:"scans"`
	First int64 `json:"first"`
	Last  int64 `json:"last"`
	// Devices are the phones that scanned there, in the order they first did.
	Devices  []string          `json:"devices"`
	Networks []PositionNetwork `json:"networks"`
	// Related are the other places whose scans heard some of the same access
	// points, the most alike first, at most MaxRelated: places the position
	// may have been told wrong at, or that are next to each other.
	Related []RelatedPosition `json:"related,omitempty"`
}

// RelatedPosition is another place that heard some of the same access
// points as a place.
type RelatedPosition struct {
	// Place is its index among the places returned.
	Place int `json:"place"`
	// Shared is how many access points both heard; Percent is that share
	// of all access points either heard.
	Shared  int     `json:"shared"`
	Percent float64 `json:"percent"`
}

// MaxRelated is how many related places a place tells at most.
const MaxRelated = 5

// PositionNetwork is a Wi-Fi network heard at a place, by its name: all
// access points of the name together, the best signal of them.
type PositionNetwork struct {
	// SSID is left out for a hidden network, which ID then tells apart; a
	// hidden network of a scan stored before IDs were kept has neither.
	SSID string `json:"ssid,omitempty"`
	ID   string `json:"id,omitempty"`
	// AccessPoints is how many access points were heard with the name; 0
	// when the scans did not tell them apart.
	AccessPoints   int     `json:"accessPoints,omitempty"`
	FrequenciesMHz []int   `json:"frequenciesMHz,omitempty"`
	Security       string  `json:"security,omitempty"`
	SignalPercent  float64 `json:"signalPercent"`
	// Last is when it was last heard there, in Unix seconds.
	Last      int64 `json:"last"`
	Connected bool  `json:"connected,omitempty"`
	// Devices are the phones that heard it there, the one hearing it best
	// first.
	Devices []PositionSighting `json:"devices"`
}

// PositionSighting is how one phone heard a network at a place.
type PositionSighting struct {
	Device        string  `json:"device"`
	SignalPercent float64 `json:"signalPercent"`
	Last          int64   `json:"last"`
	Scans         int     `json:"scans"`
}

// positionPoint is a point of a phone's route, Time in Unix milliseconds,
// accuracy in meters.
type positionPoint struct {
	time     int64
	lat, lon float64
	accuracy float64
}

// WiFiPositions returns the places the phones scanned the Wi-Fi networks at
// from from up to (not including) to, the one with the most scans first, at
// most MaxPositions: each scan of the newest MaxPositionScans is placed at
// the point of its phone's route closest in time to it, as placeAt finds it
// for one vaguer than PositionMaxAccuracy, and counts to the first place
// within PositionMeters of that point.
func (s *Store) WiFiPositions(ctx context.Context, from, to time.Time) ([]WiFiPosition, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT device, time, networks FROM phone_scans
		WHERE time >= ? AND time < ? ORDER BY time DESC LIMIT ?`, from.Unix(), to.Unix(), MaxPositionScans)
	if err != nil {
		return nil, err
	}
	type scan struct {
		device   string
		time     int64
		networks string
	}
	var scans []scan
	err = scanRows(rows, func() error {
		var sc scan
		if err := rows.Scan(&sc.device, &sc.time, &sc.networks); err != nil {
			return err
		}
		scans = append(scans, sc)
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(scans) == 0 {
		return []WiFiPosition{}, nil
	}
	slices.Reverse(scans)
	// Only the points that can place the scans read: the newest scans of a
	// long range may be far fewer than the points of all routes in it.
	var devices []string
	for _, sc := range scans {
		if !slices.Contains(devices, sc.device) {
			devices = append(devices, sc.device)
		}
	}
	routes, err := s.positionPoints(ctx, devices,
		time.Unix(scans[0].time, 0).Add(-positionBefore),
		time.Unix(scans[len(scans)-1].time, 0).Add(positionAfter+time.Second))
	if err != nil {
		return nil, err
	}

	var grouper positionGrouper
	for _, sc := range scans {
		p, ok := placeAt(routes[sc.device], sc.time*1000)
		if !ok {
			continue
		}
		var networks []ScannedNetwork
		if err := json.Unmarshal([]byte(sc.networks), &networks); err != nil {
			return nil, err
		}
		grouper.add(p, sc.device, sc.time, networks)
	}
	return grouper.positions(), nil
}

// positionPoints reads the points of the devices' routes from from up to
// to, by phone, oldest first.
func (s *Store) positionPoints(ctx context.Context, devices []string, from, to time.Time) (map[string][]positionPoint, error) {
	args := []any{from.UnixMilli(), to.UnixMilli()}
	for _, d := range devices {
		args = append(args, d)
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT device, time, lat, lon, accuracy FROM route_points
		WHERE time >= ? AND time < ? AND device IN (?`+strings.Repeat(", ?", len(devices)-1)+`)
		ORDER BY time`, args...)
	if err != nil {
		return nil, err
	}
	routes := map[string][]positionPoint{}
	err = scanRows(rows, func() error {
		var device string
		var p positionPoint
		if err := rows.Scan(&device, &p.time, &p.lat, &p.lon, &p.accuracy); err != nil {
			return err
		}
		routes[device] = append(routes[device], p)
		return nil
	})
	return routes, err
}

// pointAt returns the point of a route, oldest first, that places a scan at
// t, Unix milliseconds: the closest in time of the last one up to
// positionBefore before it and the first one up to positionAfter after it.
func pointAt(route []positionPoint, t int64) (positionPoint, bool) {
	i := sort.Search(len(route), func(i int) bool { return route[i].time > t })
	var best positionPoint
	found := false
	if i > 0 && t-route[i-1].time <= positionBefore.Milliseconds() {
		best, found = route[i-1], true
	}
	if i < len(route) && route[i].time-t <= positionAfter.Milliseconds() && (!found || route[i].time-t < t-best.time) {
		best, found = route[i], true
	}
	return best, found
}

// placeAt returns the point of a route, oldest first, that places a scan at
// t, Unix milliseconds: the one pointAt finds, if it is not vaguer than
// PositionMaxAccuracy. If it is, the closest in time of the others that are
// not, within the same time, places it only if it lies within the vague
// one's accuracy: the phone may have stayed where it was, but it may also
// have moved, and a scan of another place must not count at the old one.
func placeAt(route []positionPoint, t int64) (positionPoint, bool) {
	p, ok := pointAt(route, t)
	if !ok || p.accuracy <= PositionMaxAccuracy {
		return p, ok
	}
	from := sort.Search(len(route), func(i int) bool { return route[i].time >= t-positionBefore.Milliseconds() })
	to := sort.Search(len(route), func(i int) bool { return route[i].time > t+positionAfter.Milliseconds() })
	var precise []positionPoint
	for _, q := range route[from:to] {
		if q.accuracy <= PositionMaxAccuracy {
			precise = append(precise, q)
		}
	}
	q, ok := pointAt(precise, t)
	if !ok || distanceMeters(q.lat, q.lon, p.lat, p.lon) > p.accuracy {
		return positionPoint{}, false
	}
	return q, true
}

// metersPerDegree is how long a degree of latitude is, in meters.
const metersPerDegree = 6_371_000 * math.Pi / 180

// cell is a square of the grid the places are found by, about
// PositionMeters wide.
type cell struct{ row, col int64 }

// positionGrouper groups scans into places.
type positionGrouper struct {
	places []*placeScans
	grid   map[cell][]int
}

// placeScans is what the scans at one place found so far.
type placeScans struct {
	// lat and lon are those of the first scan, which the others are
	// measured from, so a place does not wander off along a way.
	lat, lon       float64
	sumLat, sumLon float64
	scans          int
	first, last    int64
	devices        []string
	networks       map[string]*networkScans
}

// networkScans is what the scans at a place found of one network.
type networkScans struct {
	PositionNetwork
	ids         map[string]bool
	frequencies map[int]bool
	sightings   map[string]*PositionSighting
}

// cellSize is the size of a cell, in degrees of latitude.
const cellSize = PositionMeters / metersPerDegree

func cellRow(lat float64) int64 { return int64(math.Floor(lat / cellSize)) }

// cellCol is the column of lon in a row, whose cells are as wide in meters
// as they are high.
func cellCol(row int64, lon float64) int64 {
	middle := (float64(row) + 0.5) * cellSize
	return int64(math.Floor(lon / (cellSize / math.Max(math.Cos(middle*math.Pi/180), 0.01))))
}

// distanceMeters is how far apart two points are along the earth.
func distanceMeters(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	h := math.Pow(math.Sin(dLat/2), 2) + math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Pow(math.Sin(dLon/2), 2)
	return 2 * 6_371_000 * math.Atan2(math.Sqrt(h), math.Sqrt(1-h))
}

// find returns the place closest to p within PositionMeters, or -1.
func (g *positionGrouper) find(p positionPoint) int {
	best, bestMeters := -1, float64(PositionMeters)
	row := cellRow(p.lat)
	for r := row - 1; r <= row+1; r++ {
		col := cellCol(r, p.lon)
		for c := col - 1; c <= col+1; c++ {
			for _, i := range g.grid[cell{r, c}] {
				place := g.places[i]
				if d := distanceMeters(place.lat, place.lon, p.lat, p.lon); d <= bestMeters {
					best, bestMeters = i, d
				}
			}
		}
	}
	return best
}

// add counts a scan of device at t, Unix seconds, placed at p.
func (g *positionGrouper) add(p positionPoint, device string, t int64, networks []ScannedNetwork) {
	i := g.find(p)
	if i < 0 {
		if g.grid == nil {
			g.grid = map[cell][]int{}
		}
		i = len(g.places)
		g.places = append(g.places, &placeScans{lat: p.lat, lon: p.lon, first: t, networks: map[string]*networkScans{}})
		row := cellRow(p.lat)
		key := cell{row, cellCol(row, p.lon)}
		g.grid[key] = append(g.grid[key], i)
	}
	place := g.places[i]
	place.sumLat += p.lat
	place.sumLon += p.lon
	place.scans++
	place.last = t
	if !slices.Contains(place.devices, device) {
		place.devices = append(place.devices, device)
	}
	for _, n := range networks {
		key := n.SSID
		if key == "" {
			key = "\x00" + n.ID
		}
		network := place.networks[key]
		if network == nil {
			network = &networkScans{ids: map[string]bool{}, frequencies: map[int]bool{}, sightings: map[string]*PositionSighting{}}
			network.SSID = n.SSID
			if n.SSID == "" {
				network.ID = n.ID
			}
			place.networks[key] = network
		}
		if n.ID != "" {
			network.ids[n.ID] = true
		}
		if n.FrequencyMHz > 0 {
			network.frequencies[n.FrequencyMHz] = true
		}
		if n.SignalPercent >= network.SignalPercent {
			network.SignalPercent = n.SignalPercent
			if n.Security != "" {
				network.Security = n.Security
			}
		}
		network.Last = t
		network.Connected = network.Connected || n.Connected
		sighting := network.sightings[device]
		if sighting == nil {
			sighting = &PositionSighting{Device: device}
			network.sightings[device] = sighting
		}
		sighting.SignalPercent = max(sighting.SignalPercent, n.SignalPercent)
		// A scan that heard several access points of the name counts once.
		if sighting.Scans == 0 || sighting.Last != t {
			sighting.Scans++
		}
		sighting.Last = t
	}
}

// positions returns the places found, the one with the most scans first, at
// most MaxPositions, each with its networks, the best heard first.
func (g *positionGrouper) positions() []WiFiPosition {
	places := slices.Clone(g.places)
	slices.SortStableFunc(places, func(a, b *placeScans) int {
		return cmp.Or(cmp.Compare(b.scans, a.scans), cmp.Compare(b.last, a.last))
	})
	if len(places) > MaxPositions {
		places = places[:MaxPositions]
	}
	positions := make([]WiFiPosition, 0, len(places))
	heard := make([]map[string]bool, 0, len(places))
	for _, place := range places {
		networks := make([]PositionNetwork, 0, len(place.networks))
		for _, n := range place.networks {
			network := n.PositionNetwork
			network.AccessPoints = len(n.ids)
			for f := range n.frequencies {
				network.FrequenciesMHz = append(network.FrequenciesMHz, f)
			}
			slices.Sort(network.FrequenciesMHz)
			for _, sighting := range n.sightings {
				network.Devices = append(network.Devices, *sighting)
			}
			slices.SortFunc(network.Devices, func(a, b PositionSighting) int {
				return cmp.Or(cmp.Compare(b.SignalPercent, a.SignalPercent), cmp.Compare(a.Device, b.Device))
			})
			networks = append(networks, network)
		}
		slices.SortFunc(networks, func(a, b PositionNetwork) int {
			return cmp.Or(cmp.Compare(b.SignalPercent, a.SignalPercent), cmp.Compare(a.SSID, b.SSID), cmp.Compare(a.ID, b.ID))
		})
		heard = append(heard, heardAt(place))
		positions = append(positions, WiFiPosition{
			Lat:       round6(place.sumLat / float64(place.scans)),
			Lon:       round6(place.sumLon / float64(place.scans)),
			AnchorLat: round6(place.lat),
			AnchorLon: round6(place.lon),
			Scans:     place.scans,
			First:     place.first,
			Last:      place.last,
			Devices:   place.devices,
			Networks:  networks,
		})
	}
	relate(positions, heard)
	return positions
}

// heardAt returns what tells the access points heard at a place apart: their
// IDs, or the name of a network whose scans had no IDs, as those stored
// before the IDs were kept.
func heardAt(place *placeScans) map[string]bool {
	heard := map[string]bool{}
	for _, n := range place.networks {
		for id := range n.ids {
			heard[id] = true
		}
		if len(n.ids) == 0 && n.SSID != "" {
			heard["ssid:"+n.SSID] = true
		}
	}
	return heard
}

// relate tells each place the others that heard some of the same access
// points, by heard, the most alike first.
func relate(positions []WiFiPosition, heard []map[string]bool) {
	at := map[string][]int{}
	for i, keys := range heard {
		for key := range keys {
			at[key] = append(at[key], i)
		}
	}
	for i, keys := range heard {
		shared := map[int]int{}
		for key := range keys {
			for _, j := range at[key] {
				if j != i {
					shared[j]++
				}
			}
		}
		related := make([]RelatedPosition, 0, len(shared))
		for j, count := range shared {
			all := len(keys) + len(heard[j]) - count
			related = append(related, RelatedPosition{Place: j, Shared: count, Percent: math.Round(float64(count) / float64(all) * 100)})
		}
		slices.SortFunc(related, func(a, b RelatedPosition) int {
			return cmp.Or(cmp.Compare(b.Percent, a.Percent), cmp.Compare(b.Shared, a.Shared), cmp.Compare(a.Place, b.Place))
		})
		if len(related) > MaxRelated {
			related = related[:MaxRelated]
		}
		if len(related) > 0 {
			positions[i].Related = related
		}
	}
}

// round6 rounds degrees to 6 places, about 10 cm, which keeps the answer short.
func round6(degrees float64) float64 { return math.Round(degrees*1e6) / 1e6 }
