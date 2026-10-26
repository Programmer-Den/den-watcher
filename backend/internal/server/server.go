// Package server serves the metrics API and the website.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/events"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/lan"
	"github.com/Programmer-Den/den-watcher/backend/internal/layout"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/update"
)

// Device is a machine whose usage the site shows: the one it runs on and, in
// hub mode, the other devices it collects from.
type Device struct {
	// ID picks the device in the API, as ?device=<id>.
	ID string `json:"id"`
	// Name is how the page shows the device. It is empty for the machine the
	// site runs on when no name is set; the page then calls it "Host Hub".
	Name string `json:"name"`
	// Address is where another device is reachable, as host:port; empty for
	// the machine the site runs on and for a phone, which comes to the hub.
	Address string `json:"address,omitempty"`
	// Kind is what another device is used as, "server", "pc" or "phone";
	// empty for the machine the site runs on.
	Kind hub.Kind `json:"kind,omitempty"`
	// Removable is set for a device added on the page, which can be removed
	// there too.
	Removable bool `json:"removable"`
	// Unreachable is set for another device that has not answered recently.
	Unreachable bool `json:"unreachable,omitempty"`
	// UnreachableSince is when it stopped answering, when that is known.
	UnreachableSince *time.Time `json:"unreachableSince,omitempty"`
	// Refused is set for an unreachable device added on the page that the
	// hub does not connect to, as its address is the hub's own; it can be
	// collected from when listed in HUB_DEVICES instead.
	Refused bool `json:"refused,omitempty"`
	// Pairing is set for an unreachable device that does not answer the hub
	// until it is given the device's pairing code: "needed" while the hub
	// has none for it, "wrong" while the one it has is another.
	Pairing string `json:"pairing,omitempty"`
	// Router is set for a router, which the hub reads itself, as it runs
	// no den-watcher.
	Router bool `json:"router,omitempty"`
	// Checked is set for a thing the hub only checks for whether it
	// answers, such as a printer, as it runs no den-watcher.
	Checked bool `json:"checked,omitempty"`
	// Alerts are the values of the device that need attention now, most
	// serious first.
	Alerts  []alerts.Alert `json:"alerts,omitempty"`
	Metrics metrics.Source `json:"-"`
	History HistoryReader  `json:"-"`
	// Availability is set for the devices the hub collects from.
	Availability AvailabilityReader `json:"-"`
}

// AvailabilityReader tells how long a device did not answer the hub since it
// was added.
type AvailabilityReader interface {
	Availability(ctx context.Context) (hub.Availability, error)
	// OutagesBetween returns the times it did not answer from from to to.
	OutagesBetween(ctx context.Context, from, to time.Time) ([]hub.Outage, error)
}

// Devices lists the devices the site shows. The first is the machine the site
// runs on, which the API answers for when a request names no device.
type Devices interface {
	List() []Device
}

// Site is what the website shows and keeps.
type Site struct {
	Devices Devices
	// Hub adds and removes devices on the page, guarded by Password.
	Hub      Hub
	Password Password
	// Retention is how long the history is kept.
	Retention time.Duration
	// Files is the built website.
	Files fs.FS
	// Update tells the running version and whether a newer release exists;
	// nil leaves out GET /api/update.
	Update func() update.Status
	// PagePort is the port the page is reachable on from the network, from
	// PUBLIC_PORT or LISTEN_ADDR, which a phone's app is given with the
	// hub's address.
	PagePort string
	// AllowedHosts are names besides its own that this machine answers to,
	// from ALLOWED_HOSTS; see knownHosts.
	AllowedHosts []string
	// Minutes are this machine's own, for a hub that collects from it; nil
	// leaves out GET /api/minutes.
	Minutes MinuteSource
	// Alerts is the log of alerts; nil leaves out GET /api/alerts.
	Alerts AlertLog
	// Layout keeps how the page is arranged; nil leaves out GET and PUT
	// /api/layout.
	Layout LayoutStore
	// Prometheus adds GET /metrics, the usage of every device for
	// Prometheus, from PROMETHEUS.
	Prometheus bool
	// Backups makes copies of the database, which POST /api/backup sends
	// guarded by Password; nil leaves it out.
	Backups Backups
	// Events are the reboots and updates of each device; nil leaves out GET
	// /api/events, which also needs Alerts.
	Events EventLog
	// WiFi is what the devices' Wi-Fi saw nearby; nil leaves out GET
	// /api/wifi.
	WiFi WiFiSource
	// Pairing is the code a hub must be given to collect from this machine,
	// which GET /api/pairing shows; nil lets every hub collect and leaves
	// out GET /api/pairing.
	Pairing Pairing
	// StatusPage is the remote status page, from STATUS_ADDR; nil when it is
	// off, which GET /api/status-page then tells.
	StatusPage StatusPage
}

