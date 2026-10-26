package history

import (
	"cmp"
	"context"
	"database/sql"
	"slices"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// wifiSchema keeps what the Wi-Fi of each device saw nearby, by hour:
// wifi_hours has a row for each access point a device saw in an hour, with
// how often and how strong, and wifi_scans how many readings of the device
// had its Wi-Fi in that hour, so an access point seen in some of them was in
// range for that part of the hour. Sums are kept rather than averages, so a
// flush adds to an hour stored already, as after a restart in the middle of
// it. What an access point is, its name, channel and security, is the last
// the device saw in the hour.
const wifiSchema = `
CREATE TABLE IF NOT EXISTS wifi_hours (
	device     TEXT    NOT NULL,
	time       INTEGER NOT NULL, -- Unix time in seconds, the start of the hour
	ap         TEXT    NOT NULL, -- metrics.NearbyAccessPoint.ID
	box        TEXT    NOT NULL,
	ssid       TEXT    NOT NULL,
	frequency  INTEGER NOT NULL, -- MHz, 0 when unknown
	width      INTEGER NOT NULL, -- MHz, 0 when unknown
	security   TEXT    NOT NULL,
	generation INTEGER NOT NULL,
	seen       INTEGER NOT NULL, -- readings the access point was in
	connected  INTEGER NOT NULL, -- of those, the ones the device was connected to it
	signal_sum REAL    NOT NULL, -- the sum of its signal in percent
	signal_min REAL    NOT NULL,
	signal_max REAL    NOT NULL,
	dbm_sum    REAL    NOT NULL, -- the sum of its signal in dBm, of dbm_count readings
	dbm_count  INTEGER NOT NULL,
	PRIMARY KEY (device, time, ap)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS wifi_hours_by_time ON wifi_hours (time);
CREATE TABLE IF NOT EXISTS wifi_scans (
	device   TEXT    NOT NULL,
	time     INTEGER NOT NULL, -- Unix time in seconds, the start of the hour
	readings INTEGER NOT NULL,
	PRIMARY KEY (device, time)
) WITHOUT ROWID;
`

// wifiFlushEvery is how often what the devices' Wi-Fi saw is written when
// the minutes are written at once: readings come every few seconds, which
// would write to the SD card of a Raspberry Pi as often.
const wifiFlushEvery = time.Minute

// wifiKey names what one device saw of one access point in one hour; ap is
// empty for the device's readings.
type wifiKey struct {
	device, ap string
	hour       int64
}

// wifiSum adds up the readings of one wifiKey that were not written yet.
type wifiSum struct {
	last                 metrics.NearbyAccessPoint
	seen, connected      int64
	signalSum            float64
	signalMin, signalMax float64
	dBmSum               float64
	dBmCount             int64
	readings             int64
}

// wifiPending holds what the devices' Wi-Fi saw that is not written yet.
type wifiPending struct {
	mu   sync.Mutex
	sums map[wifiKey]*wifiSum
}

// AddWiFi counts what a device's Wi-Fi saw nearby at one reading into the
// hour of at. It is written at the next Flush.
func (s *Store) AddWiFi(device string, at time.Time, nearby *metrics.NearbyWiFi) {
	if nearby == nil {
		return
	}
	hour := at.Truncate(time.Hour).Unix()
	p := &s.wifi
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.sums == nil {
		p.sums = map[wifiKey]*wifiSum{}
	}
	sum := func(ap string) *wifiSum {
		key := wifiKey{device: device, ap: ap, hour: hour}
		if p.sums[key] == nil {
			p.sums[key] = &wifiSum{}
		}
		return p.sums[key]
	}
	sum("").readings++
	for _, ap := range nearby.AccessPoints {
		s := sum(ap.ID)
		if s.seen == 0 {
			s.signalMin, s.signalMax = ap.SignalPercent, ap.SignalPercent
		}
		s.last = ap
		s.seen++
		if ap.Connected {
			s.connected++
		}
		s.signalSum += ap.SignalPercent
		s.signalMin = min(s.signalMin, ap.SignalPercent)
		s.signalMax = max(s.signalMax, ap.SignalPercent)
		if ap.SignalDBm != nil {
			s.dBmSum += *ap.SignalDBm
			s.dBmCount++
		}
	}
}

// forget drops what a device saw that is not written yet.
func (p *wifiPending) forget(device string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for key := range p.sums {
		if key.device == device {
			delete(p.sums, key)
		}
	}
}

// take returns what waits and starts over.
func (p *wifiPending) take() map[wifiKey]*wifiSum {
	p.mu.Lock()
	defer p.mu.Unlock()
	taken := p.sums
	p.sums = nil
	return taken
}

// putBack adds what a failed flush took back to what waits.
func (p *wifiPending) putBack(taken map[wifiKey]*wifiSum) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.sums == nil {
		p.sums = map[wifiKey]*wifiSum{}
	}
	for key, old := range taken {
		now := p.sums[key]
		if now == nil {
			p.sums[key] = old
			continue
		}
		// What came meanwhile is newer, so its access point stays.
		if old.seen > 0 {
			if now.seen == 0 {
				now.last, now.signalMin, now.signalMax = old.last, old.signalMin, old.signalMax
			}
			now.signalMin = min(now.signalMin, old.signalMin)
			now.signalMax = max(now.signalMax, old.signalMax)
		}
		now.seen += old.seen
		now.connected += old.connected
		now.signalSum += old.signalSum
		now.dBmSum += old.dBmSum
		now.dBmCount += old.dBmCount
		now.readings += old.readings
	}
}

