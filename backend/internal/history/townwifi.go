package history

import (
	"cmp"
	"context"
	"encoding/json"
	"math"
	"slices"
	"time"
)

const (
	// TownSpreadMeters is how far apart the points that heard an access
	// point may be at most for it to stay put: one heard further apart
	// moves, such as a phone's hotspot or a bus's Wi-Fi, and places nothing.
	TownSpreadMeters = 1000
	// townMinMeters is how sure a spot or a position is at best, in meters:
	// a phone's GPS is rarely closer.
	townMinMeters = 15
	// townMinSignal is the weakest signal a scan counts with, in percent, so
	// an access point heard at 0 % still counts a little.
	townMinSignal = 5
	// MaxTownAccessPoints is how many placed access points TownWiFi tells at
	// most: those heard at the most points.
	MaxTownAccessPoints = 500
)

// TownWiFi is where the hub learned the access points around town are, from
// the phones' scans that have a GPS position, and the phones' ways placed by
// those access points alone.
type TownWiFi struct {
	// Learned is how many scans with a GPS position it learned from, the
	// oldest of them at LearnedFrom, in Unix seconds.
	Learned     int   `json:"learned"`
	LearnedFrom int64 `json:"learnedFrom,omitempty"`
	// Moving is how many access points were left out as heard too far
	// apart, Once how many were heard at one point only so far.
	Moving int `json:"moving"`
	Once   int `json:"once"`
	// AccessPoints are the placed ones, those heard at the most points first.
	AccessPoints []TownAccessPoint `json:"accessPoints"`
	// Tracks are the phones' ways in the range, by phone.
	Tracks []TownTrack `json:"tracks"`
}

// TownAccessPoint is an access point the hub placed.
type TownAccessPoint struct {
	ID string `json:"id"`
	// SSID is left out for a hidden network.
	SSID string `json:"ssid,omitempty"`
	// Lat and Lon are the middle of the points that heard it, closer to
	// those that heard it well; Meters is how far around that it was heard.
	Lat    float64 `json:"lat"`
	Lon    float64 `json:"lon"`
	Meters float64 `json:"meters"`
	// Points is how many points of the phones' routes heard it, Scans how
	// many scans.
	Points        int     `json:"points"`
	Scans         int     `json:"scans"`
	SignalPercent float64 `json:"signalPercent"`
	// First and Last are when it was heard first and last, in Unix seconds.
	First     int64 `json:"first"`
	Last      int64 `json:"last"`
	Connected bool  `json:"connected,omitempty"`
}

// TownTrack is one phone's way, placed by the access points it heard.
type TownTrack struct {
	Device string           `json:"device"`
	Points []TownTrackPoint `json:"points"`
}

// TownTrackPoint is where a scan places its phone.
type TownTrackPoint struct {
	// Time is when the scan was made, in Unix seconds.
	Time int64 `json:"time"`
	// Known is how many of the access points heard are placed: 0 leaves a
	// gap, without Lat, Lon and Meters. Lat and Lon are their middle, closer
	// to those heard well; Meters how sure that is.
	Known  int     `json:"known"`
	Lat    float64 `json:"lat,omitempty"`
	Lon    float64 `json:"lon,omitempty"`
	Meters float64 `json:"meters,omitempty"`
	// GPS is where the phone's route was, if it tells.
	GPS *TownGPS `json:"gps,omitempty"`
}

// TownGPS is where a phone's route was at a scan, and how far that is from
// where the access points place it.
type TownGPS struct {
	Lat       float64 `json:"lat"`
	Lon       float64 `json:"lon"`
	OffMeters float64 `json:"offMeters,omitempty"`
}

// townScan is a scan read for the town Wi-Fi.
type townScan struct {
	device   string
	time     int64
	networks []ScannedNetwork
}

// scanKey tells a phone's scan apart.
type scanKey struct {
	device string
	time   int64
}

// spot is what the scans with a GPS position found of one access point. The
// sums are of where they were, in meters east (x) and north (y) of the first
// point that heard it, each weighted by the signal there.
type spot struct {
	ssid                   string
	lat, lon, cos          float64
	sw, sx, sy, sxx, syy   float64
	minX, maxX, minY, maxY float64
	points                 int
	lastPoint              positionPoint
	scans                  int
	signal                 float64
	first, last            int64
	ssidAt                 int64 // the time of the scan ssid is from
	connected              bool
}

// weight is how much a scan hearing an access point at signal counts: the
// square of the signal, so those heard well, which are close, pull most.
func weight(signal float64) float64 {
	s := max(signal, townMinSignal) / 100
	return s * s
}