// LayoutStore keeps how the page is arranged, for every browser that opens it.
// A layout that is not valid is refused with a *layout.InputError.
type LayoutStore interface {
	Read(ctx context.Context) (layout.Layout, error)
	Write(ctx context.Context, l layout.Layout) error
}

// AlertLog tells the newest alerts of every device.
type AlertLog interface {
	Log(ctx context.Context) ([]alerts.Alert, error)
	// Between returns the alerts of a device that lasted at some time from
	// from to to.
	Between(ctx context.Context, device string, from, to time.Time) ([]alerts.Alert, error)
}

// EventLog tells the reboots and updates of a device.
type EventLog interface {
	Between(ctx context.Context, device string, from, to time.Time) ([]events.Event, error)
}

// New returns the handler for the whole site: the JSON API under /api/ and
// the website. Requests from outside the local network, and requests that
// address the machine by a name it does not know, are refused.
func New(site Site) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/devices", devicesHandler(site))
	mux.HandleFunc("GET /api/devices/metrics", fleetMetricsHandler(site.Devices))
	if site.Hub != nil && site.Password != nil {
		changes := &deviceChanges{hub: site.Hub, password: site.Password, backups: site.Backups}
		mux.HandleFunc("GET /api/devices/suggestion", changes.suggest)
		mux.HandleFunc("POST /api/devices", changes.add)
		mux.HandleFunc("DELETE /api/devices/{id}", changes.remove)
		mux.HandleFunc("PUT /api/devices/{id}/kind", changes.setKind)
		mux.HandleFunc("PUT /api/devices/{id}/pairing", changes.setCode)
		mux.HandleFunc("POST /api/phones", changes.addPhone)
		mux.HandleFunc("POST "+hub.PhoneMinutesPath, pushHandler(site.Hub))
		if site.Backups != nil {
			mux.HandleFunc("POST /api/backup", changes.backup)
		}
		if site.StatusPage != nil {
			mux.HandleFunc("POST /api/status-page/password", changes.setStatusPassword(site.StatusPage))
		}
	}
	mux.HandleFunc("GET /api/status-page", statusPageHandler(site.StatusPage))
	link := &hubLink{}
	mux.HandleFunc("GET /api/metrics", pairedOnly(site.Pairing, true, link.remember(forDevice(site.Devices, metricsHandler))))
	mux.HandleFunc("GET /api/hub", link.handler)
	if site.Pairing != nil {
		mux.HandleFunc("GET /api/pairing", pairingHandler(site.Pairing, false))
	}
	mux.HandleFunc("GET /api/history", forDevice(site.Devices, func(d Device) http.HandlerFunc {
		return historyHandler(d, site.Retention)
	}))
	mux.HandleFunc("GET /api/history.csv", forDevice(site.Devices, func(d Device) http.HandlerFunc {
		return historyCSVHandler(d, site.Retention)
	}))
	mux.HandleFunc("GET /api/availability", forDevice(site.Devices, availabilityHandler))
	if site.Minutes != nil {
		mux.HandleFunc("GET "+hub.MinutesPath, pairedOnly(site.Pairing, true, minutesHandler(site.Minutes)))
	}
	if site.Alerts != nil {
		mux.HandleFunc("GET /api/alerts", alertsHandler(site.Alerts))
	}
	if site.Events != nil && site.Alerts != nil {
		mux.HandleFunc("GET /api/events", forDevice(site.Devices, func(d Device) http.HandlerFunc {
			return eventsHandler(d, site.Alerts, site.Events, site.Retention)
		}))
	}
	if site.WiFi != nil {
		mux.HandleFunc("GET /api/wifi", wifiHandler(site.WiFi, site.Retention))
	}
	if site.Layout != nil {
		mux.HandleFunc("GET /api/layout", readLayout(site.Layout))
		mux.HandleFunc("PUT /api/layout", writeLayout(site.Layout))
	}
	if site.Update != nil {
		mux.HandleFunc("GET /api/update", func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, http.StatusOK, site.Update())
		})
	}
	if site.Prometheus {
		mux.HandleFunc("GET /metrics", prometheusHandler(site.Devices))
	}
	mux.Handle("GET /", websiteHandler(site.Files))
	return withHeaders(localNetworkOnly(knownHostsOnly(newKnownHosts(site.AllowedHosts), mux)))
}

