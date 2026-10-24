package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/update"
)

// DeviceList is a fixed list of devices, as the tests need it.
type DeviceList []Device

func (l DeviceList) List() []Device {
	return l
}

type fakeCollector struct {
	snapshot metrics.Snapshot
	err      error
}

func (f fakeCollector) Collect(context.Context) (metrics.Snapshot, error) {
	return f.snapshot, f.err
}

// newHandler returns the site for a fixed list of devices, without adding
// and removing them.
func newHandler(devices []Device, retention time.Duration, files fs.FS) http.Handler {
	return New(Site{Devices: DeviceList(devices), Retention: retention, Files: files})
}

// device returns the machine the site runs on, as the only device.
func device(collector metrics.Source, reader HistoryReader) []Device {
	return []Device{{ID: "local", Metrics: collector, History: reader}}
}

var site = fstest.MapFS{
	"index.html":           {Data: []byte("page")},
	"main.js":              {Data: []byte("script")},
	"main-7EIQR62F.js":     {Data: []byte("hashed script")},
	"flags/de.svg":         {Data: []byte("flag")},
	"manifest.webmanifest": {Data: []byte(`{"name":"Den-Watcher"}`)},
}

func get(handler http.Handler, path, remoteAddr string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = remoteAddr
	req.Host = "192.168.1.9:9393"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestMetricsReturnsSnapshotAsJSON(t *testing.T) {
	want := metrics.Snapshot{CPU: metrics.CPU{UsagePercent: 12.5, Cores: 4}}
	handler := newHandler(device(fakeCollector{snapshot: want}, nil), 0, site)

	rec := get(handler, "/api/metrics", "192.168.1.20:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var got metrics.Snapshot
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !reflect.DeepEqual(got.CPU, want.CPU) {
		t.Errorf("CPU = %+v, want %+v", got.CPU, want.CPU)
	}
}

func TestMetricsReportsCollectorError(t *testing.T) {
	handler := newHandler(device(fakeCollector{err: errors.New("no /proc")}, nil), 0, site)

	rec := get(handler, "/api/metrics", "127.0.0.1:5000")

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestMetricsIgnoresARequestThatWasGivenUp(t *testing.T) {
	var logged bytes.Buffer
	defer slog.SetDefault(slog.Default())
	slog.SetDefault(slog.New(slog.NewTextHandler(&logged, nil)))
	handler := newHandler(device(fakeCollector{err: fmt.Errorf("wait for the reading: %w", context.Canceled)}, nil), 0, site)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/api/metrics", nil)
	req.RemoteAddr = "127.0.0.1:5000"
	req.Host = "192.168.1.9:9393"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code == http.StatusInternalServerError || logged.Len() != 0 {
		t.Errorf("status = %d, log %q; want no error for a request that was given up", rec.Code, logged.String())
	}
}

func TestDataOnlyServesOnlyTheMetrics(t *testing.T) {
	want := metrics.Snapshot{CPU: metrics.CPU{UsagePercent: 12.5, Cores: 4}}
	handler := NewDataOnly(fakeCollector{snapshot: want}, nil, nil, nil)

	rec := get(handler, "/api/metrics", "192.168.1.20:5000")
	var got metrics.Snapshot
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("GET /api/metrics = %d, %v, want 200 with the snapshot", rec.Code, err)
	}
	if !reflect.DeepEqual(got.CPU, want.CPU) {
		t.Errorf("CPU = %+v, want %+v", got.CPU, want.CPU)
	}
	for _, path := range []string{"/", "/api/devices", "/api/history?range=1h", "/api/update"} {
		if rec := get(handler, path, "192.168.1.20:5000"); rec.Code != http.StatusNotFound {
			t.Errorf("GET %s = %d, want %d", path, rec.Code, http.StatusNotFound)
		}
	}
	if rec := get(handler, "/api/metrics", "8.8.8.8:5000"); rec.Code != http.StatusForbidden {
		t.Errorf("GET /api/metrics from outside = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestListsDevices(t *testing.T) {
	since := time.Date(2026, 10, 11, 18, 0, 0, 0, time.UTC)
	full := 97.0
	devices := []Device{
		{ID: "local"},
		{ID: "living-room-pi", Name: "Living room Pi", Alerts: []alerts.Alert{
			{ID: 3, Device: "living-room-pi", DeviceName: "Living room Pi", Kind: alerts.KindDisk, Subject: "/", Level: alerts.Critical, Value: &full, Started: since},
		}},
		{ID: "vm", Name: "VM", Unreachable: true, Refused: true},
	}
	handler := newHandler(devices, 0, site)

	rec := get(handler, "/api/devices", "192.168.1.20:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var got devicesResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !reflect.DeepEqual(got.Devices, devices) || got.PasswordSet {
		t.Errorf("response = %+v, want devices %+v and no password", got, devices)
	}
}

// fakeAlertLog is a log of alerts, or fails while err is set.
type fakeAlertLog struct {
	list []alerts.Alert
	err  error
}

func (f fakeAlertLog) Log(context.Context) ([]alerts.Alert, error) {
	return f.list, f.err
}

func (f fakeAlertLog) Between(_ context.Context, device string, _, _ time.Time) ([]alerts.Alert, error) {
	var list []alerts.Alert
	for _, a := range f.list {
		if a.Device == device {
			list = append(list, a)
		}
	}
	return list, f.err
}

func TestServesTheAlertLog(t *testing.T) {
	ended := time.Date(2026, 10, 11, 18, 5, 0, 0, time.UTC)
	logged := []alerts.Alert{{ID: 1, Device: "local", Kind: alerts.KindOffline, Level: alerts.Critical, Started: ended.Add(-time.Hour), Ended: &ended}}
	withLog := Site{Devices: DeviceList([]Device{{ID: "local"}}), Files: site, Alerts: fakeAlertLog{list: logged}}
	rec := get(New(withLog), "/api/alerts", "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var got []alerts.Alert
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, logged) {
		t.Errorf("got %+v, want %+v", got, logged)
	}

	withLog.Alerts = fakeAlertLog{err: errors.New("broken")}
	if rec := get(New(withLog), "/api/alerts", "192.168.1.20:5000"); rec.Code != http.StatusInternalServerError {
		t.Errorf("with a broken log: status = %d", rec.Code)
	}
	if rec := get(newHandler([]Device{{ID: "local"}}, 0, site), "/api/alerts", "192.168.1.20:5000"); rec.Code == http.StatusOK && strings.HasPrefix(rec.Body.String(), "[") {
		t.Error("served alerts without a log")
	}
}

func TestMetricsOfEveryDeviceThatAnswers(t *testing.T) {
	handler := newHandler([]Device{
		{ID: "local", Metrics: fakeCollector{snapshot: metrics.Snapshot{UptimeSeconds: 1}}},
		{ID: "pi", Metrics: fakeCollector{snapshot: metrics.Snapshot{UptimeSeconds: 2}}},
		{ID: "nas", Unreachable: true, Metrics: fakeCollector{snapshot: metrics.Snapshot{UptimeSeconds: 3}}},
		{ID: "broken", Metrics: fakeCollector{err: errors.New("no /proc")}},
	}, 0, site)

	rec := get(handler, "/api/devices/metrics", "192.168.1.20:5000")

	var got map[string]metrics.Snapshot
	if err := json.NewDecoder(rec.Body).Decode(&got); rec.Code != http.StatusOK || err != nil {
		t.Fatalf("GET /api/devices/metrics = %d, %v", rec.Code, err)
	}
	if len(got) != 2 || got["local"].UptimeSeconds != 1 || got["pi"].UptimeSeconds != 2 {
		t.Errorf("got %+v, want local and pi", got)
	}
}

// stuckCollector answers only once the request is given up, as a disk that
// does not answer.
type stuckCollector struct{}

func (stuckCollector) Collect(ctx context.Context) (metrics.Snapshot, error) {
	<-ctx.Done()
	return metrics.Snapshot{}, ctx.Err()
}

func TestMetricsOfEveryDeviceDoNotWaitForOneThatHangs(t *testing.T) {
	defer func(timeout time.Duration) { fleetTimeout = timeout }(fleetTimeout)
	fleetTimeout = 50 * time.Millisecond
	handler := newHandler([]Device{
		{ID: "local", Metrics: stuckCollector{}},
		{ID: "pi", Metrics: fakeCollector{snapshot: metrics.Snapshot{UptimeSeconds: 2}}},
	}, 0, site)

	start := time.Now()
	rec := get(handler, "/api/devices/metrics", "192.168.1.20:5000")

	var got map[string]metrics.Snapshot
	if err := json.NewDecoder(rec.Body).Decode(&got); rec.Code != http.StatusOK || err != nil {
		t.Fatalf("GET /api/devices/metrics = %d, %v", rec.Code, err)
	}
	if len(got) != 1 || got["pi"].UptimeSeconds != 2 || time.Since(start) > 2*fleetTimeout {
		t.Errorf("got %+v after %v, want only pi", got, time.Since(start))
	}
}

func TestMetricsOfTheRequestedDevice(t *testing.T) {
	handler := newHandler([]Device{
		{ID: "local", Metrics: fakeCollector{snapshot: metrics.Snapshot{CPU: metrics.CPU{Cores: 4}}}},
		{ID: "pi", Metrics: fakeCollector{snapshot: metrics.Snapshot{CPU: metrics.CPU{Cores: 2}}}},
		{ID: "pc", Metrics: fakeCollector{err: fmt.Errorf("ask pc: %w", hub.ErrUnreachable)}},
	}, 0, site)
	tests := []struct {
		path       string
		wantStatus int
		wantCores  int
	}{
		{"/api/metrics", http.StatusOK, 4},
		{"/api/metrics?device=local", http.StatusOK, 4},
		{"/api/metrics?device=pi", http.StatusOK, 2},
		{"/api/metrics?device=pc", http.StatusServiceUnavailable, 0},
		{"/api/metrics?device=nas", http.StatusNotFound, 0},
		{"/api/history?device=nas&from=1&to=2", http.StatusNotFound, 0},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			rec := get(handler, tt.path, "192.168.1.20:5000")
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantStatus != http.StatusOK {
				return
			}
			var got metrics.Snapshot
			if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if got.CPU.Cores != tt.wantCores {
				t.Errorf("cores = %d, want %d", got.CPU.Cores, tt.wantCores)
			}
		})
	}
}

func TestServesWebsite(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, nil), 0, site)

	tests := []struct {
		path, wantBody, wantCache string
	}{
		{"/", "page", "no-cache"},
		{"/main-7EIQR62F.js", "hashed script", "public, max-age=31536000, immutable"},
		{"/main.js", "script", "public, max-age=3600"},
		{"/flags/de.svg", "flag", "public, max-age=3600"},
	}
	for _, tt := range tests {
		rec := get(handler, tt.path, "10.0.0.5:5000")

		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, want %d", tt.path, rec.Code, http.StatusOK)
		}
		if got := rec.Body.String(); got != tt.wantBody {
			t.Errorf("%s: body = %q, want %q", tt.path, got, tt.wantBody)
		}
		if got := rec.Header().Get("Cache-Control"); got != tt.wantCache {
			t.Errorf("%s: Cache-Control = %q, want %q", tt.path, got, tt.wantCache)
		}
		if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Errorf("%s: X-Content-Type-Options = %q, want nosniff", tt.path, got)
		}
		if got := rec.Header().Get("Content-Security-Policy"); got != "frame-ancestors 'none'" {
			t.Errorf("%s: Content-Security-Policy = %q, want frame-ancestors 'none'", tt.path, got)
		}
		if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
			t.Errorf("%s: X-Frame-Options = %q, want DENY", tt.path, got)
		}
	}
}