// offset is where p is, in meters east and north of the spot's first point.
func (s *spot) offset(p positionPoint) (x, y float64) {
	return (p.lon - s.lon) * metersPerDegree * s.cos, (p.lat - s.lat) * metersPerDegree
}

func (s *spot) add(p positionPoint, n ScannedNetwork, t int64) {
	if s.scans == 0 {
		s.lat, s.lon = p.lat, p.lon
		s.cos = math.Max(math.Cos(p.lat*math.Pi/180), 0.01)
		s.first = t
	}
	// The scans may come newest first, so neither the first nor the newest
	// name is simply the one of the first scan.
	s.first = min(s.first, t)
	x, y := s.offset(p)
	w := weight(n.SignalPercent)
	s.sw += w
	s.sx += w * x
	s.sy += w * y
	s.sxx += w * x * x
	s.syy += w * y * y
	if s.scans == 0 {
		s.minX, s.maxX, s.minY, s.maxY = x, x, y, y
	} else {
		s.minX, s.maxX = min(s.minX, x), max(s.maxX, x)
		s.minY, s.maxY = min(s.minY, y), max(s.maxY, y)
	}
	if s.points == 0 || p != s.lastPoint {
		s.points++
		s.lastPoint = p
	}
	s.scans++
	if n.SSID != "" && (s.ssid == "" || t >= s.ssidAt) {
		s.ssid, s.ssidAt = n.SSID, t
	}
	s.signal = max(s.signal, n.SignalPercent)
	s.last = max(s.last, t)
	s.connected = s.connected || n.Connected
}

// placed tells whether the spot places phones: heard at two points or more,
// none of them too far apart.
func (s *spot) placed() bool {
	return s.points >= 2 && math.Hypot(s.maxX-s.minX, s.maxY-s.minY) <= TownSpreadMeters
}

// at returns the spot's middle and how far around it it was heard, without
// a scan at p hearing it at signal when without is set: a scan is placed
// without what it taught, so it is compared to its GPS fairly. ok is false
// when nothing else heard it.
func (s *spot) at(without *positionPoint, signal float64) (lat, lon, meters float64, ok bool) {
	sw, sx, sy, sxx, syy := s.sw, s.sx, s.sy, s.sxx, s.syy
	if without != nil {
		x, y := s.offset(*without)
		w := weight(signal)
		sw -= w
		sx -= w * x
		sy -= w * y
		sxx -= w * x * x
		syy -= w * y * y
	}
	if sw < 1e-9 {
		return 0, 0, 0, false
	}
	mx, my := sx/sw, sy/sw
	spread := math.Sqrt(max(sxx/sw-mx*mx+syy/sw-my*my, 0))
	return s.lat + my/metersPerDegree, s.lon + mx/(metersPerDegree*s.cos), max(spread, townMinMeters), true
}

// TownWiFi learns where the access points around town are from the newest
// MaxPositionScans scans of all phones that a point of their route places
// (see placeAt), and places each scan from from up to (not including) to,
// the newest MaxPositionScans of them, by the placed access points it heard
// alone. A scan the hub learned from is placed without what it taught, so
// its GPS tells how far off the Wi-Fi alone is. Nothing leaves the hub.
func (s *Store) TownWiFi(ctx context.Context, from, to time.Time) (TownWiFi, error) {
	town := TownWiFi{AccessPoints: []TownAccessPoint{}, Tracks: []TownTrack{}}
	learn, err := s.townScans(ctx, `SELECT device, time, networks FROM phone_scans ORDER BY time DESC LIMIT ?`, MaxPositionScans)
	if err != nil {
		return town, err
	}
	learnPoints, err := s.scanPoints(ctx, learn)
	if err != nil {
		return town, err
	}
	spots := map[string]*spot{}
	for _, sc := range learn {
		p, ok := learnPoints[scanKey{sc.device, sc.time}]
		if !ok {
			continue
		}
		town.Learned++
		town.LearnedFrom = sc.time
		for _, n := range sc.networks {
			sp := spots[n.ID]
			if sp == nil {
				sp = &spot{}
				spots[n.ID] = sp
			}
			sp.add(p, n, sc.time)
		}
	}
	for id, sp := range spots {
		if !sp.placed() {
			if sp.points < 2 {
				town.Once++
			} else {
				town.Moving++
			}
			continue
		}
		lat, lon, meters, _ := sp.at(nil, 0)
		town.AccessPoints = append(town.AccessPoints, TownAccessPoint{
			ID: id, SSID: sp.ssid, Lat: round6(lat), Lon: round6(lon), Meters: math.Round(meters),
			Points: sp.points, Scans: sp.scans, SignalPercent: sp.signal,
			First: sp.first, Last: sp.last, Connected: sp.connected,
		})
	}
	slices.SortFunc(town.AccessPoints, func(a, b TownAccessPoint) int {
		return cmp.Or(cmp.Compare(b.Points, a.Points), cmp.Compare(b.SignalPercent, a.SignalPercent), cmp.Compare(a.ID, b.ID))
	})
	if len(town.AccessPoints) > MaxTownAccessPoints {
		town.AccessPoints = town.AccessPoints[:MaxTownAccessPoints]
	}

	scans, err := s.townScans(ctx, `
		SELECT device, time, networks FROM phone_scans
		WHERE time >= ? AND time < ? ORDER BY time DESC LIMIT ?`, from.Unix(), to.Unix(), MaxPositionScans)
	if err != nil {
		return town, err
	}
	gps, err := s.scanPoints(ctx, scans)
	if err != nil {
		return town, err
	}
	slices.Reverse(scans)
	tracks := map[string]int{}
	for _, sc := range scans {
		key := scanKey{sc.device, sc.time}
		var without *positionPoint
		if p, ok := learnPoints[key]; ok {
			without = &p
		}
		point := placeByWiFi(spots, sc, without)
		if p, ok := gps[key]; ok {
			point.GPS = &TownGPS{Lat: p.lat, Lon: p.lon}
			if point.Known > 0 {
				point.GPS.OffMeters = math.Round(distanceMeters(point.Lat, point.Lon, p.lat, p.lon))
			}
		}
		i, ok := tracks[sc.device]
		if !ok {
			i = len(town.Tracks)
			tracks[sc.device] = i
			town.Tracks = append(town.Tracks, TownTrack{Device: sc.device})
		}
		town.Tracks[i].Points = append(town.Tracks[i].Points, point)
	}
	return town, nil
}