// NewDataOnly returns the handler for a device that a hub collects from
// without a website of its own: only GET /api/metrics, with the usage of the
// machine it runs on, GET /api/minutes, with the minutes it kept for the hub
// (left out when minutes is nil), GET /api/hub, where that hub's page is, and
// GET /api/pairing, the code a hub must be given, on this machine only (left
// out when paired is nil, which lets every hub collect). Requests from
// outside the local network, and requests that address the machine by a name
// it does not know, are refused.
func NewDataOnly(collector metrics.Source, minutes MinuteSource, paired Pairing, allowedHosts []string) http.Handler {
	mux := http.NewServeMux()
	link := &hubLink{}
	mux.HandleFunc("GET /api/metrics", pairedOnly(paired, false, link.remember(metricsHandler(Device{ID: hub.LocalID, Metrics: collector}))))
	if minutes != nil {
		mux.HandleFunc("GET "+hub.MinutesPath, pairedOnly(paired, false, minutesHandler(minutes)))
	}
	mux.HandleFunc("GET /api/hub", link.handler)
	if paired != nil {
		mux.HandleFunc("GET /api/pairing", pairingHandler(paired, true))
	}
	return withHeaders(localNetworkOnly(knownHostsOnly(newKnownHosts(allowedHosts), mux)))
}

// devicesResponse is the body of GET /api/devices.
type devicesResponse struct {
	Devices []Device `json:"devices"`
	// PasswordSet tells whether adding or removing a device asks for the
	// password, or chooses it.
	PasswordSet bool `json:"passwordSet"`
	// PagePort is the port the page is reachable on from the network, which
	// can differ from the one the browser shows, as behind a proxy.
	PagePort string `json:"pagePort,omitempty"`
}

// devicesHandler serves GET /api/devices: the devices the site shows.
func devicesHandler(site Site) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		response := devicesResponse{Devices: site.Devices.List(), PagePort: site.PagePort}
		if site.Password != nil {
			set, err := site.Password.IsSet(r.Context())
			if err != nil {
				slog.Error("read whether the password is set", "error", err)
				http.Error(w, "could not read the settings", http.StatusInternalServerError)
				return
			}
			response.PasswordSet = set
		}
		writeJSON(w, http.StatusOK, response)
	}
}

// fleetTimeout is how long GET /api/devices/metrics waits for one device; a
// variable for the tests.
var fleetTimeout = 3 * time.Second

// fleetMetricsHandler serves GET /api/devices/metrics: the usage of every
// device that answers, by its id, read side by side, for the list of devices
// and the comparison in one request. A device whose usage cannot be read
// within fleetTimeout is left out, so it holds back none of the others.
func fleetMetricsHandler(devices Devices) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, readAll(r.Context(), devices.List()))
	}
}

// readAll reads the usage of every device in list that answers, side by side,
// by its id. A device that is unreachable, or whose usage cannot be read
// within fleetTimeout, is left out.
func readAll(ctx context.Context, list []Device) map[string]metrics.Snapshot {
	ctx, cancel := context.WithTimeout(ctx, fleetTimeout)
	defer cancel()
	var (
		mu    sync.Mutex
		wait  sync.WaitGroup
		usage = map[string]metrics.Snapshot{}
	)
	for _, d := range list {
		if d.Unreachable || d.Metrics == nil {
			continue
		}
		wait.Go(func() {
			snapshot, err := d.Metrics.Collect(ctx)
			if err != nil {
				return
			}
			mu.Lock()
			usage[d.ID] = snapshot
			mu.Unlock()
		})
	}
	wait.Wait()
	return usage
}