func TestServesTheManifestWithItsType(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, nil), 0, site)

	rec := get(handler, "/manifest.webmanifest", "10.0.0.5:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/manifest+json" {
		t.Errorf("Content-Type = %q, want application/manifest+json", got)
	}
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=3600" {
		t.Errorf("Cache-Control = %q, want an hour", got)
	}

	if rec := get(handler, "/manifest.webmanifest", "8.8.8.8:5000"); rec.Code != http.StatusForbidden {
		t.Errorf("from outside the local network: status = %d, want %d", rec.Code, http.StatusForbidden)
	}
	req := httptest.NewRequest(http.MethodGet, "/manifest.webmanifest", nil)
	req.RemoteAddr = "192.168.1.20:5000"
	req.Host = "evil.example:9393"
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusMisdirectedRequest {
		t.Errorf("for an unknown host: status = %d, want %d", rec.Code, http.StatusMisdirectedRequest)
	}
}

func TestWebsiteServesNoDirectoriesOrMissingFiles(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, nil), 0, site)

	for _, path := range []string{"/flags/", "/flags", "/missing-ABCDEFGH.js"} {
		rec := get(handler, path, "10.0.0.5:5000")

		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want %d", path, rec.Code, http.StatusNotFound)
		}
		if got := rec.Header().Get("Cache-Control"); got != "" {
			t.Errorf("%s: Cache-Control = %q, want none on a 404", path, got)
		}
	}
}

