package server

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
)

func TestHistoryCSVHasAColumnPerMetricAndARowPerTime(t *testing.T) {
	to := time.Now().Truncate(time.Hour).Unix()
	from := to - 3600
	reader := &fakeHistory{
		series: []history.Series{
			{Metric: history.MetricCPU, Points: []history.Point{{Time: from, Value: 12.5}, {Time: from + 60, Value: 3}}},
			{Metric: "temperature:cpu, \"die\"", Points: []history.Point{{Time: from + 60, Value: -4.25}}},
		},
	}
	handler := newHandler([]Device{{ID: "nas", Name: "Büro NAS", History: reader}}, 24*time.Hour, site)

	rec := get(handler, fmt.Sprintf("/api/history.csv?device=nas&from=%d&to=%d", from, to), "10.0.0.5:5000")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusOK, rec.Body)
	}
	if got := rec.Header().Get("Content-Type"); got != "text/csv; charset=utf-8" {
		t.Errorf("Content-Type = %q", got)
	}
	stamp := func(t int64) string { return time.Unix(t, 0).UTC().Format("20060102T150405Z") }
	wantDisposition := fmt.Sprintf(`attachment; filename="B-ro-NAS-%s-%s.csv"; filename*=UTF-8''B%%C3%%BCro-NAS-%[1]s-%[2]s.csv`, stamp(from), stamp(to))
	if got := rec.Header().Get("Content-Disposition"); got != wantDisposition {
		t.Errorf("Content-Disposition = %q, want %q", got, wantDisposition)
	}
	iso := func(t int64) string { return time.Unix(t, 0).UTC().Format(time.RFC3339) }
	want := "time,cpu,\"temperature:cpu, \"\"die\"\"\"\r\n" +
		iso(from) + ",12.5,\r\n" +
		iso(from+60) + ",3,-4.25\r\n"
	if got := rec.Body.String(); got != want {
		t.Errorf("body =\n%q\nwant\n%q", got, want)
	}
}

func TestHistoryCSVRefusesInvalidRangesAndUnknownDevices(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, &fakeHistory{}), time.Hour, site)
	if rec := get(handler, "/api/history.csv?from=200&to=100", "10.0.0.5:5000"); rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	if rec := get(handler, "/api/history.csv?device=nas&from=1&to=2", "10.0.0.5:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
	if rec := get(handler, "/api/history.csv?from=1&to=2", "203.0.113.5:5000"); rec.Code != http.StatusForbidden {
		t.Errorf("from outside the local network: status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestTextCellGuardsAgainstFormulas(t *testing.T) {
	for text, want := range map[string]string{
		"=1+1":       "'=1+1",
		"+cmd":       "'+cmd",
		"-2":         "'-2",
		"@SUM(A1)":   "'@SUM(A1)",
		"\tx":        "'\tx",
		"cpu":        "cpu",
		"disk:/":     "disk:/",
		"":           "",
		"extra:a/=b": "extra:a/=b",
	} {
		if got := textCell(text); got != want {
			t.Errorf("textCell(%q) = %q, want %q", text, got, want)
		}
	}
}

func TestCSVFileNameKeepsOnlySafeCharacters(t *testing.T) {
	const from, to = 1_760_000_000, 1_760_003_600
	for _, tt := range []struct {
		device Device
		want   string
	}{
		{Device{ID: "local"}, "den-watcher"},
		{Device{ID: "x", Name: "Linux NAS"}, "Linux-NAS"},
		{Device{ID: "x", Name: `../..\evil"; name=x.exe`}, "evil-name-x.exe"},
		{Device{ID: "x", Name: "🙂"}, "den-watcher"},
	} {
		want := tt.want + "-20251009T085320Z-20251009T095320Z.csv"
		if got := csvFileName(tt.device, from, to, true); got != want {
			t.Errorf("csvFileName(%q) = %q, want %q", tt.device.Name, got, want)
		}
	}
}
