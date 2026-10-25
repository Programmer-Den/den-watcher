package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func TestDiskPaths(t *testing.T) {
	tests := []struct {
		value string
		want  []string
	}{
		{"", []string{systemDisk()}},
		{"/", []string{"/"}},
		{" /, /mnt/usb ,", []string{"/", "/mnt/usb"}},
		{"/,/mnt/usb, /", []string{"/", "/mnt/usb"}},
	}
	for _, tt := range tests {
		t.Setenv("DISK_PATHS", tt.value)
		if got := diskPaths(); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("diskPaths() with DISK_PATHS=%q = %q, want %q", tt.value, got, tt.want)
		}
	}
}

func TestIntSettingOr(t *testing.T) {
	for _, tt := range []struct {
		value string
		want  int
	}{{"", 30}, {"1", 1}, {" 90 ", 90}, {"3650", 3650}} {
		t.Setenv("RETENTION_DAYS", tt.value)
		if got, err := intSettingOr("RETENTION_DAYS", 30, 3650, " of days"); err != nil || got != tt.want {
			t.Errorf("intSettingOr() with RETENTION_DAYS=%q = %v, %v, want %v", tt.value, got, err, tt.want)
		}
	}
	for _, value := range []string{"0", "-1", "30d", "1.5", "3651"} {
		t.Setenv("RETENTION_DAYS", value)
		want := fmt.Sprintf("RETENTION_DAYS is %q; set it to a whole number of days from 1 to 3650", value)
		if _, err := intSettingOr("RETENTION_DAYS", 30, 3650, " of days"); err == nil || err.Error() != want {
			t.Errorf("intSettingOr() with RETENTION_DAYS=%q error = %v, want %q", value, err, want)
		}
	}
}

func TestPagePort(t *testing.T) {
	tests := []struct {
		public, listen, want string
	}{
		{"", ":9393", "9393"},
		{"", "0.0.0.0:8080", "8080"},
		{"8090", ":9393", "8090"},
		{" 8090 ", ":9393", "8090"},
	}
	for _, tt := range tests {
		t.Setenv("PUBLIC_PORT", tt.public)
		got, err := pagePort(tt.listen)
		if err != nil || got != tt.want {
			t.Errorf("pagePort(%q) with PUBLIC_PORT=%q = %q, %v, want %q", tt.listen, tt.public, got, err, tt.want)
		}
	}
}

func TestPagePortRefusesInvalidValues(t *testing.T) {
	for _, value := range []string{"0", "65536", "port", "80/x"} {
		t.Setenv("PUBLIC_PORT", value)
		if _, err := pagePort(":9393"); err == nil {
			t.Errorf("pagePort() with PUBLIC_PORT=%q error = nil, want an error", value)
		}
	}
	t.Setenv("PUBLIC_PORT", "")
	if _, err := pagePort("9393"); err == nil {
		t.Error("pagePort(\"9393\") error = nil, want an error for a LISTEN_ADDR without a port")
	}
}

func TestDataOnly(t *testing.T) {
	tests := []struct {
		value   string
		want    bool
		wantErr bool
	}{
		{"", false, false},
		{"true", true, false},
		{" false ", false, false},
		{"yes", false, true},
	}
	for _, tt := range tests {
		t.Setenv("DATA_ONLY", tt.value)
		got, err := boolSettingOr("DATA_ONLY", false)
		if got != tt.want || (err != nil) != tt.wantErr {
			t.Errorf("boolSettingOr(DATA_ONLY=%q) = %v, %v, want %v with error %v", tt.value, got, err, tt.want, tt.wantErr)
		}
	}
}

func TestBoolSettingOr(t *testing.T) {
	tests := []struct {
		value    string
		fallback bool
		want     bool
	}{
		{"", true, true},
		{"", false, false},
		{"false", true, false},
		{" TRUE ", false, true},
	}
	for _, tt := range tests {
		t.Setenv("UPDATE_CHECK", tt.value)
		got, err := boolSettingOr("UPDATE_CHECK", tt.fallback)
		if err != nil || got != tt.want {
			t.Errorf("boolSettingOr() with %q and default %v = %v, %v, want %v", tt.value, tt.fallback, got, err, tt.want)
		}
	}
	t.Setenv("UPDATE_CHECK", "sometimes")
	if _, err := boolSettingOr("UPDATE_CHECK", true); err == nil {
		t.Error("boolSettingOr() with \"sometimes\" error = nil, want one")
	}
}

func TestOwnName(t *testing.T) {
	hostname, _ := os.Hostname()
	tests := []struct {
		deviceName, hostProc, want string
	}{
		{"Office PC", "", "Office PC"},
		{" Office PC ", "/host/proc", "Office PC"},
		{"", "", hostname},
		{"", "/host/proc", ""}, // in a container, the hostname is the container's
	}
	for _, tt := range tests {
		t.Setenv("DEVICE_NAME", tt.deviceName)
		t.Setenv("HOST_PROC", tt.hostProc)
		if got := ownName(); got != tt.want {
			t.Errorf("ownName() with DEVICE_NAME=%q, HOST_PROC=%q = %q, want %q", tt.deviceName, tt.hostProc, got, tt.want)
		}
	}
}