func TestAPIAnswersCarryNosniff(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, nil), 0, site)

	rec := get(handler, "/api/metrics", "10.0.0.5:5000")

	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q, want nosniff", got)
	}
}

func TestExplainsMissingWebsiteBuild(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, nil), 0, fstest.MapFS{})

	rec := get(handler, "/", "10.0.0.5:5000")

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestLocalNetworkOnly(t *testing.T) {
	tests := []struct {
		remoteAddr string
		wantStatus int
	}{
		{"127.0.0.1:5000", http.StatusOK},
		{"[::1]:5000", http.StatusOK},
		{"192.168.1.20:5000", http.StatusOK},
		{"10.1.2.3:5000", http.StatusOK},
		{"172.16.0.9:5000", http.StatusOK},
		{"169.254.10.10:5000", http.StatusOK},
		{"[fd00::1]:5000", http.StatusOK},
		{"[fe80::1]:5000", http.StatusOK},
		{"[::ffff:192.168.1.20]:5000", http.StatusOK},
		{"8.8.8.8:5000", http.StatusForbidden},
		{"172.32.0.1:5000", http.StatusForbidden},
		{"[2001:db8::1]:5000", http.StatusForbidden},
		{"not-an-address", http.StatusForbidden},
	}
	handler := newHandler(device(fakeCollector{}, nil), 0, site)

	for _, tt := range tests {
		t.Run(tt.remoteAddr, func(t *testing.T) {
			rec := get(handler, "/api/metrics", tt.remoteAddr)
			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
		})
	}
}

