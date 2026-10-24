package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
)

// otherHubID is the id of a second hub, besides testHubID.
const otherHubID = "fedcba9876543210fedcba9876543210"

// askAsHub asks for the metrics like a hub does, from remoteAddr, telling
// the port of its page.
func askAsHub(handler http.Handler, remoteAddr, port string) {
	askAs(handler, remoteAddr, port, testHubID)
}

// askAs asks like askAsHub, with this hub id; empty sends none.
func askAs(handler http.Handler, remoteAddr, port, id string) {
	req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
	req.RemoteAddr = remoteAddr
	req.Host = "192.168.1.9:9393"
	req.Header.Set(hub.PagePortHeader, port)
	if id != "" {
		req.Header.Set(hub.HubIDHeader, id)
	}
	handler.ServeHTTP(httptest.NewRecorder(), req)
}

func hubLinkOf(t *testing.T, handler http.Handler) string {
	t.Helper()
	rec := get(handler, "/api/hub", "127.0.0.1:5000")
	var got hubLinkResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("GET /api/hub = %d, %v, want 200 with the link", rec.Code, err)
	}
	return got.URL
}

func TestRemembersTheHubsPage(t *testing.T) {
	for name, handler := range map[string]http.Handler{
		"data only": NewDataOnly(fakeCollector{}, nil, nil, nil),
		"website":   newHandler(device(fakeCollector{}, nil), 0, site),
	} {
		t.Run(name, func(t *testing.T) {
			if got := hubLinkOf(t, handler); got != "" {
				t.Errorf("before a hub asked: link = %q, want none", got)
			}

			askAsHub(handler, "192.168.1.20:5000", "8090")
			if got, want := hubLinkOf(t, handler), "http://192.168.1.20:8090/"; got != want {
				t.Errorf("link = %q, want %q", got, want)
			}

			askAsHub(handler, "[fd00::20]:5000", "9393")
			if got, want := hubLinkOf(t, handler), "http://[fd00::20]:9393/"; got != want {
				t.Errorf("link = %q, want %q", got, want)
			}
		})
	}
}

func TestIgnoresInvalidHubPorts(t *testing.T) {
	handler := NewDataOnly(fakeCollector{}, nil, nil, nil)
	askAsHub(handler, "192.168.1.20:5000", "8090")

	for _, port := range []string{"0", "65536", "-1", "80/evil", "port"} {
		askAsHub(handler, "192.168.1.30:5000", port)
	}
	if got, want := hubLinkOf(t, handler), "http://192.168.1.20:8090/"; got != want {
		t.Errorf("link = %q, want %q kept", got, want)
	}
}

func TestIgnoresRequestsWithoutAValidHubID(t *testing.T) {
	handler := NewDataOnly(fakeCollector{}, nil, nil, nil)
	for _, id := range []string{"", "not-an-id", "0123456789ABCDEF0123456789ABCDEF"} {
		askAs(handler, "192.168.1.30:5000", "8090", id)
	}
	if got := hubLinkOf(t, handler); got != "" {
		t.Errorf("link = %q, want none", got)
	}
}

func TestKeepsTheHubAnotherIDAsksAfter(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	link := &hubLink{now: func() time.Time { return now }}
	ask := func(remoteAddr, port, id string) {
		req := httptest.NewRequest(http.MethodGet, "/api/metrics", nil)
		req.RemoteAddr = remoteAddr
		req.Header.Set(hub.PagePortHeader, port)
		req.Header.Set(hub.HubIDHeader, id)
		link.remember(func(http.ResponseWriter, *http.Request) {})(httptest.NewRecorder(), req)
	}
	want := func(step, url string) {
		t.Helper()
		link.mu.Lock()
		defer link.mu.Unlock()
		if link.url != url {
			t.Errorf("%s: link = %q, want %q", step, link.url, url)
		}
	}

	ask("192.168.1.20:5000", "8090", testHubID)
	ask("192.168.1.30:5000", "9393", otherHubID)
	want("another id while the hub asks", "http://192.168.1.20:8090/")

	now = now.Add(time.Minute)
	ask("192.168.1.21:5000", "8090", testHubID)
	want("the hub from a new address", "http://192.168.1.21:8090/")

	now = now.Add(hubLinkTakeover - time.Second)
	ask("192.168.1.30:5000", "9393", otherHubID)
	want("another id just before the hub is silent long enough", "http://192.168.1.21:8090/")

	now = now.Add(time.Second)
	ask("192.168.1.30:5000", "9393", otherHubID)
	want("another id once the hub stopped asking", "http://192.168.1.30:9393/")
}

func TestHubLinkOnlyForThisMachine(t *testing.T) {
	handler := NewDataOnly(fakeCollector{}, nil, nil, nil)

	if rec := get(handler, "/api/hub", "192.168.1.20:5000"); rec.Code != http.StatusForbidden {
		t.Errorf("GET /api/hub from the network = %d, want %d", rec.Code, http.StatusForbidden)
	}
	if rec := get(handler, "/api/hub", "[::1]:5000"); rec.Code != http.StatusOK {
		t.Errorf("GET /api/hub from ::1 = %d, want %d", rec.Code, http.StatusOK)
	}
}
