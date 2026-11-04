package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
)

// fakeWiFiConnections returns the same connections and keeps what it was
// asked for.
type fakeWiFiConnections struct {
	device   string
	from, to time.Time
}

func (f *fakeWiFiConnections) WiFiConnections(_ context.Context, device string, from, to time.Time) ([]history.PhoneConnection, error) {
	f.device, f.from, f.to = device, from, to
	return []history.PhoneConnection{{SSID: "Home", Start: 100, End: 200}}, nil
}

func TestServesAPhonesWiFiConnectionsWithinTheRetention(t *testing.T) {
	source := &fakeWiFiConnections{}
	devices := append(device(fakeCollector{}, nil), Device{ID: "pixel", Kind: hub.KindPhone, Metrics: fakeCollector{}})
	handler := New(Site{Devices: DeviceList(devices), Files: site, WiFiConnections: source, Retention: 7 * 24 * time.Hour})
	now := time.Now()
	rec := get(handler, "/api/phone/wifi?device=pixel&from=0&to="+strconv.FormatInt(now.Unix(), 10), "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got wifiConnectionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if source.device != "pixel" || len(got.Connections) != 1 || got.Connections[0] != (history.PhoneConnection{SSID: "Home", Start: 100, End: 200}) {
		t.Errorf("device %q, body = %+v", source.device, got)
	}
	if want := now.Add(-7 * 24 * time.Hour).Unix(); got.From < want-5 || source.from.Unix() != got.From {
		t.Errorf("from = %d, want it moved to the start of the retention, %d", got.From, want)
	}

	if rec := get(handler, "/api/phone/wifi?device=local&from=0&to=10", "192.168.1.20:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("status for a device that is no phone = %d, want 404", rec.Code)
	}
	if rec := get(handler, "/api/phone/wifi?device=pixel&from=5&to=1", "192.168.1.20:5000"); rec.Code != http.StatusBadRequest {
		t.Errorf("status of a range that ends before it starts = %d, want 400", rec.Code)
	}
}