type fakeHistory struct {
	from, to time.Time
	// newest is when the newest reading is from; zero when there is none.
	newest time.Time
	// series is what Range returns; nil returns one CPU value.
	series []history.Series
	extras map[string]history.ExtraInfo
}

func (f *fakeHistory) ExtraInfo(context.Context) (map[string]history.ExtraInfo, error) {
	return f.extras, nil
}

func (f *fakeHistory) Newest(context.Context) (time.Time, bool, error) {
	return f.newest, !f.newest.IsZero(), nil
}

func (f *fakeHistory) Range(_ context.Context, from, to time.Time) ([]history.Series, time.Duration, error) {
	f.from, f.to = from, to
	if f.series != nil {
		return f.series, time.Minute, nil
	}
	return []history.Series{{Metric: history.MetricCPU, Points: []history.Point{{Time: from.Unix(), Value: 12.5}}}}, 4 * time.Minute, nil
}

func TestHistoryReturnsTheRequestedRange(t *testing.T) {
	reader := &fakeHistory{}
	handler := newHandler(device(fakeCollector{}, reader), 30*24*time.Hour, site)
	to := time.Now().Add(-time.Hour).Unix()
	from := to - 24*3600

	rec := get(handler, fmt.Sprintf("/api/history?from=%d&to=%d", from, to), "10.0.0.5:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusOK, rec.Body)
	}
	var got historyResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.From != from || got.To != to || reader.from.Unix() != from || reader.to.Unix() != to {
		t.Errorf("range = %d to %d (read %v to %v), want %d to %d", got.From, got.To, reader.from, reader.to, from, to)
	}
	if got.StepSeconds != 240 {
		t.Errorf("StepSeconds = %d, want the reader's step of 240", got.StepSeconds)
	}
	if got.RetentionDays != 30 || len(got.Series) != 1 || got.Series[0].Points[0].Value != 12.5 {
		t.Errorf("response = %+v, want 30 retention days and the stored CPU usage", got)
	}
}

func TestHistoryLimitsTheRangeToTheRetention(t *testing.T) {
	reader := &fakeHistory{}
	handler := newHandler(device(fakeCollector{}, reader), 24*time.Hour, site)

	rec := get(handler, "/api/history?from=0&to=9223372036854775807", "10.0.0.5:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	now := time.Now()
	if reader.from.Before(now.Add(-25*time.Hour)) || reader.to.After(now.Add(time.Minute)) {
		t.Errorf("read %v to %v, want at most the last day", reader.from, reader.to)
	}
}

func TestHistoryOfADeviceNotAnsweringEndsAtItsNewestReading(t *testing.T) {
	newest := time.Now().Add(-3 * time.Hour).Truncate(time.Second)
	reader := &fakeHistory{newest: newest}
	handler := newHandler([]Device{{ID: "local"}, {ID: "laptop", Unreachable: true, History: reader}}, 30*24*time.Hour, site)
	to := time.Now().Unix()

	rec := get(handler, fmt.Sprintf("/api/history?device=laptop&from=%d&to=%d", to-60, to), "10.0.0.5:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusOK, rec.Body)
	}
	var got historyResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	wantTo := newest.Unix() + 1
	if got.From != wantTo-60 || got.To != wantTo || reader.to.Unix() != wantTo {
		t.Errorf("range = %d to %d, want the minute up to the newest reading, %d to %d", got.From, got.To, wantTo-60, wantTo)
	}
	if got.LastReading != newest.Unix() {
		t.Errorf("LastReading = %d, want %d", got.LastReading, newest.Unix())
	}
}

func TestHistoryOfADeviceNotAnsweringWithoutReadingsStaysAsAsked(t *testing.T) {
	reader := &fakeHistory{}
	handler := newHandler([]Device{{ID: "local"}, {ID: "laptop", Unreachable: true, History: reader}}, 24*time.Hour, site)
	to := time.Now().Unix()

	rec := get(handler, fmt.Sprintf("/api/history?device=laptop&from=%d&to=%d", to-60, to), "10.0.0.5:5000")

	var got historyResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.To != to || got.LastReading != 0 {
		t.Errorf("response = %+v, want the range as asked and no last reading", got)
	}
}

func TestHistoryOfAnAnsweringDeviceIgnoresItsNewestReading(t *testing.T) {
	reader := &fakeHistory{newest: time.Now().Add(-time.Hour)}
	handler := newHandler(device(fakeCollector{}, reader), 24*time.Hour, site)
	to := time.Now().Unix()

	rec := get(handler, fmt.Sprintf("/api/history?from=%d&to=%d", to-60, to), "10.0.0.5:5000")

	var got historyResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got.To != to || got.LastReading != 0 {
		t.Errorf("response = %+v, want the range as asked and no last reading", got)
	}
}

func TestHistoryRefusesInvalidRanges(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, &fakeHistory{}), time.Hour, site)
	for _, query := range []string{"", "?from=1", "?from=a&to=b", "?from=200&to=100", "?from=100&to=100"} {
		if rec := get(handler, "/api/history"+query, "10.0.0.5:5000"); rec.Code != http.StatusBadRequest {
			t.Errorf("GET /api/history%s status = %d, want %d", query, rec.Code, http.StatusBadRequest)
		}
	}
}

