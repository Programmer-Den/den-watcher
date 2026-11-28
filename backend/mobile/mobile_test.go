package mobile

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/lan"
)

func TestParseSettings(t *testing.T) {
	got, err := parseSettings("DATABASE_PATH=/data/den-watcher.db\r\n\nDEVICE_NAME=Old phone = hub\n  \nUPDATE_CHECK=")
	if err != nil {
		t.Fatalf("parseSettings() error = %v", err)
	}
	want := []setting{{"DATABASE_PATH", "/data/den-watcher.db"}, {"DEVICE_NAME", "Old phone = hub"}, {"UPDATE_CHECK", ""}}
	if len(got) != len(want) {
		t.Fatalf("parseSettings() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("parseSettings()[%d] = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestParseSettingsRefusesWhatIsNoSetting(t *testing.T) {
	for _, settings := range []string{"DATABASE_PATH", "database_path=x", "=x", "PATH WITH SPACE=x", " DEVICE_NAME=x"} {
		if _, err := parseSettings(settings); err == nil {
			t.Errorf("parseSettings(%q) error = nil, want one", settings)
		}
	}
}

func TestParseServers(t *testing.T) {
	if got, err := parseServers(" , "); err != nil || len(got) != 0 {
		t.Errorf("parseServers(empty) = %v, %v, want none", got, err)
	}
	if _, err := parseServers("192.168.1.1, dns.example"); err == nil || !strings.Contains(err.Error(), "dns.example") {
		t.Errorf("parseServers() with a name error = %v, want one naming it", err)
	}
	got, err := parseServers("192.168.1.1,fe80::1")
	if err != nil || strings.Join(got, " ") != "192.168.1.1:53 [fe80::1]:53" {
		t.Errorf("parseServers() = %v, %v, want both with port 53", got, err)
	}
}

func TestNewResolverAsksTheServersInOrder(t *testing.T) {
	// The first server refuses, so the resolver dials the second one, a
	// local TCP socket.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = listener.Close() }()
	refused, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	_ = refused.Close()
	var servers atomic.Pointer[[]string]
	servers.Store(&[]string{refused.Addr().String(), listener.Addr().String()})
	r := newResolver(&servers)
	if !r.PreferGo {
		t.Error("newResolver().PreferGo = false, want Go's resolver")
	}
	conn, err := r.Dial(context.Background(), "tcp", "ignored:53")
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	if got := conn.RemoteAddr().String(); got != listener.Addr().String() {
		t.Errorf("Dial() reached %s, want %s", got, listener.Addr())
	}
	_ = conn.Close()
}

func TestNewResolverAsksGosServerWhileNoneWasPassed(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = listener.Close() }()
	var servers atomic.Pointer[[]string]
	conn, err := newResolver(&servers).Dial(context.Background(), "tcp", listener.Addr().String())
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	if got := conn.RemoteAddr().String(); got != listener.Addr().String() {
		t.Errorf("Dial() reached %s, want %s, the server Go asked for", got, listener.Addr())
	}
	_ = conn.Close()
}

func TestParseAddresses(t *testing.T) {
	if got, err := parseAddresses(" , "); err != nil || got == nil || len(got) != 0 {
		t.Errorf("parseAddresses(empty) = %v, %v, want an empty list", got, err)
	}
	for _, wrong := range []string{"192.168.1.20", "192.168.1.20/33", "fe80::1%wlan0/64", "wlan0/24"} {
		if _, err := parseAddresses("192.168.1.20/24," + wrong); err == nil || !strings.Contains(err.Error(), wrong) {
			t.Errorf("parseAddresses() with %s error = %v, want one naming it", wrong, err)
		}
	}
	got, err := parseAddresses("192.168.1.20/24, 2001:db8:1:2::20/64")
	if err != nil || len(got) != 2 || got[0].String() != "192.168.1.20/24" || got[1].String() != "2001:db8:1:2::20/64" {
		t.Errorf("parseAddresses() = %v, %v, want both with their subnets", got, err)
	}
}

func TestSetNetworkTellsTheServersAndTheAddresses(t *testing.T) {
	before := dnsServers.Load()
	t.Cleanup(func() {
		dnsServers.Store(before)
		lan.SetAddresses(nil)
	})
	if err := SetNetwork("192.168.1.1", "192.168.1.20/24,2001:db8:1:2::20/64"); err != nil {
		t.Fatalf("SetNetwork() error = %v", err)
	}
	if got := *dnsServers.Load(); len(got) != 1 || got[0] != "192.168.1.1:53" {
		t.Errorf("the DNS servers = %v, want 192.168.1.1:53", got)
	}
	// No servers keeps the ones before, as while the network is away.
	if err := SetNetwork("", ""); err != nil {
		t.Fatalf("SetNetwork() without a network error = %v", err)
	}
	if got := *dnsServers.Load(); len(got) != 1 || got[0] != "192.168.1.1:53" {
		t.Errorf("the DNS servers = %v after none were passed, want the ones before", got)
	}
	// Wrong input changes nothing.
	if err := SetNetwork("192.168.1.2", "192.168.1.20"); err == nil {
		t.Error("SetNetwork() with an address without a subnet error = nil")
	}
	if got := *dnsServers.Load(); got[0] != "192.168.1.1:53" {
		t.Errorf("the DNS servers = %v after a refused call, want the ones before", got)
	}
}

func TestStartRefusesWrongInput(t *testing.T) {
	for _, tc := range []struct{ settings, timeZone, dns string }{
		{"not a setting", "", ""},
		{"", "Nowhere/Town", ""},
		{"", "", "dns.example"},
	} {
		if err := Start(tc.settings, tc.timeZone, tc.dns); err == nil {
			Stop()
			t.Errorf("Start(%q, %q, %q) error = nil, want one", tc.settings, tc.timeZone, tc.dns)
		}
	}
	if Running() {
		t.Error("Running() = true after only refused starts")
	}
}

// settingsFor returns settings that run den-watcher on a free local port with
// a database in a temporary folder, and that port's address. The test's own
// environment is restored afterwards.
func settingsFor(t *testing.T) (string, string) {
	t.Helper()
	free, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := free.Addr().String()
	_ = free.Close()
	values := map[string]string{
		"LISTEN_ADDR":   addr,
		"DATABASE_PATH": filepath.Join(t.TempDir(), "den-watcher.db"),
		"DISK_PATHS":    t.TempDir(),
		"UPDATE_CHECK":  "false",
	}
	var lines []string
	for name, value := range values {
		t.Setenv(name, os.Getenv(name))
		lines = append(lines, name+"="+value)
	}
	return strings.Join(lines, "\n"), addr
}

func TestStartRunsUntilStop(t *testing.T) {
	settings, addr := settingsFor(t)
	if err := Start(settings, "Europe/Berlin", ""); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if err := Start(settings, "", ""); err == nil {
		t.Error("a second Start() error = nil, want one while it runs")
	}
	if time.Local.String() != "Europe/Berlin" {
		t.Errorf("time.Local = %v, want Europe/Berlin", time.Local)
	}

	answered := false
	for range 100 {
		if response, err := http.Get("http://" + addr + "/api/metrics"); err == nil {
			_ = response.Body.Close()
			answered = true
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !answered {
		t.Errorf("den-watcher did not answer on %s; Failure() = %q", addr, Failure())
	}
	if !Running() {
		t.Error("Running() = false while it runs")
	}
	Stop()
	if Running() || Failure() != "" {
		t.Errorf("after Stop() Running() = %v, Failure() = %q, want false and empty", Running(), Failure())
	}
	Stop() // Stopping again does nothing.
}

func TestFailureTellsWhyItStopped(t *testing.T) {
	settings, addr := settingsFor(t)
	taken, err := net.Listen("tcp", addr)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = taken.Close() }()

	if err := Start(settings, "", ""); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	for range 100 {
		if !Running() {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	Stop()
	if Running() {
		t.Fatal("Running() = true with its port taken")
	}
	if !strings.Contains(Failure(), "address already in use") {
		t.Errorf("Failure() = %q, want the listen error", Failure())
	}

	// A setting left out at the next start goes back to its default. The
	// port is still taken, so this start stops on its own too.
	var without []string
	for line := range strings.Lines(settings) {
		if !strings.HasPrefix(line, "UPDATE_CHECK=") {
			without = append(without, strings.TrimSpace(line))
		}
	}
	if err := Start(strings.Join(without, "\n"), "", ""); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if got, ok := os.LookupEnv("UPDATE_CHECK"); ok {
		t.Errorf("UPDATE_CHECK = %q after a start without it, want it unset", got)
	}
	Stop()
}

func TestStartWaitsUntilTheStoppedOneReturned(t *testing.T) {
	settings, _ := settingsFor(t)
	// A den-watcher that was stopped but still writes its database.
	previous := make(chan struct{})
	mu.Lock()
	done = previous
	mu.Unlock()

	started := make(chan error, 1)
	go func() { started <- Start(settings, "", "") }()
	select {
	case err := <-started:
		t.Fatalf("Start() returned %v before the stopped one returned", err)
	case <-time.After(100 * time.Millisecond):
	}
	close(previous)
	if err := <-started; err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	if !Running() {
		t.Errorf("Running() = false after Start; Failure() = %q", Failure())
	}
	Stop()
}
