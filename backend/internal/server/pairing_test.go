package server

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

// fakePairing pairs the hubs in paired, and every hub that sends code.
type fakePairing struct {
	code   string
	paired map[string]bool
}

func (f *fakePairing) Allow(_ context.Context, id, code string) pairing.Answer {
	switch {
	case f.paired[id]:
		return pairing.Paired
	case code == f.code:
		f.paired[id] = true
		return pairing.Paired
	case code == "":
		return pairing.Needed
	}
	return pairing.Wrong
}

func (f *fakePairing) Code() string {
	return f.code
}

func getWithCode(handler http.Handler, path, code string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = "192.168.1.20:5000"
	req.Host = "192.168.1.9:9393"
	req.Header.Set(hub.HubIDHeader, testHubID)
	if code != "" {
		req.Header.Set(pairing.CodeHeader, code)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestAHubCollectsOnlyOnceItGaveThePairingCode(t *testing.T) {
	delay := wrongCodeDelay
	wrongCodeDelay = 0
	t.Cleanup(func() { wrongCodeDelay = delay })
	source := &fakeMinutes{minutes: []history.Minute{}}
	for name, handler := range map[string]func(Pairing) http.Handler{
		"data only": func(p Pairing) http.Handler { return NewDataOnly(fakeCollector{}, source, p, nil) },
		"website": func(p Pairing) http.Handler {
			return New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site, Minutes: source, Pairing: p})
		},
	} {
		h := handler(&fakePairing{code: "7KQM-X2RP", paired: map[string]bool{}})
		for _, path := range []string{"/api/metrics", "/api/minutes?after=0"} {
			rec := getWithCode(h, path, "")
			if rec.Code != http.StatusForbidden || rec.Header().Get(pairing.ProblemHeader) != "needed" {
				t.Errorf("%s: %s without a code = %d, %q; want 403, needed", name, path, rec.Code, rec.Header().Get(pairing.ProblemHeader))
			}
			rec = getWithCode(h, path, "AAAA-AAAA")
			if rec.Code != http.StatusForbidden || rec.Header().Get(pairing.ProblemHeader) != "wrong" {
				t.Errorf("%s: %s with a wrong code = %d, %q; want 403, wrong", name, path, rec.Code, rec.Header().Get(pairing.ProblemHeader))
			}
			// A request that is not from a hub passes where the page reads
			// the same usage. Without a website, only one from the machine
			// itself does, so leaving out the hub id does not get around
			// the code.
			want := http.StatusOK
			if name == "data only" {
				want = http.StatusForbidden
			}
			if rec := get(h, path, "192.168.1.20:5000"); rec.Code != want {
				t.Errorf("%s: %s without a hub id = %d, want %d", name, path, rec.Code, want)
			}
			if rec := get(h, path, "127.0.0.1:5000"); rec.Code != http.StatusOK {
				t.Errorf("%s: %s without a hub id from the machine itself = %d, want 200", name, path, rec.Code)
			}
		}
		if rec := getWithCode(h, "/api/metrics", "7KQM-X2RP"); rec.Code != http.StatusOK {
			t.Errorf("%s: with the code = %d, want 200", name, rec.Code)
		}
		// Paired from now on, without sending the code again.
		if rec := getWithCode(h, "/api/minutes?after=0", ""); rec.Code != http.StatusOK {
			t.Errorf("%s: once paired = %d, want 200", name, rec.Code)
		}
	}
}

func TestEveryHubCollectsWithoutPairing(t *testing.T) {
	handler := NewDataOnly(fakeCollector{}, nil, nil, nil)
	if rec := getWithCode(handler, "/api/metrics", ""); rec.Code != http.StatusOK {
		t.Errorf("GET /api/metrics from a hub without pairing = %d, want 200", rec.Code)
	}
	if rec := get(handler, "/api/pairing", "127.0.0.1:5000"); rec.Code != http.StatusNotFound {
		t.Errorf("GET /api/pairing without pairing = %d, want 404", rec.Code)
	}
}

func TestPairingCodeIsShown(t *testing.T) {
	p := &fakePairing{code: "7KQM-X2RP", paired: map[string]bool{}}
	tests := []struct {
		name    string
		handler http.Handler
		from    string
		want    int
	}{
		{"website, from the network", New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site, Pairing: p}), "192.168.1.20:5000", http.StatusOK},
		{"data only, on the machine", NewDataOnly(fakeCollector{}, nil, p, nil), "127.0.0.1:5000", http.StatusOK},
		{"data only, from the network", NewDataOnly(fakeCollector{}, nil, p, nil), "192.168.1.20:5000", http.StatusForbidden},
	}
	for _, tt := range tests {
		rec := get(tt.handler, "/api/pairing", tt.from)
		if rec.Code != tt.want {
			t.Errorf("%s: GET /api/pairing = %d, want %d", tt.name, rec.Code, tt.want)
			continue
		}
		var body pairingResponse
		if tt.want == http.StatusOK && (json.NewDecoder(rec.Body).Decode(&body) != nil || body.Code != "7KQM-X2RP") {
			t.Errorf("%s: GET /api/pairing = %+v, want the code", tt.name, body)
		}
	}
}

func TestPairingCodeIsShownAtTheAddressListenedOn(t *testing.T) {
	p := &fakePairing{code: "7KQM-X2RP", paired: map[string]bool{}}
	handler := NewDataOnly(fakeCollector{}, nil, p, nil)
	local := &net.TCPAddr{IP: net.ParseIP("192.168.1.9"), Port: 9393}
	for from, want := range map[string]int{"192.168.1.9:5000": http.StatusOK, "192.168.1.20:5000": http.StatusForbidden} {
		req := httptest.NewRequest(http.MethodGet, "/api/pairing", nil)
		req.RemoteAddr = from
		req.Host = "192.168.1.9:9393"
		req = req.WithContext(context.WithValue(req.Context(), http.LocalAddrContextKey, net.Addr(local)))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Errorf("GET /api/pairing from %s to %s = %d, want %d", from, local, rec.Code, want)
		}
	}
}

func TestAHubIDThatIsNoHubIDGetsNoUsageWithoutTheCode(t *testing.T) {
	handler := NewDataOnly(fakeCollector{}, nil, &fakePairing{code: "7KQM-X2RP", paired: map[string]bool{}}, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	req.RemoteAddr = "192.168.1.20:5000"
	req.Host = "192.168.1.9:9393"
	req.Header.Set(hub.HubIDHeader, "not-a-hub-id")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden || rec.Header().Get(pairing.ProblemHeader) != "needed" {
		t.Errorf("GET /api/metrics with a hub id that is none = %d, %q; want 403, needed", rec.Code, rec.Header().Get(pairing.ProblemHeader))
	}
}

func TestARequestWithoutAHubIDIsNotPairedByTheCode(t *testing.T) {
	p := &fakePairing{code: "7KQM-X2RP", paired: map[string]bool{}}
	handler := NewDataOnly(fakeCollector{}, nil, p, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	req.RemoteAddr = "192.168.1.20:5000"
	req.Host = "192.168.1.9:9393"
	req.Header.Set(pairing.CodeHeader, "7KQM-X2RP")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden || rec.Header().Get(pairing.ProblemHeader) != "needed" {
		t.Errorf("GET /api/metrics with the code but without a hub id = %d, %q; want 403, needed", rec.Code, rec.Header().Get(pairing.ProblemHeader))
	}
	if len(p.paired) != 0 {
		t.Errorf("paired after a request without a hub id = %v, want none", p.paired)
	}
}
