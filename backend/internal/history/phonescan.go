package history

import (
	"cmp"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"slices"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// phoneScanSchema keeps each scan of the Wi-Fi networks nearby a phone on
// its own, one row per scan with the networks as JSON, so the page can tell
// which ones the phone saw at a point of its route. wifi_hours has them only
// by hour, in which a phone on its way passes many places.
const phoneScanSchema = `
CREATE TABLE IF NOT EXISTS phone_scans (
	device   TEXT    NOT NULL,
	time     INTEGER NOT NULL, -- Unix time in seconds on the hub's clock
	networks TEXT    NOT NULL, -- JSON array of ScannedNetwork
	PRIMARY KEY (device, time)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS phone_scans_by_time ON phone_scans (time);
`

// ScannedNetwork is one network a phone's scan found, with only what the
// page shows of it, to keep the rows small.
type ScannedNetwork struct {
	// SSID is left out for a hidden network.
	SSID          string   `json:"ssid,omitempty"`
	SignalPercent float64  `json:"signalPercent"`
	SignalDBm     *float64 `json:"signalDBm,omitempty"`
	FrequencyMHz  int      `json:"frequencyMHz,omitempty"`
	Security      string   `json:"security,omitempty"`
	Generation    int      `json:"generation,omitempty"`
	Connected     bool     `json:"connected,omitempty"`
}

// PhoneScan is one scan of a phone: Time in Unix seconds on the hub's clock
// and the networks it found, the strongest first.
type PhoneScan struct {
	Time     int64            `json:"time"`
	Networks []ScannedNetwork `json:"networks"`
}

// FoundScan is one scan of a phone to store: when it was made, on the hub's
// clock, and the networks it found, as metrics.CleanNearbyWiFi left them.
type FoundScan struct {
	At    time.Time
	Found []metrics.NearbyAccessPoint
}

// AddPhoneScans stores the scans of the phone stored as device, all in one
// transaction, so either all of them are stored or none is. A scan stored
// already at the same second is kept as it is.
func (s *Store) AddPhoneScans(ctx context.Context, device string, scans []FoundScan) error {
	if len(scans) == 0 {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	insert, err := tx.PrepareContext(ctx, `
		INSERT INTO phone_scans (device, time, networks) VALUES (?, ?, ?)
		ON CONFLICT (device, time) DO NOTHING`)
	if err != nil {
		return err
	}
	defer func() { _ = insert.Close() }()
	for _, scan := range scans {
		data, err := json.Marshal(scannedNetworks(scan.Found))
		if err != nil {
			return err
		}
		if _, err := insert.ExecContext(ctx, device, scan.At.Unix(), string(data)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// scannedNetworks are the networks a scan found, the strongest first.
func scannedNetworks(found []metrics.NearbyAccessPoint) []ScannedNetwork {
	networks := make([]ScannedNetwork, 0, len(found))
	for _, ap := range found {
		networks = append(networks, ScannedNetwork{
			SSID:          ap.SSID,
			SignalPercent: ap.SignalPercent,
			SignalDBm:     ap.SignalDBm,
			FrequencyMHz:  ap.FrequencyMHz,
			Security:      ap.Security,
			Generation:    ap.Generation,
			Connected:     ap.Connected,
		})
	}
	slices.SortStableFunc(networks, func(a, b ScannedNetwork) int { return cmp.Compare(b.SignalPercent, a.SignalPercent) })
	return networks
}

// PhoneScanNear returns the scan of the phone stored as device closest to
// at, within within before or after it, or nil when it has none there.
func (s *Store) PhoneScanNear(ctx context.Context, device string, at time.Time, within time.Duration) (*PhoneScan, error) {
	t := at.Unix()
	w := int64(within / time.Second)
	var scan PhoneScan
	var data string
	err := s.db.QueryRowContext(ctx, `
		SELECT time, networks FROM phone_scans
		WHERE device = ? AND time >= ? AND time <= ?
		ORDER BY abs(time - ?), time LIMIT 1`, device, t-w, t+w, t).Scan(&scan.Time, &data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(data), &scan.Networks); err != nil {
		return nil, err
	}
	return &scan, nil
}
