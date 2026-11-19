package history

import (
	"cmp"
	"context"
	"encoding/json"
	"math"
	"slices"
	"sort"
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
	// positionVagueMeters is how far a vague point's middle may be from a
	// precise one at least, for that to place a scan the vague one is closer
	// to in time; at most half its accuracy otherwise: a vague point further
	// off tells the phone may have moved.
	positionVagueMeters = 2 * PositionMaxAccuracy
	// positionVagueMaxMeters is how far a vague point's middle may be from
	// the precise one at most, however vague it is: a fix from a far cell
	// tower kilometres off tells nothing of where the phone stayed.
	positionVagueMaxMeters = 4 * PositionMaxAccuracy
	// MaxPositionScans is how many scans WiFiPositions reads at most: the
	// newest of the range, a month of a few phones.
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
	// ID tells the place apart from the others and stays the same as the
	// range moves on or changes: the hub keeps the places (see
	// positionPlaceSchema). Name is what the user called it, if anything.
	ID   int64  `json:"id"`
	Name string `json:"name,omitempty"`
	// Merged are the places the user merged into this one, whose scans count
	// to it; Apart those the user keeps apart from it.
	Merged []int64 `json:"merged,omitempty"`
	Apart  []int64 `json:"apart,omitempty"`
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
// from from up to (not including) to, named ones first, then the one with
// the most scans first, at most MaxPositions. Each scan is placed at the
// point of its phone's route that placeAt finds, and counts to the closest
// place the hub keeps within PositionMeters of the first scan there, or to
// the one that place was merged into; a scan far from all of them starts a
// new place, which the hub keeps from then on, so a place keeps its ID as
// the range moves on or changes. Of the scans in the range, the newest
// MaxPositionScans are read.
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
	// Only the points that can place the scans read: those of their phones
	// over their time.
	seen := map[string]bool{}
	var devices []string
	for _, sc := range scans {
		if !seen[sc.device] {
			seen[sc.device] = true
			devices = append(devices, sc.device)
		}
	}
	routes, err := s.positionPoints(ctx, devices,
		time.Unix(scans[0].time, 0).Add(-positionBefore),
		time.Unix(scans[len(scans)-1].time, 0).Add(positionAfter+time.Second))
	if err != nil {
		return nil, err
	}

	// One at a time, so two reads do not both start a place at the same spot.
	s.placing.Lock()
	defer s.placing.Unlock()
	grouper, err := s.positionGrouper(ctx)
	if err != nil {
		return nil, err
	}
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
	if err := s.keepPositionPlaces(ctx, grouper); err != nil {
		return nil, err
	}
	return grouper.positions(), nil
}