func TestWithBufferKeepsTheMinutesInTheDatabase(t *testing.T) {
	collector, err := metrics.NewCollector(context.Background(), []string{t.TempDir()})
	if err != nil {
		t.Fatalf("NewCollector() error = %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	path := filepath.Join(t.TempDir(), "usage-control.db")

	minutes, paired, wait := withBuffer(ctx, metrics.NewSampler(collector), path, time.Hour, 1, false)
	cancel()
	wait()

	if _, err := os.Stat(path); minutes == nil || err != nil {
		t.Errorf("withBuffer() = %v, and the database %v; want the buffer, kept in the database", minutes, err)
	}
	if paired == nil {
		t.Error("withBuffer() gave no pairing code, want one kept in the database")
	}
}

func TestWithBufferRunsWithoutADatabaseItCannotOpen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "usage-control.db")

	minutes, paired, wait := withBuffer(context.Background(), nil, path, time.Hour, 1, false)
	wait()

	if minutes != nil || paired != nil {
		t.Errorf("withBuffer() with a database it cannot open = %v, %v; want no minutes and no pairing instead of failing", minutes, paired)
	}
}

func TestPrintPairingCodeAsksTheRunningDevice(t *testing.T) {
	device := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/pairing" {
			http.NotFound(w, r)
			return
		}
		_, _ = io.WriteString(w, `{"code":"7KQM-X2RP"}`)
	}))
	defer device.Close()
	_, port, _ := net.SplitHostPort(device.Listener.Addr().String())

	for _, addr := range []string{":" + port, "0.0.0.0:" + port, device.Listener.Addr().String()} {
		t.Setenv("LISTEN_ADDR", addr)
		var out strings.Builder
		if err := printPairingCode(&out); err != nil || out.String() != "7KQM-X2RP\n" {
			t.Fatalf("printPairingCode() with LISTEN_ADDR %s = %q, %v; want the code on a line", addr, out.String(), err)
		}
	}
	device.Close()
	var out strings.Builder
	if err := printPairingCode(&out); err == nil || !strings.Contains(err.Error(), "is it running") {
		t.Fatalf("printPairingCode() without a running device = %v, want an error that asks whether it runs", err)
	}
}

// setUpRun points run at a database in a temporary folder and clears the
// settings that would change what it sets up.
func setUpRun(t *testing.T, addr string) string {
	t.Helper()
	database := filepath.Join(t.TempDir(), "usage-control.db")
	t.Setenv("LISTEN_ADDR", addr)
	t.Setenv("DATABASE_PATH", database)
	t.Setenv("DISK_PATHS", t.TempDir())
	for _, name := range []string{"PUBLIC_PORT", "RETENTION_DAYS", "HISTORY_MAX_ENTRIES", "HUB_DEVICES", "DATA_ONLY", "BUFFER_HOURS", "RESET_PASSWORD", "UPDATE_CHECK", "ADDONS_DIR", "ALLOWED_HOSTS", "PROMETHEUS"} {
		t.Setenv(name, "")
	}
	return database
}

func TestRunStopsBeforeTheSetupWhenThePortIsTaken(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Listen() error = %v", err)
	}
	defer func() { _ = taken.Close() }()
	database := setUpRun(t, taken.Addr().String())

	err = run(context.Background())

	var opErr *net.OpError
	if !errors.As(err, &opErr) || opErr.Op != "listen" {
		t.Errorf("run() with a taken port error = %v, want the listen error", err)
	}
	if _, statErr := os.Stat(database); !errors.Is(statErr, os.ErrNotExist) {
		t.Errorf("run() with a taken port opened the database (%v); it should stop before the setup", statErr)
	}
}

func TestRunStopsBeforeTheSetupWhenUpdateCheckIsInvalid(t *testing.T) {
	database := setUpRun(t, "127.0.0.1:0")
	t.Setenv("UPDATE_CHECK", "no")

	if err := run(context.Background()); err == nil || !strings.Contains(err.Error(), "UPDATE_CHECK") {
		t.Errorf("run() with UPDATE_CHECK=no error = %v, want one naming UPDATE_CHECK", err)
	}
	if _, statErr := os.Stat(database); !errors.Is(statErr, os.ErrNotExist) {
		t.Errorf("run() with UPDATE_CHECK=no opened the database (%v); it should stop before the setup", statErr)
	}
}

func TestAllowedHostsLeavesOutAndNamesWrongEntries(t *testing.T) {
	var logged bytes.Buffer
	defer slog.SetDefault(slog.Default())
	slog.SetDefault(slog.New(slog.NewTextHandler(&logged, nil)))
	t.Setenv("ALLOWED_HOSTS", "pi.fritz.box,http://pi.lan, pi.lan/ ,192.168.1.9")

	if got, want := allowedHosts(), []string{"pi.fritz.box", "192.168.1.9"}; !reflect.DeepEqual(got, want) {
		t.Errorf("allowedHosts() = %q, want %q", got, want)
	}
	text := logged.String()
	if strings.Count(text, "level=WARN") != 2 || !strings.Contains(text, "entry=http://pi.lan") || !strings.Contains(text, "entry=pi.lan/") {
		t.Errorf("log = %q, want a warning naming each wrong entry", text)
	}
}

