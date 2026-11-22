package server

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/version"
)

func seconds(s float64) *float64 { return &s }

func TestHealthListsWhatNeedsALookOfEveryDevice(t *testing.T) {
	defer func(v string) { version.Version = v }(version.Version)
	version.Version = "3.10.2"
	handler := newHandler([]Device{
		{ID: "local", Metrics: fakeCollector{snapshot: metrics.Snapshot{Version: "3.10.2", AddOnsStopped: []string{"power"}}}},
		{ID: "pi", Metrics: fakeCollector{snapshot: metrics.Snapshot{Version: "3.9.1h", ClockOffsetSeconds: seconds(-312)}}},
		{ID: "pc", Metrics: fakeCollector{snapshot: metrics.Snapshot{Version: "3.10.2", ClockOffsetSeconds: seconds(4)}}},
		{ID: "nas", Unreachable: true, Pairing: "wrong"},
		{ID: "newer", Metrics: fakeCollector{snapshot: metrics.Snapshot{Version: "3.11.0"}}},
		{ID: "main", Metrics: fakeCollector{snapshot: metrics.Snapshot{Version: "a690bc7"}}},
		{ID: "router", Router: true, Metrics: fakeCollector{snapshot: metrics.Snapshot{}}},
	}, 0, site)

	rec := get(handler, "/api/devices/health", "192.168.1.20:5000")

	var got healthResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); rec.Code != http.StatusOK || err != nil {
		t.Fatalf("GET /api/devices/health = %d, %v", rec.Code, err)
	}
	want := healthResponse{Version: "3.10.2", Problems: []healthProblem{
		{Device: "local", Kind: problemAddOn, Detail: "power"},
		{Device: "pi", Kind: problemVersion, Detail: "3.9.1h"},
		{Device: "pi", Kind: problemClock, Seconds: -312},
		{Device: "nas", Kind: problemPairing, Detail: "wrong"},
	}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestHealthIsAnEmptyListWhenAllIsWell(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, nil), 0, site)

	rec := get(handler, "/api/devices/health", "192.168.1.20:5000")

	if body := rec.Body.String(); rec.Code != http.StatusOK || !json.Valid([]byte(body)) || !containsEmptyProblems(body) {
		t.Errorf("GET /api/devices/health = %d %s, want an empty list of problems", rec.Code, body)
	}
}

func containsEmptyProblems(body string) bool {
	var got struct{ Problems []healthProblem }
	return json.Unmarshal([]byte(body), &got) == nil && got.Problems != nil && len(got.Problems) == 0
}
