package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
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
	handler := New(Site{Devices: DeviceList(devices), Files: site, Route: source, Retention: time.Hour, PhoneRetention: 7 * 24 * time.Hour})
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
		t.Errorf("from = %d, want it moved to the start of the phones' retention, %d", got.From, want)
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

// fakePositions has one place and keeps what it was asked for.
type fakePositions struct {
	from, to time.Time
	// changes are the changes to places asked for, err what they return.
	changes []string
	err     error
}

func (f *fakePositions) WiFiPositions(_ context.Context, from, to time.Time) ([]history.WiFiPosition, error) {
	f.from, f.to = from, to
	return []history.WiFiPosition{{Lat: 53.57, Lon: 9.95, Scans: 2, Devices: []string{"pixel"}, Networks: []history.PositionNetwork{
		{SSID: "Den", SignalPercent: 80, Devices: []history.PositionSighting{{Device: "pixel", SignalPercent: 80, Scans: 2}}},
	}}}, nil
}

func TestServesTheWiFiNetworksOfAllPhonesByPlace(t *testing.T) {
	source := &fakePositions{}
	handler := New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site, Positions: source, PhoneRetention: 30 * 24 * time.Hour})
	now := time.Now()
	rec := get(handler, "/api/wifi/positions?from=0&to="+strconv.FormatInt(now.Unix()+3600, 10), "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got positionsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Places) != 1 || got.Places[0].Networks[0].Devices[0].Device != "pixel" {
		t.Errorf("body = %s", rec.Body)
	}
	if want := now.Add(-30 * 24 * time.Hour).Unix(); got.From < want-5 || source.from.Unix() != got.From {
		t.Errorf("from = %d, want it moved to the start of the retention, %d", got.From, want)
	}
	if got.To > now.Unix()+5 || source.to.Unix() != got.To {
		t.Errorf("to = %d, want it to end now", got.To)
	}
	if rec := get(handler, "/api/wifi/positions?from=5&to=1", "192.168.1.20:5000"); rec.Code != http.StatusBadRequest {
		t.Errorf("status of a range that ends before it starts = %d, want 400", rec.Code)
	}
	if rec := get(New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site}), "/api/wifi/positions?from=0&to=1", "192.168.1.20:5000"); rec.Code == http.StatusOK && strings.HasPrefix(rec.Body.String(), "{") {
		t.Errorf("served without a source: %s", rec.Body)
	}
}

func (f *fakePositions) RenamePositionPlace(_ context.Context, id int64, name string) error {
	f.changes = append(f.changes, fmt.Sprintf("rename %d %q", id, name))
	return f.err
}

func (f *fakePositions) MergePositionPlace(_ context.Context, id, into int64) error {
	f.changes = append(f.changes, fmt.Sprintf("merge %d into %d", id, into))
	return f.err
}

func (f *fakePositions) SplitPositionPlace(_ context.Context, id int64) error {
	f.changes = append(f.changes, fmt.Sprintf("split %d", id))
	return f.err
}

func (f *fakePositions) KeepPositionPlacesApart(_ context.Context, a, b int64) error {
	f.changes = append(f.changes, fmt.Sprintf("apart %d %d", a, b))
	return f.err
}

