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

// fakeAppUses returns the same usage and keeps what it was asked for.
type fakeAppUses struct {
	device   string
	from, to time.Time
	step     time.Duration
}

func (f *fakeAppUses) AppUses(_ context.Context, device string, from, to time.Time, step time.Duration) (history.AppUsage, error) {
	f.device, f.from, f.to, f.step = device, from, to, step
	return history.AppUsage{StepSeconds: 3600, Unlocks: 3, Steps: []history.AppUsageStep{}, Apps: []history.AppTime{{App: "chat", Label: "Chat", Seconds: 60, Opens: 2}}}, nil
}

func TestServesAPhonesAppUsesWithinTheRetention(t *testing.T) {
	source := &fakeAppUses{}
	devices := append(device(fakeCollector{}, nil), Device{ID: "pixel", Kind: hub.KindPhone, Metrics: fakeCollector{}})
	handler := New(Site{Devices: DeviceList(devices), Files: site, AppUses: source, Retention: 7 * 24 * time.Hour})
	now := time.Now()
	rec := get(handler, "/api/phone/usage?device=pixel&from=0&to="+strconv.FormatInt(now.Unix(), 10), "192.168.1.20:5000")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got appUseResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if source.device != "pixel" || got.Unlocks != 3 || len(got.Apps) != 1 || got.Apps[0].Label != "Chat" {
		t.Errorf("device %q, body = %+v", source.device, got)
	}
	if want := now.Add(-7 * 24 * time.Hour).Unix(); got.From < want-5 || source.from.Unix() != got.From {
		t.Errorf("from = %d, want it moved to the start of the retention, %d", got.From, want)
	}
	if source.step != source.to.Sub(source.from)/maxAppUseSteps {
		t.Errorf("step = %v, want the range in %d steps", source.step, maxAppUseSteps)
	}

	if rec := get(handler, "/api/phone/usage?device=local&from=0&to=10", "192.168.1.20:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("status for a device that is no phone = %d, want 404", rec.Code)
	}
	if rec := get(handler, "/api/phone/usage?device=pixel&from=5&to=1", "192.168.1.20:5000"); rec.Code != http.StatusBadRequest {
		t.Errorf("status of a range that ends before it starts = %d, want 400", rec.Code)
	}
}
