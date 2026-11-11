package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
)

// fakeRoute returns the same points and keeps what it was asked for.
type fakeRoute struct {
	device   string
	from, to time.Time
}

func (f *fakeRoute) RoutePoints(_ context.Context, device string, from, to time.Time) ([]history.PhonePoint, error) {
	f.device, f.from, f.to = device, from, to
	return []history.PhonePoint{{Time: 100, Lat: 53.55, Lon: 9.99, Accuracy: 12}}, nil
}

func TestServesAPhonesRouteWithinTheRetention(t *testing.T) {
	source := &fakeRoute{}
	devices := append(device(fakeCollector{}, nil), Device{ID: "pixel", Kind: hub.KindPhone, Metrics: fakeCollector{}})
	handler := New(Site{Devices: DeviceList(devices), Files: site, Route: source, Retention: 7 * 24 * time.Hour})
	now := time.Now()
	rec := get(handler, "/api/phone/route?device=pixel&from=0&to="+strconv.FormatInt(now.Unix(), 10), "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got routeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if source.device != "pixel" || len(got.Points) != 1 || got.Points[0] != (history.PhonePoint{Time: 100, Lat: 53.55, Lon: 9.99, Accuracy: 12}) {
		t.Errorf("device %q, body = %+v", source.device, got)
	}
	if want := now.Add(-7 * 24 * time.Hour).Unix(); got.From < want-5 || source.from.Unix() != got.From {
		t.Errorf("from = %d, want it moved to the start of the retention, %d", got.From, want)
	}

	if rec := get(handler, "/api/phone/route?device=local&from=0&to=10", "192.168.1.20:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("status for a device that is no phone = %d, want 404", rec.Code)
	}
	if rec := get(handler, "/api/phone/route?device=pixel&from=5&to=1", "192.168.1.20:5000"); rec.Code != http.StatusBadRequest {
		t.Errorf("status of a range that ends before it starts = %d, want 400", rec.Code)
	}
}

// fakePhoneScans has one scan at 100 and keeps what it was asked for.
type fakePhoneScans struct {
	device string
	at     time.Time
}

func (f *fakePhoneScans) PhoneScanNear(_ context.Context, device string, at time.Time, within time.Duration) (*history.PhoneScan, error) {
	f.device, f.at = device, at
	if at.Unix() < 100-int64(within/time.Second) || at.Unix() > 100+int64(within/time.Second) {
		return nil, nil
	}
	return &history.PhoneScan{Time: 100, Networks: []history.ScannedNetwork{{SSID: "Den", SignalPercent: 80}}}, nil
}

func TestServesThePhonesScanNearAPoint(t *testing.T) {
	source := &fakePhoneScans{}
	devices := append(device(fakeCollector{}, nil), Device{ID: "pixel", Kind: hub.KindPhone, Metrics: fakeCollector{}})
	handler := New(Site{Devices: DeviceList(devices), Files: site, PhoneScans: source})
	rec := get(handler, "/api/phone/scan?device=pixel&time=160", "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got phoneScanResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if source.device != "pixel" || got.Time != 160 || got.Scan == nil || got.Scan.Time != 100 || got.Scan.Networks[0].SSID != "Den" {
		t.Errorf("device %q, body = %s", source.device, rec.Body)
	}
	rec = get(handler, "/api/phone/scan?device=pixel&time=100000", "192.168.1.20:5000")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"scan":null`) {
		t.Errorf("far from any scan: status %d, body %s; want scan null", rec.Code, rec.Body)
	}
	if rec := get(handler, "/api/phone/scan?device=local&time=100", "192.168.1.20:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("status for a device that is no phone = %d, want 404", rec.Code)
	}
	if rec := get(handler, "/api/phone/scan?device=pixel&time=soon", "192.168.1.20:5000"); rec.Code != http.StatusBadRequest {
		t.Errorf("status of a time that is no number = %d, want 400", rec.Code)
	}
}