// forDevice passes a request on to the handler for the device in its
// ?device= parameter, or for the first device when there is none.
func forDevice(devices Devices, handler func(Device) http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		list := devices.List()
		id := r.URL.Query().Get("device")
		if id == "" && len(list) > 0 {
			id = list[0].ID
		}
		for _, d := range list {
			if d.ID == id {
				handler(d)(w, r)
				return
			}
		}
		http.Error(w, "there is no device with this id; GET /api/devices lists them", http.StatusNotFound)
	}
}

// writeJSON answers with body as JSON.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("write response", "error", err)
	}
}

func metricsHandler(d Device) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		snapshot, err := d.Metrics.Collect(r.Context())
		if errors.Is(err, hub.ErrUnreachable) {
			http.Error(w, "the device has not answered recently", http.StatusServiceUnavailable)
			return
		}
		if err != nil && r.Context().Err() != nil {
			// The page or the hub gave up on the request, such as while
			// waiting for a reading of a disk that does not answer; nobody
			// reads the answer.
			return
		}
		if err != nil {
			slog.Error("collect metrics", "device", d.ID, "error", err)
			http.Error(w, "could not read the machine's usage", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, snapshot)
	}
}

// availabilityHandler serves GET /api/availability: how long another device
// did not answer since the hub started collecting from it.
func availabilityHandler(d Device) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if d.Availability == nil {
			http.Error(w, "availability is only kept for the other devices the hub collects from", http.StatusNotFound)
			return
		}
		availability, err := d.Availability.Availability(r.Context())
		if err != nil {
			slog.Error("read availability", "device", d.ID, "error", err)
			http.Error(w, "could not read the availability", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, availability)
	}
}

// alertsHandler serves GET /api/alerts: the newest alerts of every device,
// the ones that last and the ones that ended, newest first.
func alertsHandler(log AlertLog) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		list, err := log.Log(r.Context())
		if err != nil {
			slog.Error("read the alerts", "error", err)
			http.Error(w, "could not read the alerts", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, list)
	}
}

// hashedName matches the files the frontend build names after their content,
// such as main-7EIQR62F.js: a change in content changes the name, so browsers
// may keep them for good.
var hashedName = regexp.MustCompile(`^[a-z0-9]+-[A-Z0-9]{8}\.(js|css)$`)

// websiteHandler serves the website. It is in every language at once and
// switches between them in the browser. Only files are served, no directory
// listings, and each answer says how long a browser may keep it: the hashed
// scripts and styles a year, index.html not at all, so a new build shows at
// once, and the rest, such as the flags and the mascot, an hour. The web app
// manifest is named by its type, which Go's own list of types lacks and the
// system's may lack too, as in the Docker image.
func websiteHandler(site fs.FS) http.Handler {
	if _, err := fs.Stat(site, "index.html"); err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "The website is not built. Run `npm run build` in frontend/ and build the backend again.", http.StatusNotFound)
		})
	}
	files := http.FileServerFS(site)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		info, err := fs.Stat(site, name)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		switch {
		case hashedName.MatchString(path.Base(name)):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case name == "index.html":
			w.Header().Set("Cache-Control", "no-cache")
		default:
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		if path.Ext(name) == ".webmanifest" {
			w.Header().Set("Content-Type", "application/manifest+json")
		}
		files.ServeHTTP(w, r)
	})
}

// withHeaders adds the headers every answer carries: browsers are told to
// trust the Content-Type instead of guessing one from the content, and not to
// show the page inside another site's frame, where it could be overlaid to
// trick a visitor into clicking (frame-ancestors, and X-Frame-Options for
// older browsers).
func withHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

// localNetworkOnly refuses requests whose sender is not on the local network,
// as the lan package defines it. It reads the address of the TCP connection,
// not a header a client could fake.
func localNetworkOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !lan.Default.LocalAddrPort(r.RemoteAddr) {
			http.Error(w, "only reachable from the local network", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
