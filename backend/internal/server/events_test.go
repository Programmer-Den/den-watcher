package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/events"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
)

// fakeEventLog holds the events of every device, or fails while err is set.
type fakeEventLog struct {
	byDevice map[string][]events.Event
	err      error
}

func (f fakeEventLog) Between(_ context.Context, device string, _, _ time.Time) ([]events.Event, error) {
	return f.byDevice[device], f.err
}

func TestEventsOfADeviceOldestFirst(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	at := func(minutes int) time.Time { return now.Add(time.Duration(minutes) * time.Minute) }
	ended := at(-20)
	outage := hub.Outage{Start: at(-50), End: at(-45)}
	alertLog := fakeAlertLog{list: []alerts.Alert{
		{ID: 1, Device: "pi", Kind: alerts.KindDisk, Subject: "/", Level: alerts.Warning, Started: at(-30), Ended: &ended},
		{ID: 2, Device: "nas", Kind: alerts.KindCPU, Level: alerts.Warning, Started: at(-30)},
	}}
	eventLog := fakeEventLog{byDevice: map[string][]events.Event{
		"pi": {{Time: at(-40), Kind: events.KindReboot}, {Time: at(-10), Kind: events.KindUpdate, Detail: "1.5.0"}},
	}}
	handler := New(Site{
		Devices: DeviceList([]Device{{ID: "local"}, {ID: "pi", Availability: fakeAvailability{LastOutage: &outage}}}),
		Files:   site, Retention: 24 * time.Hour, Alerts: alertLog, Events: eventLog,
	})

	rec := get(handler, fmt.Sprintf("/api/events?device=pi&from=%d&to=%d", at(-60).Unix(), now.Unix()), "10.0.0.5:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var got struct {
		From, To int64
		Events   []struct {
			Kind   string
			Time   int64
			End    *int64
			Detail string
			Alert  *alerts.Alert
		}
	}
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	var kinds []string
	for _, e := range got.Events {
		kinds = append(kinds, e.Kind)
	}
	if fmt.Sprint(kinds) != "[outage reboot alert update]" {
		t.Fatalf("kinds = %v, want the outage, reboot, alert and update in their order", kinds)
	}
	if e := got.Events[0]; e.Time != outage.Start.Unix() || e.End == nil || *e.End != outage.End.Unix() {
		t.Errorf("outage = %+v", e)
	}
	if e := got.Events[2]; e.Alert == nil || e.Alert.Subject != "/" || e.End == nil || *e.End != ended.Unix() {
		t.Errorf("alert = %+v", e)
	}
	if e := got.Events[3]; e.Detail != "1.5.0" || e.End != nil {
		t.Errorf("update = %+v", e)
	}
}

func TestEventsRefusesInvalidRangesAndAnswersErrors(t *testing.T) {
	devices := DeviceList([]Device{{ID: "local"}})
	handler := New(Site{Devices: devices, Files: site, Retention: time.Hour, Alerts: fakeAlertLog{}, Events: fakeEventLog{}})
	for _, query := range []string{"", "?from=1", "?from=a&to=b", "?from=200&to=100"} {
		if rec := get(handler, "/api/events"+query, "10.0.0.5:5000"); rec.Code != http.StatusBadRequest {
			t.Errorf("GET /api/events%s status = %d, want %d", query, rec.Code, http.StatusBadRequest)
		}
	}
	to := time.Now().Unix()
	query := fmt.Sprintf("/api/events?from=%d&to=%d", to-60, to)
	if rec := get(handler, query, "10.0.0.5:5000"); rec.Code != http.StatusOK || rec.Body.String() == "" {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	failing := New(Site{Devices: devices, Files: site, Retention: time.Hour, Alerts: fakeAlertLog{}, Events: fakeEventLog{err: errors.New("broken")}})
	if rec := get(failing, query, "10.0.0.5:5000"); rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	without := New(Site{Devices: devices, Files: site, Retention: time.Hour})
	if rec := get(without, query, "10.0.0.5:5000"); rec.Code == http.StatusOK && rec.Header().Get("Content-Type") == "application/json" {
		t.Errorf("without an event log GET /api/events answered with JSON")
	}
}