// placeByWiFi places a scan by the placed access points it heard: at their
// middle, closer to those heard well, and as sure as they are far from it
// and as far around them as they were heard. without is where the scan was
// learned at, if it was.
func placeByWiFi(spots map[string]*spot, sc townScan, without *positionPoint) TownTrackPoint {
	point := TownTrackPoint{Time: sc.time}
	type known struct{ lat, lon, meters, w float64 }
	var heard []known
	var sw, lat, lon float64
	for _, n := range sc.networks {
		sp := spots[n.ID]
		if sp == nil || !sp.placed() {
			continue
		}
		la, lo, meters, ok := sp.at(without, n.SignalPercent)
		if !ok {
			continue
		}
		w := weight(n.SignalPercent)
		heard = append(heard, known{la, lo, meters, w})
		sw += w
		lat += w * la
		lon += w * lo
	}
	if len(heard) == 0 {
		return point
	}
	lat, lon = lat/sw, lon/sw
	var spread float64
	for _, k := range heard {
		d := distanceMeters(lat, lon, k.lat, k.lon)
		spread += k.w * (d*d + k.meters*k.meters)
	}
	point.Known = len(heard)
	point.Lat, point.Lon = round6(lat), round6(lon)
	point.Meters = math.Round(max(math.Sqrt(spread/sw), townMinMeters))
	return point
}

// townScans reads scans by query, the newest first, with only the networks
// that have an access point ID, each once.
func (s *Store) townScans(ctx context.Context, query string, args ...any) ([]townScan, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	var scans []townScan
	err = scanRows(rows, func() error {
		var sc townScan
		var data string
		if err := rows.Scan(&sc.device, &sc.time, &data); err != nil {
			return err
		}
		var networks []ScannedNetwork
		if err := json.Unmarshal([]byte(data), &networks); err != nil {
			return err
		}
		seen := map[string]bool{}
		for _, n := range networks {
			if n.ID != "" && !seen[n.ID] {
				seen[n.ID] = true
				sc.networks = append(sc.networks, n)
			}
		}
		scans = append(scans, sc)
		return nil
	})
	return scans, err
}

// scanPoints returns the point of its phone's route that places each scan,
// newest first, for those that one places (see placeAt).
func (s *Store) scanPoints(ctx context.Context, scans []townScan) (map[scanKey]positionPoint, error) {
	points := map[scanKey]positionPoint{}
	if len(scans) == 0 {
		return points, nil
	}
	var devices []string
	for _, sc := range scans {
		if !slices.Contains(devices, sc.device) {
			devices = append(devices, sc.device)
		}
	}
	routes, err := s.positionPoints(ctx, devices,
		time.Unix(scans[len(scans)-1].time, 0).Add(-positionBefore),
		time.Unix(scans[0].time, 0).Add(positionAfter+time.Second))
	if err != nil {
		return nil, err
	}
	for _, sc := range scans {
		if p, ok := placeAt(routes[sc.device], sc.time*1000); ok {
			points[scanKey{sc.device, sc.time}] = p
		}
	}
	return points, nil
}
