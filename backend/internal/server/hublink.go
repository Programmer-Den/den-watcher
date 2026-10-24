package server

import (
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
)

// hubLinkTakeover is how long the remembered hub must not have asked before
// a hub with another id replaces it. The hub asks every 5 seconds, so another
// program on the network that sends a made-up id cannot take the link over
// from a hub that is running, while a hub that replaced it still does.
const hubLinkTakeover = 10 * time.Minute

// hubLink remembers where the page of the hub that collects from this machine
// is: the address its requests come from, with the port it sends in the
// hub.PagePortHeader header. Only requests with a hub id count, and the hub
// keeps the link by its id when its address changes. The tray icon on
// Windows asks for it, to open the hub's page.
type hubLink struct {
	// now returns the time; nil means time.Now.
	now func() time.Time

	mu    sync.Mutex
	url   string
	id    string
	asked time.Time
}

// remember notes the hub's page from a request that carries the headers, then
// passes the request on.
func (l *hubLink) remember(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if url, ok := hubURL(r); ok {
			if id := hubAsking(r); id != "" {
				l.note(id, url)
			}
		}
		next(w, r)
	}
}

// note remembers url as the page of the hub with this id, unless another hub
// asked less than hubLinkTakeover ago.
func (l *hubLink) note(id, url string) {
	now := time.Now
	if l.now != nil {
		now = l.now
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if id != l.id && l.id != "" && now().Sub(l.asked) < hubLinkTakeover {
		return
	}
	l.url, l.id, l.asked = url, id, now()
}

// hubURL builds the hub's page address from a request, if it is from a hub.
func hubURL(r *http.Request) (string, bool) {
	value := r.Header.Get(hub.PagePortHeader)
	if value == "" {
		return "", false
	}
	port, err := strconv.Atoi(value)
	if err != nil || port < 1 || port > 65535 {
		return "", false
	}
	sender, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return "", false
	}
	host := sender.Addr().Unmap().WithZone("").String()
	return "http://" + net.JoinHostPort(host, strconv.Itoa(port)) + "/", true
}

// hubLinkResponse is the body of GET /api/hub.
type hubLinkResponse struct {
	// URL is the hub's page, or empty when no hub has asked yet.
	URL string `json:"url"`
}

// handler serves GET /api/hub, only to programs on this machine: the tray
// icon, not the network.
func (l *hubLink) handler(w http.ResponseWriter, r *http.Request) {
	sender, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil || !sender.Addr().IsLoopback() {
		http.Error(w, "only answered on this machine", http.StatusForbidden)
		return
	}
	l.mu.Lock()
	response := hubLinkResponse{URL: l.url}
	l.mu.Unlock()
	writeJSON(w, http.StatusOK, response)
}