func TestRunRefusesPrometheusWithDataOnly(t *testing.T) {
	database := setUpRun(t, "127.0.0.1:0")
	t.Setenv("DATA_ONLY", "true")
	t.Setenv("PROMETHEUS", "true")

	if err := run(context.Background()); err == nil || !strings.Contains(err.Error(), "PROMETHEUS") {
		t.Errorf("run() with DATA_ONLY and PROMETHEUS error = %v, want one naming PROMETHEUS", err)
	}
	if _, statErr := os.Stat(database); !errors.Is(statErr, os.ErrNotExist) {
		t.Errorf("run() with DATA_ONLY and PROMETHEUS opened the database (%v); it should stop before the setup", statErr)
	}
}

func TestDiskPathsHintFitsThePlatform(t *testing.T) {
	tests := []struct {
		goos      string
		container bool
		want      string
	}{
		{"windows", false, `C:\`},
		{"linux", true, "compose.yaml"},
		{"linux", false, "/mnt/usb"},
		{"darwin", false, "/mnt/usb"},
	}
	for _, tt := range tests {
		if got := diskPathsHint(tt.goos, tt.container); !strings.Contains(got, tt.want) {
			t.Errorf("diskPathsHint(%q, %v) = %q, want it to mention %q", tt.goos, tt.container, got, tt.want)
		}
	}
}

func TestRunServesUntilStopped(t *testing.T) {
	free, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Listen() error = %v", err)
	}
	addr := free.Addr().String()
	_ = free.Close()
	setUpRun(t, addr)
	// A wrong entry in ALLOWED_HOSTS is left out; the device still starts.
	t.Setenv("ALLOWED_HOSTS", "http://pi.lan")

	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan error, 1)
	go func() { stopped <- run(ctx) }()

	answered := false
	for range 100 {
		if response, err := http.Get("http://" + addr + "/api/metrics"); err == nil {
			_ = response.Body.Close()
			answered = true
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	cancel()
	if err := <-stopped; err != nil {
		t.Errorf("run() error = %v, want nil after it was stopped", err)
	}
	if !answered {
		t.Error("run() did not answer on its port")
	}
}

func TestRouterDevicesNeedThePasswordOfALogin(t *testing.T) {
	t.Setenv("HUB_ROUTERS", "Home router=upnp:192.168.1.1,Office=asus:admin@192.168.2.1")
	t.Setenv("CREDENTIALS_DIRECTORY", "")
	t.Setenv("ROUTER_PASSWORDS_FILE", "")
	if _, err := routerDevices("usage-control.db"); err == nil || !strings.Contains(err.Error(), "Office") {
		t.Errorf("without a passwords file: %v, want an error naming the router", err)
	}

	path := filepath.Join(t.TempDir(), "router-passwords")
	if err := os.WriteFile(path, []byte("Home router=unused\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ROUTER_PASSWORDS_FILE", path)
	if _, err := routerDevices("usage-control.db"); err == nil || !strings.Contains(err.Error(), "Office") {
		t.Errorf("without the router's line: %v, want an error naming the router", err)
	}

	if err := os.WriteFile(path, []byte("office=secret\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	devices, err := routerDevices("usage-control.db")
	if err != nil {
		t.Fatal(err)
	}
	if len(devices) != 2 || devices[0].ID != "home-router" || devices[1].ID != "office" || devices[1].Source == nil {
		t.Errorf("got %+v", devices)
	}
}

func TestRouterDevicesRefuseAShortSNMPv3Password(t *testing.T) {
	t.Setenv("HUB_ROUTERS", "Core=snmpv3:monitor@192.168.1.3")
	path := filepath.Join(t.TempDir(), "router-passwords")
	if err := os.WriteFile(path, []byte("Core=short\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ROUTER_PASSWORDS_FILE", path)
	if _, err := routerDevices("usage-control.db"); err == nil || !strings.Contains(err.Error(), "8 characters") {
		t.Errorf("with a 5-character password: %v, want an error", err)
	}
	if err := os.WriteFile(path, []byte("Core=long enough\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := routerDevices("usage-control.db"); err != nil {
		t.Error(err)
	}
}

func TestCheckDevices(t *testing.T) {
	t.Setenv("HUB_CHECKS", "Printer=192.168.1.50:631, NAS=192.168.1.10")
	devices, err := checkDevices()
	if err != nil {
		t.Fatal(err)
	}
	if len(devices) != 2 || devices[0].ID != "printer" || devices[0].Address != "192.168.1.50:631" ||
		devices[1].Address != "192.168.1.10" || !devices[1].Checked || devices[1].Source == nil {
		t.Errorf("got %+v", devices)
	}
	t.Setenv("HUB_CHECKS", "Printer=192.168.1.50:99999")
	if _, err := checkDevices(); err == nil || !strings.Contains(err.Error(), "HUB_CHECKS") {
		t.Errorf("with a wrong port: %v, want an error naming HUB_CHECKS", err)
	}
}