func TestChangesThePlacesOfThePhonesScans(t *testing.T) {
	source := &fakePositions{}
	handler := New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site, Positions: source})
	for _, c := range []struct{ method, path, body string }{
		{http.MethodPut, "/api/wifi/positions/3/name", `{"name":"Home"}`},
		{http.MethodPut, "/api/wifi/positions/5/merged-into", `{"into":3}`},
		{http.MethodPut, "/api/wifi/positions/5/merged-into", `{"into":null}`},
		{http.MethodPost, "/api/wifi/positions/5/apart", `{"other":3}`},
	} {
		if rec := send(handler, c.method, c.path, c.body); rec.Code != http.StatusNoContent {
			t.Errorf("%s %s = %d %s, want 204", c.method, c.path, rec.Code, rec.Body)
		}
	}
	want := []string{`rename 3 "Home"`, "merge 5 into 3", "split 5", "apart 5 3"}
	if !slices.Equal(source.changes, want) {
		t.Errorf("changes = %q, want %q", source.changes, want)
	}

	if rec := send(handler, http.MethodPut, "/api/wifi/positions/home/name", `{"name":"Home"}`); rec.Code != http.StatusNotFound {
		t.Errorf("status of a place that is no number = %d, want 404", rec.Code)
	}
	if rec := send(handler, http.MethodPut, "/api/wifi/positions/3/name", `{"title":"Home"}`); rec.Code != http.StatusBadRequest {
		t.Errorf("status of an unknown field = %d, want 400", rec.Code)
	}
	for err, status := range map[error]int{
		history.ErrNoPositionPlace:                    http.StatusNotFound,
		&history.PlaceInputError{Message: "too long"}: http.StatusBadRequest,
		errors.New("disk full"):                       http.StatusInternalServerError,
	} {
		source.err = err
		if rec := send(handler, http.MethodPut, "/api/wifi/positions/3/name", `{"name":"Home"}`); rec.Code != status {
			t.Errorf("status for %v = %d, want %d", err, rec.Code, status)
		}
	}
}

func TestServesAPhonesWholeRouteWithoutARetentionOfItsOwn(t *testing.T) {
	source := &fakeRoute{}
	devices := append(device(fakeCollector{}, nil), Device{ID: "pixel", Kind: hub.KindPhone, Metrics: fakeCollector{}})
	handler := New(Site{Devices: DeviceList(devices), Files: site, Route: source, Retention: time.Hour})

	rec := get(handler, "/api/phone/route?device=pixel&from=1000&to=2000", "192.168.1.20:5000")

	if rec.Code != http.StatusOK || source.from.Unix() != 1000 || source.to.Unix() != 2000 {
		t.Errorf("status %d, read %v to %v; want the range asked for, kept for good", rec.Code, source.from, source.to)
	}
}

// fakeRouteDeleter keeps what it was asked to delete.
type fakeRouteDeleter struct {
	device   string
	from, to time.Time
}

func (f *fakeRouteDeleter) DeleteRoute(_ context.Context, device string, from, to time.Time) (int64, error) {
	f.device, f.from, f.to = device, from, to
	return 3, nil
}

func TestDeletesAStretchOfAPhonesRouteWithThePassword(t *testing.T) {
	routes := &fakeRouteDeleter{}
	devices := append(device(fakeCollector{}, nil), Device{ID: "pixel", Kind: hub.KindPhone, Metrics: fakeCollector{}})
	handler := New(Site{Devices: DeviceList(devices), Hub: &fakeHub{}, Password: &fakePassword{password: "correct horse"}, Files: site, Routes: routes})

	wrong := send(handler, http.MethodDelete, "/api/phones/pixel/route", `{"password":"wrong","from":86400,"to":172800}`)
	if wrong.Code != http.StatusForbidden || routes.device != "" {
		t.Fatalf("with a wrong password: status %d, deleted %q; want 403 and nothing deleted", wrong.Code, routes.device)
	}
	if rec := send(handler, http.MethodDelete, "/api/phones/local/route", `{"password":"correct horse","from":86400,"to":172800}`); rec.Code != http.StatusNotFound {
		t.Errorf("status for a device that is no phone = %d, want 404", rec.Code)
	}
	if rec := send(handler, http.MethodDelete, "/api/phones/pixel/route", `{"password":"correct horse","from":5,"to":5}`); rec.Code != http.StatusBadRequest {
		t.Errorf("status of an empty stretch = %d, want 400", rec.Code)
	}

	rec := send(handler, http.MethodDelete, "/api/phones/pixel/route", `{"password":"correct horse","from":86400,"to":172800}`)

	if rec.Code != http.StatusNoContent || routes.device != "pixel" || routes.from.Unix() != 86400 || routes.to.Unix() != 172800 {
		t.Errorf("status %d, deleted %q from %v to %v; want the day of pixel deleted", rec.Code, routes.device, routes.from, routes.to)
	}
}
