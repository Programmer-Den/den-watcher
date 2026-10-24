package hub

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

// startPairedDevice starts a device that answers a hub only with code, as
// the device's own server does (see server.pairedOnly); up, when given, is
// whether it answers at all.
func startPairedDevice(t *testing.T, code string, up *atomic.Bool) string {
	t.Helper()
	device := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if up != nil && !up.Load() {
			http.Error(w, "down", http.StatusServiceUnavailable)
			return
		}
		if r.Header.Get(HubIDHeader) != "" {
			switch given := r.Header.Get(pairing.CodeHeader); {
			case given == "":
				w.Header().Set(pairing.ProblemHeader, "needed")
				http.Error(w, "needed", http.StatusForbidden)
				return
			case given != code:
				w.Header().Set(pairing.ProblemHeader, "wrong")
				http.Error(w, "wrong", http.StatusForbidden)
				return
			}
		}
		_, _ = w.Write([]byte(`{"cpu":{"usagePercent":12.5,"cores":4}}`))
	}))
	t.Cleanup(device.Close)
	return strings.TrimPrefix(device.URL, "http://")
}

func TestAddingADeviceAsksForItsPairingCode(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	address := startPairedDevice(t, "7KQMX2RP", nil)

	if _, err := h.Add(ctx, "Laptop", address, KindPC, ""); problemOf(err) != ProblemPairingNeeded {
		t.Fatalf("Add() without the code = %v, want %s", err, ProblemPairingNeeded)
	}
	if _, err := h.Add(ctx, "Laptop", address, KindPC, "7KQM-X2RQ"); problemOf(err) != ProblemPairingWrong {
		t.Fatalf("Add() with another code = %v, want %s", err, ProblemPairingWrong)
	}
	if _, err := h.Add(ctx, "Laptop", address, KindPC, "no code!"); problemOf(err) != ProblemPairingWrong {
		t.Fatalf("Add() with what is no code = %v, want %s", err, ProblemPairingWrong)
	}
	// Written as it may be typed.
	if _, err := h.Add(ctx, "Laptop", address, KindPC, " 7kqm-x2rp "); err != nil {
		t.Fatalf("Add() with the code = %v", err)
	}
	if code, err := readCode(ctx, store.DB(), "laptop"); err != nil || code != "7KQMX2RP" {
		t.Fatalf("stored code = %q, %v; want 7KQMX2RP", code, err)
	}
	// The recorder sends it with every reading, after a restart too.
	again := openTestHub(t, store, nil)
	remote := again.Remotes()[0]
	if _, err := remote.watched.Collect(ctx); err != nil {
		t.Fatalf("Collect() after a restart = %v, want the code sent", err)
	}
}

func TestADeviceWithoutPairingTakesNoCode(t *testing.T) {
	h := openTestHub(t, openTestStore(t), nil)
	if _, err := h.Add(context.Background(), "Laptop", startDevice(t), KindPC, ""); err != nil {
		t.Fatalf("Add() of a device on a version without pairing = %v", err)
	}
}

func TestWithoutThePairingCodeOnlyTheAvailabilityIsKept(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	openTestHub(t, store, nil)
	var up atomic.Bool
	up.Store(true)
	agent := NewAgent(startPairedDevice(t, "7KQMX2RP", &up))
	agent.hubID = "0123456789abcdef0123456789abcdef"
	now := time.Now()
	watched := &watchedAgent{agent: agent, db: store.DB(), device: "nas", clock: func() time.Time { return now }}
	remote := &Remote{Agent: agent, watched: watched}
	collect := func() {
		t.Helper()
		now = now.Add(5 * time.Second)
		_, _ = watched.Collect(ctx)
	}

	for range 3 {
		collect()
	}
	if got := remote.Pairing(); got != "needed" {
		t.Fatalf("Pairing() = %q, want needed", got)
	}
	if since, unreachable := remote.Unreachable(); !unreachable || !since.IsZero() {
		t.Fatalf("Unreachable() = %v, %v; want no usage, and no outage", since, unreachable)
	}
	if _, _, ok := watched.ongoing(); ok {
		t.Fatal("an outage while the device answers without the code, want it counted as answering")
	}

	// A device that is down is an outage, whether or not it has the code.
	up.Store(false)
	collect()
	collect()
	if _, _, ok := watched.ongoing(); !ok {
		t.Fatal("no outage while the device is down, want one")
	}
	if got := remote.Pairing(); got != "" {
		t.Fatalf("Pairing() while down = %q, want none", got)
	}
	up.Store(true)
	collect()
	if _, _, ok := watched.ongoing(); ok {
		t.Fatal("the outage lasts once the device answers without the code, want it ended")
	}

	// With the code, the device gives its usage.
	agent.setPairingCode("7KQMX2RP")
	if _, err := watched.Collect(ctx); err != nil {
		t.Fatalf("Collect() with the code = %v", err)
	}
	if got := remote.Pairing(); got != "" {
		t.Fatalf("Pairing() once paired = %q, want none", got)
	}
}

func TestSetCodeChecksTheCodeWithTheDevice(t *testing.T) {
	ctx := context.Background()
	fixed, err := ParseDevices("NAS=" + startPairedDevice(t, "7KQMX2RP", nil))
	if err != nil {
		t.Fatal(err)
	}
	store := openTestStore(t)
	h := openTestHub(t, store, fixed)
	if err := h.SetCode(ctx, "nas", "7KQM-X2RQ"); problemOf(err) != ProblemPairingWrong {
		t.Fatalf("SetCode() with another code = %v, want %s", err, ProblemPairingWrong)
	}
	if err := h.SetCode(ctx, "nas", "7KQM-X2RP"); err != nil {
		t.Fatalf("SetCode() = %v", err)
	}
	if code, err := readCode(ctx, store.DB(), "nas"); err != nil || code != "7KQMX2RP" {
		t.Fatalf("stored code = %q, %v; want 7KQMX2RP", code, err)
	}
	if got := h.Remotes()[0].Agent.pairingCode(); got != "7KQMX2RP" {
		t.Fatalf("code sent = %q, want 7KQMX2RP", got)
	}
	if err := h.SetCode(ctx, "tv", "7KQM-X2RP"); problemOf(err) != ProblemNotFound {
		t.Fatalf("SetCode() of an unknown device = %v, want %s", err, ProblemNotFound)
	}
}

func TestARouterHasNoPairingCode(t *testing.T) {
	router, err := NewRouter("Router", "192.168.1.1", &countingUsage{})
	if err != nil {
		t.Fatal(err)
	}
	h := openTestHub(t, openTestStore(t), []Device{router})
	if err := h.SetCode(context.Background(), router.ID, "7KQM-X2RP"); problemOf(err) != ProblemPairingNone {
		t.Fatalf("SetCode() of a router = %v, want %s", err, ProblemPairingNone)
	}
}
