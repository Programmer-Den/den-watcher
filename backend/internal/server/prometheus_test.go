package server

import (
	"bytes"
	"errors"
	"math"
	"net/http"
	"strings"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func TestPrometheusIsOffWithoutTheSetting(t *testing.T) {
	handler := newHandler(device(fakeCollector{}, nil), 0, site)

	if got := get(handler, "/metrics", "192.168.1.10:5000"); got.Code != http.StatusNotFound {
		t.Errorf("GET /metrics without PROMETHEUS status = %d, want 404", got.Code)
	}
}

func TestPrometheusListsEveryDevice(t *testing.T) {
	ioWait := 1.5
	value := 42.0
	response := 12.5
	devices := DeviceList{
		{ID: "local", Metrics: fakeCollector{snapshot: metrics.Snapshot{
			UptimeSeconds: 3600,
			CPU:           metrics.CPU{UsagePercent: 12.5, Cores: 2, CoreUsagePercent: []float64{10, 15}, IOWaitPercent: &ioWait},
			Memory:        metrics.Memory{TotalBytes: 8000, UsedBytes: 2000, UsedPercent: 25, Swap: &metrics.Swap{TotalBytes: 100, UsedBytes: 0}},
			Temperatures:  []metrics.Temperature{{Sensor: "cpu_thermal", Celsius: 48.3}},
			Network:       []metrics.NetworkInterface{{Name: "eth0", ReceivedBytes: 12345678901234, SendBytesPerSecond: 512}},
			Extras: []metrics.Extra{{ID: "wifi", Items: []metrics.ExtraItem{
				{ID: "signal", Label: "Signal", Unit: metrics.UnitPercent, Value: &value},
				{ID: "ssid", Label: "Network", Unit: metrics.UnitText, Text: "home"},
			}}},
		}}},
		{
			ID: "pi", Name: "Pi", Alerts: []alerts.Alert{{Level: alerts.Critical}, {Level: alerts.Warning}, {Level: alerts.Critical}},
			Metrics: fakeCollector{snapshot: metrics.Snapshot{Disks: []metrics.Disk{{Path: "/", TotalBytes: 64, UsedPercent: 50}}, ResponseMilliseconds: &response}},
		},
		{ID: "nas", Name: "NAS", Unreachable: true, Metrics: fakeCollector{}},
		{ID: "broken", Name: "Broken", Metrics: fakeCollector{err: errors.New("no /proc")}},
	}
	handler := New(Site{Devices: devices, Files: site, Prometheus: true})

	got := get(handler, "/metrics", "192.168.1.10:5000")

	if got.Code != http.StatusOK {
		t.Fatalf("GET /metrics status = %d, want 200", got.Code)
	}
	if ct := got.Header().Get("Content-Type"); ct != "text/plain; version=0.0.4; charset=utf-8" {
		t.Errorf("Content-Type = %q, want the Prometheus text format", ct)
	}
	body := got.Body.String()
	for _, want := range []string{
		"# HELP denwatcher_device_up 1 when the device answered, 0 when it did not.\n# TYPE denwatcher_device_up gauge\n" +
			`denwatcher_device_up{device="Host Hub",id="local"} 1` + "\n" +
			`denwatcher_device_up{device="Pi",id="pi"} 1` + "\n" +
			`denwatcher_device_up{device="NAS",id="nas"} 0` + "\n" +
			`denwatcher_device_up{device="Broken",id="broken"} 0` + "\n",
		`denwatcher_alerts{device="Pi",id="pi",level="warning"} 1`,
		`denwatcher_alerts{device="Pi",id="pi",level="alert"} 2`,
		`denwatcher_alerts{device="NAS",id="nas",level="alert"} 0`,
		`denwatcher_uptime_seconds{device="Host Hub",id="local"} 3600`,
		`denwatcher_cpu_usage_percent{device="Host Hub",id="local"} 12.5`,
		`denwatcher_cpu_core_usage_percent{device="Host Hub",id="local",core="1"} 15`,
		`denwatcher_cpu_iowait_percent{device="Host Hub",id="local"} 1.5`,
		`denwatcher_memory_total_bytes{device="Host Hub",id="local"} 8000`,
		`denwatcher_swap_total_bytes{device="Host Hub",id="local"} 100`,
		`denwatcher_temperature_celsius{device="Host Hub",id="local",sensor="cpu_thermal"} 48.3`,
		"# TYPE denwatcher_network_received_bytes_total counter\n" +
			`denwatcher_network_received_bytes_total{device="Host Hub",id="local",interface="eth0"} 12345678901234`,
		`denwatcher_network_send_bytes_per_second{device="Host Hub",id="local",interface="eth0"} 512`,
		`denwatcher_disk_used_percent{device="Pi",id="pi",path="/"} 50`,
		`denwatcher_response_seconds{device="Pi",id="pi"} 0.0125`,
		`denwatcher_extra{device="Host Hub",id="local",group="wifi",item="signal",unit="percent",label="Signal"} 42`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("GET /metrics is missing\n%s\nin\n%s", want, body)
		}
	}
	for _, unwanted := range []string{
		`item="ssid"`, `id="nas"} 0` + "\ndenwatcher_uptime", `denwatcher_uptime_seconds{device="NAS"`, "denwatcher_battery", "denwatcher_disk_latency",
		// The Pi reports no uptime, CPU or memory, as a router or check.
		`denwatcher_uptime_seconds{device="Pi"`, `denwatcher_cpu_usage_percent{device="Pi"`, `denwatcher_cpu_cores{device="Pi"`,
		`denwatcher_memory_total_bytes{device="Pi"`, `denwatcher_memory_used_percent{device="Pi"`,
	} {
		if strings.Contains(body, unwanted) {
			t.Errorf("GET /metrics has %q, which it should leave out:\n%s", unwanted, body)
		}
	}
	if n := strings.Count(body, "# TYPE denwatcher_uptime_seconds "); n != 1 {
		t.Errorf("GET /metrics has %d TYPE lines for denwatcher_uptime_seconds, want one for all devices", n)
	}
}