type fakeAvailability hub.Availability

func (f fakeAvailability) Availability(context.Context) (hub.Availability, error) {
	return hub.Availability(f), nil
}

func (f fakeAvailability) OutagesBetween(context.Context, time.Time, time.Time) ([]hub.Outage, error) {
	if f.LastOutage == nil {
		return nil, nil
	}
	return []hub.Outage{*f.LastOutage}, nil
}

func TestAvailabilityOfAnotherDevice(t *testing.T) {
	since := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	handler := newHandler([]Device{
		{ID: "local"},
		{ID: "pi", Availability: fakeAvailability{Since: since, OfflineSeconds: 90, Outages: 1}},
	}, 0, site)

	if rec := get(handler, "/api/availability", "192.168.1.20:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("status for this device = %d, want %d", rec.Code, http.StatusNotFound)
	}
	rec := get(handler, "/api/availability?device=pi", "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var got hub.Availability
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !got.Since.Equal(since) || got.OfflineSeconds != 90 || got.Outages != 1 || got.LastOutage != nil {
		t.Errorf("availability = %+v", got)
	}
}

func TestUpdateTellsANewerRelease(t *testing.T) {
	want := update.Status{Current: "0.1.0", Latest: "0.2.0", URL: "https://github.com/Programmer-Den/den-watcher/releases/tag/v0.2.0"}
	handler := New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site, Update: func() update.Status { return want }})

	rec := get(handler, "/api/update", "192.168.1.20:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var got update.Status
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if got != want {
		t.Errorf("update = %+v, want %+v", got, want)
	}
}

func TestHistoryDescribesTheExtras(t *testing.T) {
	points := []history.Point{{Time: time.Now().Unix(), Value: 1}}
	described := history.ExtraInfo{Title: "Pressure", Label: "CPU", Unit: metrics.UnitPercent}
	reader := &fakeHistory{
		series: []history.Series{
			{Metric: history.MetricCPU, Points: points},
			{Metric: "extra:pressure/cpu", Points: points},
			{Metric: "extra:pressure/unknown", Points: points},
		},
		extras: map[string]history.ExtraInfo{"extra:pressure/cpu": described, "extra:other/x": {}},
	}
	handler := newHandler(device(fakeCollector{}, reader), 30*24*time.Hour, site)
	to := time.Now().Unix()

	rec := get(handler, fmt.Sprintf("/api/history?from=%d&to=%d", to-3600, to), "10.0.0.5:5000")

	var got historyResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	metricNames := []string{}
	for _, s := range got.Series {
		metricNames = append(metricNames, s.Metric)
	}
	if !reflect.DeepEqual(metricNames, []string{history.MetricCPU, "extra:pressure/cpu"}) {
		t.Errorf("series = %v, want the CPU and the described extra", metricNames)
	}
	if want := map[string]history.ExtraInfo{"extra:pressure/cpu": described}; !reflect.DeepEqual(got.Extras, want) {
		t.Errorf("extras = %+v, want %+v", got.Extras, want)
	}
}