// positionPoints reads the points of the devices' routes from from up to
// to, by phone, oldest first.
func (s *Store) positionPoints(ctx context.Context, devices []string, from, to time.Time) (map[string][]positionPoint, error) {
	list, err := json.Marshal(devices)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT device, time, lat, lon, accuracy FROM route_points
		WHERE device IN (SELECT value FROM json_each(?)) AND time >= ? AND time < ?
		ORDER BY device, time`, string(list), from.UnixMilli(), to.UnixMilli())
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

// pointAt returns the index of the point of a route, oldest first, that is
// closest in time to a scan at t, Unix milliseconds, of those accepted: the
// last one up to positionBefore before it and the first one up to
// positionAfter after it, the earlier one when both are as close; -1 when
// there is none. i is where t would go in the route.
func pointAt(route []positionPoint, i int, t int64, accept func(positionPoint) bool) int {
	best := -1
	for j := i - 1; j >= 0 && t-route[j].time <= positionBefore.Milliseconds(); j-- {
		if accept(route[j]) {
			best = j
			break
		}
	}
	for j := i; j < len(route) && route[j].time-t <= positionAfter.Milliseconds(); j++ {
		if accept(route[j]) {
			if best < 0 || route[j].time-t < t-route[best].time {
				best = j
			}
			break
		}
	}
	return best
}

// placeAt returns the point of a route, oldest first, that places a scan at
// t, Unix milliseconds: the one closest in time, if it is not vaguer than
// PositionMaxAccuracy. If it is, a precise point within the same time
// places the scan only if every point between it and the scan agrees that
// the phone stayed: each within its own accuracy and PositionMeters of it,
// and the vague one also within half its accuracy, at least
// positionVagueMeters and at most positionVagueMaxMeters, and always within
// its accuracy.
// The precise point closest in time is tried first, then the one on the
// other side of the scan. A scan of another place, after the phone moved,
// must not count at the old one.
func placeAt(route []positionPoint, t int64) (positionPoint, bool) {
	i := sort.Search(len(route), func(i int) bool { return route[i].time > t })
	closest := pointAt(route, i, t, func(positionPoint) bool { return true })
	if closest < 0 {
		return positionPoint{}, false
	}
	if route[closest].accuracy <= PositionMaxAccuracy {
		return route[closest], true
	}
	precise := func(p positionPoint) bool { return p.accuracy <= PositionMaxAccuracy }
	before := pointAt(route[:i], i, t, precise)
	after := pointAt(route[i:], 0, t, precise)
	if after >= 0 {
		after += i
	}
	tries := []int{before, after}
	if before < 0 || (after >= 0 && route[after].time-t < t-route[before].time) {
		tries = []int{after, before}
	}
	for _, j := range tries {
		vague := route[closest]
		if j >= 0 && stayed(route, j, closest) &&
			distanceMeters(route[j].lat, route[j].lon, vague.lat, vague.lon) <= min(max(vague.accuracy/2, positionVagueMeters), positionVagueMaxMeters, vague.accuracy) {
			return route[j], true
		}
	}
	return positionPoint{}, false
}

// stayed tells whether the points of a route from j to the point closest
// in time to the scan, k, which lie on either side of the scan, all agree
// that the phone stayed at point j: each within its own accuracy and
// PositionMeters of it.
func stayed(route []positionPoint, j, k int) bool {
	q := route[j]
	for _, r := range route[min(j, k) : max(j, k)+1] {
		if distanceMeters(q.lat, q.lon, r.lat, r.lon) > r.accuracy+PositionMeters {
			return false
		}
	}
	return true
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
	// byID is the index of each kept place in places, by its ID.
	byID map[int64]int
}

// placeScans is a place and what the scans at it found so far.
type placeScans struct {
	// id is the place's ID, 0 until a new one is kept; lat and lon are where
	// its first scan was, which the others are measured from, so a place
	// does not wander off along a way.
	id       int64
	lat, lon float64
	name     string
	// mergedInto is the ID of the place it was merged into, or 0.
	mergedInto int64
	apart      []int64
	// kept is the newest scan the hub has counted to it, newest the newest
	// counted to it now, in Unix seconds.
	kept, newest   int64
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

// at returns the place a scan at p falls in: the closest within
// PositionMeters, or a new one there.
func (g *positionGrouper) at(p positionPoint) *placeScans {
	i := g.find(p)
	if i < 0 {
		i = g.keep(&placeScans{lat: p.lat, lon: p.lon})
	}
	return g.places[i]
}

// keep adds a place to the grouper and returns its index.
func (g *positionGrouper) keep(place *placeScans) int {
	if g.grid == nil {
		g.grid = map[cell][]int{}
		g.byID = map[int64]int{}
	}
	if place.networks == nil {
		place.networks = map[string]*networkScans{}
	}
	i := len(g.places)
	g.places = append(g.places, place)
	if place.id != 0 {
		g.byID[place.id] = i
	}
	row := cellRow(place.lat)
	key := cell{row, cellCol(row, place.lon)}
	g.grid[key] = append(g.grid[key], i)
	return i
}

// root returns the place the scans of place count to: the one it was merged
// into, if that is still kept.
func (g *positionGrouper) root(place *placeScans) *placeScans {
	for range len(g.places) {
		i, ok := g.byID[place.mergedInto]
		if place.mergedInto == 0 || !ok {
			break
		}
		place = g.places[i]
	}
	return place
}

// add counts a scan of device at t, Unix seconds, placed at p.
func (g *positionGrouper) add(p positionPoint, device string, t int64, networks []ScannedNetwork) {
	direct := g.at(p)
	direct.newest = max(direct.newest, t)
	place := g.root(direct)
	if place.scans == 0 {
		place.first = t
	}
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

// positions returns the places found, the named ones first, then the one
// with the most scans first, at most MaxPositions, each with its networks,
// the best heard first.
func (g *positionGrouper) positions() []WiFiPosition {
	merged := map[int64][]int64{}
	for _, place := range g.places {
		if place.mergedInto != 0 && place.id != 0 {
			if root := g.root(place); root != place {
				merged[root.id] = append(merged[root.id], place.id)
			}
		}
	}
	places := slices.DeleteFunc(slices.Clone(g.places), func(p *placeScans) bool { return p.scans == 0 })
	slices.SortStableFunc(places, func(a, b *placeScans) int {
		named := func(p *placeScans) bool { return p.name != "" }
		return cmp.Or(compareBool(named(b), named(a)), cmp.Compare(b.scans, a.scans), cmp.Compare(b.last, a.last), cmp.Compare(a.id, b.id))
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
			Lat:      round6(place.sumLat / float64(place.scans)),
			Lon:      round6(place.sumLon / float64(place.scans)),
			ID:       place.id,
			Name:     place.name,
			Merged:   slices.Sorted(slices.Values(merged[place.id])),
			Apart:    place.apart,
			Scans:    place.scans,
			First:    place.first,
			Last:     place.last,
			Devices:  place.devices,
			Networks: networks,
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

// compareBool orders false before true.
func compareBool(a, b bool) int {
	switch {
	case a == b:
		return 0
	case a:
		return 1
	}
	return -1
}

// round6 rounds degrees to 6 places, about 10 cm, which keeps the answer short.
func round6(degrees float64) float64 { return math.Round(degrees*1e6) / 1e6 }