func TestPrometheusIsLocalNetworkOnly(t *testing.T) {
	handler := New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site, Prometheus: true})

	if got := get(handler, "/metrics", "203.0.113.5:5000"); got.Code != http.StatusForbidden {
		t.Errorf("GET /metrics from the internet status = %d, want 403", got.Code)
	}
}

func TestPrometheusEscapesLabelValues(t *testing.T) {
	devices := []Device{{ID: "pc", Name: "Office's \"Gaming\" PC\\2\nnew"}}
	var out bytes.Buffer

	writePrometheus(&out, devices, map[string]metrics.Snapshot{"pc": {
		Fans: []metrics.Fan{{Name: "bad \xff byte", RPM: 900}},
	}})

	for _, want := range []string{
		`denwatcher_device_up{device="Office's \"Gaming\" PC\\2\nnew",id="pc"} 1`,
		`denwatcher_fan_rpm{device="Office's \"Gaming\" PC\\2\nnew",id="pc",fan="bad ` + "�" + ` byte"} 900`,
	} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("writePrometheus() is missing\n%s\nin\n%s", want, out.String())
		}
	}
}

func TestPrometheusFormatsValues(t *testing.T) {
	tests := []struct {
		value float64
		want  string
	}{
		{0, "0"},
		{12.5, "12.5"},
		{1e21, "1e+21"},
		{math.NaN(), "NaN"},
		{math.Inf(1), "+Inf"},
		{math.Inf(-1), "-Inf"},
	}
	for _, tt := range tests {
		if got := formatFloat(tt.value); got != tt.want {
			t.Errorf("formatFloat(%v) = %q, want %q", tt.value, got, tt.want)
		}
	}
	if got := escapeHelp("a\\b\nc \"d\""); got != `a\\b\nc "d"` {
		t.Errorf("escapeHelp() = %q, want backslash and line feed escaped, quotes kept", got)
	}
}

func TestPrometheusLeavesOutARepeatedSeries(t *testing.T) {
	devices := []Device{{ID: "pc", Name: "PC"}}
	var out bytes.Buffer

	writePrometheus(&out, devices, map[string]metrics.Snapshot{"pc": {
		Disks: []metrics.Disk{{Path: "/", UsedPercent: 20}, {Path: "/", UsedPercent: 30}},
	}})

	if got := strings.Count(out.String(), `denwatcher_disk_used_percent{device="PC",id="pc",path="/"}`); got != 1 {
		t.Errorf("the disk / is listed %d times, want once:\n%s", got, out.String())
	}
}
