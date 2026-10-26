package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
)

// fakeWiFi returns the same history and keeps the range it was asked for.
type fakeWiFi struct {
	from, to time.Time
	step     time.Duration
}

func (f *fakeWiFi) WiFi(_ context.Context, from, to time.Time, step time.Duration) (history.WiFiHistory, error) {
	f.from, f.to, f.step = from, to, step
	return history.WiFiHistory{StepSeconds: 3600, Devices: []history.WiFiDevice{}, AccessPoints: []history.WiFiAccessPoint{{ID: "0000000000aa", SSID: "Den"}}}, nil
}

func TestServesWhatTheWiFiSawWithinTheRetention(t *testing.T) {
	source := &fakeWiFi{}
	handler := New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site, WiFi: source, Retention: 7 * 24 * time.Hour})
	now := time.Now()
	rec := get(handler, "/api/wifi?from=0&to="+strconv.FormatInt(now.Unix(), 10), "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got wifiResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.AccessPoints) != 1 || got.AccessPoints[0].SSID != "Den" || got.StepSeconds != 3600 {
		t.Errorf("body = %+v", got)
	}
	if want := now.Add(-7 * 24 * time.Hour).Unix(); got.From < want-5 || source.from.Unix() != got.From {
		t.Errorf("from = %d, want it moved to the start of the retention, %d", got.From, want)
	}
	if source.step != source.to.Sub(source.from)/maxWiFiSteps {
		t.Errorf("step = %v, want the range in %d steps", source.step, maxWiFiSteps)
	}

	if rec := get(handler, "/api/wifi?from=5&to=1", "192.168.1.20:5000"); rec.Code != http.StatusBadRequest {
		t.Errorf("status of a range that ends before it starts = %d, want 400", rec.Code)
	}
}

func TestLeavesOutTheWiFiWithoutAHistory(t *testing.T) {
	handler := New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site})
	if rec := get(handler, "/api/wifi?from=0&to=1", "192.168.1.20:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("status of GET /api/wifi without a history = %d, want 404", rec.Code)
	}
}