// flushWiFi writes what the devices' Wi-Fi saw, adding it to what is stored
// of the same hours. A failed write keeps it for the next flush.
func (s *Store) flushWiFi(ctx context.Context) error {
	taken := s.wifi.take()
	if len(taken) == 0 {
		return nil
	}
	if err := s.writeWiFi(ctx, taken); err != nil {
		s.wifi.putBack(taken)
		return err
	}
	return nil
}

func (s *Store) writeWiFi(ctx context.Context, sums map[wifiKey]*wifiSum) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	scans, err := tx.PrepareContext(ctx, `
		INSERT INTO wifi_scans (device, time, readings) VALUES (?, ?, ?)
		ON CONFLICT (device, time) DO UPDATE SET readings = readings + excluded.readings`)
	if err != nil {
		return err
	}
	defer func() { _ = scans.Close() }()
	aps, err := tx.PrepareContext(ctx, `
		INSERT INTO wifi_hours (device, time, ap, box, ssid, frequency, width, security, generation,
			seen, connected, signal_sum, signal_min, signal_max, dbm_sum, dbm_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (device, time, ap) DO UPDATE SET
			box = excluded.box, ssid = excluded.ssid, frequency = excluded.frequency, width = excluded.width,
			security = excluded.security, generation = excluded.generation,
			seen = seen + excluded.seen, connected = connected + excluded.connected,
			signal_sum = signal_sum + excluded.signal_sum,
			signal_min = MIN(signal_min, excluded.signal_min), signal_max = MAX(signal_max, excluded.signal_max),
			dbm_sum = dbm_sum + excluded.dbm_sum, dbm_count = dbm_count + excluded.dbm_count`)
	if err != nil {
		return err
	}
	defer func() { _ = aps.Close() }()
	for key, sum := range sums {
		if key.ap == "" {
			if _, err := scans.ExecContext(ctx, key.device, key.hour, sum.readings); err != nil {
				return err
			}
			continue
		}
		ap := sum.last
		if _, err := aps.ExecContext(ctx, key.device, key.hour, key.ap, ap.Box, ap.SSID, ap.FrequencyMHz, ap.WidthMHz, ap.Security, ap.Generation,
			sum.seen, sum.connected, sum.signalSum, sum.signalMin, sum.signalMax, sum.dBmSum, sum.dBmCount); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// WiFiHistory is what the Wi-Fi of the devices saw nearby over a range,
// in steps of whole hours.
type WiFiHistory struct {
	StepSeconds int64 `json:"stepSeconds"`
	// Devices are the devices whose Wi-Fi was read in the range.
	Devices []WiFiDevice `json:"devices"`
	// AccessPoints are the access points any of them saw, by ID.
	AccessPoints []WiFiAccessPoint `json:"accessPoints"`
}

// WiFiDevice is how many readings of one device had its Wi-Fi, per step.
type WiFiDevice struct {
	Device string         `json:"device"`
	Steps  []WiFiReadings `json:"steps"`
}

// WiFiReadings is how many readings a device's Wi-Fi had in the step that
// starts at Time.
type WiFiReadings struct {
	Time     int64 `json:"time"`
	Readings int64 `json:"readings"`
}

// WiFiAccessPoint is one access point the devices saw, as it was last seen,
// and what each device saw of it.
type WiFiAccessPoint struct {
	ID           string `json:"id"`
	Box          string `json:"box"`
	SSID         string `json:"ssid,omitempty"`
	FrequencyMHz int    `json:"frequencyMHz,omitempty"`
	WidthMHz     int    `json:"widthMHz,omitempty"`
	Security     string `json:"security,omitempty"`
	Generation   int    `json:"generation,omitempty"`
	// FirstSeen and LastSeen are the starts of the first and last hour in
	// the range any device saw it in.
	FirstSeen int64          `json:"firstSeen"`
	LastSeen  int64          `json:"lastSeen"`
	SeenBy    []WiFiSighting `json:"seenBy"`
}

// WiFiSighting is what one device saw of an access point, per step it saw
// it in.
type WiFiSighting struct {
	Device string      `json:"device"`
	Points []WiFiPoint `json:"points"`
}

// WiFiPoint is what a device saw of an access point in the step that starts
// at Time: in how many of its readings, how many of those it was connected
// to it, and its signal over them.
type WiFiPoint struct {
	Time          int64    `json:"time"`
	Seen          int64    `json:"seen"`
	Connected     int64    `json:"connected,omitempty"`
	SignalPercent float64  `json:"signalPercent"`
	MinPercent    float64  `json:"minPercent"`
	MaxPercent    float64  `json:"maxPercent"`
	SignalDBm     *float64 `json:"signalDBm,omitempty"`
	// FrequencyMHz is the frequency it sent on in the step, the highest
	// where it changed within it, so a router that moves to another
	// channel shows when.
	FrequencyMHz int `json:"frequencyMHz,omitempty"`
}

// WiFi returns what the devices' Wi-Fi saw from from up to (not including)
// to, in steps of step, rounded up to whole hours. The hours from and to fall
// in are included. Devices and access points are sorted by ID, points by
// time.
func (s *Store) WiFi(ctx context.Context, from, to time.Time, step time.Duration) (WiFiHistory, error) {
	stepSeconds := max(1, int64((step+time.Hour-1)/time.Hour)) * int64(time.Hour/time.Second)
	first, last := from.Truncate(time.Hour).Unix(), to.Unix()
	result := WiFiHistory{StepSeconds: stepSeconds, Devices: []WiFiDevice{}, AccessPoints: []WiFiAccessPoint{}}

	rows, err := s.db.QueryContext(ctx, `
		SELECT device, time / ?1 * ?1 AS step, SUM(readings) FROM wifi_scans
		WHERE time >= ?2 AND time < ?3 GROUP BY device, step ORDER BY device, step`, stepSeconds, first, last)
	if err != nil {
		return WiFiHistory{}, err
	}
	err = scanRows(rows, func() error {
		var device string
		var r WiFiReadings
		if err := rows.Scan(&device, &r.Time, &r.Readings); err != nil {
			return err
		}
		if n := len(result.Devices); n == 0 || result.Devices[n-1].Device != device {
			result.Devices = append(result.Devices, WiFiDevice{Device: device})
		}
		d := &result.Devices[len(result.Devices)-1]
		d.Steps = append(d.Steps, r)
		return nil
	})
	if err != nil {
		return WiFiHistory{}, err
	}

	// SQLite takes the other columns from the row with the largest time.
	rows, err = s.db.QueryContext(ctx, `
		SELECT ap, MAX(time), MIN(time), box, ssid, frequency, width, security, generation FROM wifi_hours
		WHERE time >= ? AND time < ? GROUP BY ap ORDER BY ap`, first, last)
	if err != nil {
		return WiFiHistory{}, err
	}
	index := map[string]int{}
	err = scanRows(rows, func() error {
		var ap WiFiAccessPoint
		if err := rows.Scan(&ap.ID, &ap.LastSeen, &ap.FirstSeen, &ap.Box, &ap.SSID, &ap.FrequencyMHz, &ap.WidthMHz, &ap.Security, &ap.Generation); err != nil {
			return err
		}
		index[ap.ID] = len(result.AccessPoints)
		result.AccessPoints = append(result.AccessPoints, ap)
		return nil
	})
	if err != nil {
		return WiFiHistory{}, err
	}

	rows, err = s.db.QueryContext(ctx, `
		SELECT ap, device, time / ?1 * ?1 AS step, SUM(seen), SUM(connected), SUM(signal_sum),
			MIN(signal_min), MAX(signal_max), SUM(dbm_sum), SUM(dbm_count), MAX(frequency) FROM wifi_hours
		WHERE time >= ?2 AND time < ?3 GROUP BY ap, device, step ORDER BY ap, device, step`, stepSeconds, first, last)
	if err != nil {
		return WiFiHistory{}, err
	}
	err = scanRows(rows, func() error {
		var id, device string
		var p WiFiPoint
		var signalSum, dBmSum float64
		var dBmCount int64
		if err := rows.Scan(&id, &device, &p.Time, &p.Seen, &p.Connected, &signalSum, &p.MinPercent, &p.MaxPercent, &dBmSum, &dBmCount, &p.FrequencyMHz); err != nil {
			return err
		}
		i, ok := index[id]
		if !ok || p.Seen == 0 {
			return nil
		}
		p.SignalPercent = signalSum / float64(p.Seen)
		if dBmCount > 0 {
			p.SignalDBm = new(dBmSum / float64(dBmCount))
		}
		ap := &result.AccessPoints[i]
		if n := len(ap.SeenBy); n == 0 || ap.SeenBy[n-1].Device != device {
			ap.SeenBy = append(ap.SeenBy, WiFiSighting{Device: device})
		}
		sighting := &ap.SeenBy[len(ap.SeenBy)-1]
		sighting.Points = append(sighting.Points, p)
		return nil
	})
	if err != nil {
		return WiFiHistory{}, err
	}
	result.AccessPoints = slices.DeleteFunc(result.AccessPoints, func(ap WiFiAccessPoint) bool { return len(ap.SeenBy) == 0 })
	slices.SortFunc(result.AccessPoints, func(a, b WiFiAccessPoint) int { return cmp.Compare(a.ID, b.ID) })
	return result, nil
}

// scanRows calls scan for each of rows and closes them.
func scanRows(rows *sql.Rows, scan func() error) error {
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		if err := scan(); err != nil {
			return err
		}
	}
	return rows.Err()
}
