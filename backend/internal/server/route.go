package server

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/changelog"
	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
)

// RouteSource reads where a phone was.
type RouteSource interface {
	RoutePoints(ctx context.Context, device string, from, to time.Time) ([]history.PhonePoint, error)
}

// routeResponse is the body of GET /api/phone/route. Times are Unix seconds.
type routeResponse struct {
	From   int64                `json:"from"`
	To     int64                `json:"to"`
	Points []history.PhonePoint `json:"points"`
}

// routeHandler serves GET /api/phone/route?device=<id>&from=<unix
// seconds>&to=<unix seconds>: where the phone was in that range, oldest
// first, which its app sends when its user allowed it the location route.
// The range is limited to the phones' retention period and ends now at the latest.
// Any other device has none.
func routeHandler(d Device, source RouteSource, retention time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, fromErr := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64)
		to, toErr := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64)
		if fromErr != nil || toErr != nil || from >= to {
			http.Error(w, "from and to must be Unix times in seconds, with from before to", http.StatusBadRequest)
			return
		}
		if d.Kind != hub.KindPhone {
			http.Error(w, "only a phone's app tells where it was", http.StatusNotFound)
			return
		}
		now := time.Now()
		from = min(max(from, keptSince(now, retention)), now.Unix())
		to = min(max(to, from+1), now.Unix()+1)
		points, err := source.RoutePoints(r.Context(), d.ID, time.Unix(from, 0), time.Unix(to, 0))
		if err != nil {
			slog.Error("read where a phone was", "device", d.ID, "error", err)
			http.Error(w, "could not read where the phone was", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, routeResponse{From: from, To: to, Points: points})
	}
}

// PhoneScanSource reads which Wi-Fi networks a phone found at one time.
type PhoneScanSource interface {
	PhoneScanNear(ctx context.Context, device string, at time.Time, within time.Duration) (*history.PhoneScan, error)
}

// phoneScanWithin is how far before or after a point of the route a scan may
// be to count as made there: the app scans and asks for a position every 5
// minutes, so the scan of a point is at most a few minutes from it.
const phoneScanWithin = 5 * time.Minute

// phoneScanResponse is the body of GET /api/phone/scan; Scan is null when
// the phone made none near the time.
type phoneScanResponse struct {
	Time int64              `json:"time"`
	Scan *history.PhoneScan `json:"scan"`
}

// phoneScanHandler serves GET /api/phone/scan?device=<id>&time=<unix
// seconds>: the Wi-Fi networks the phone's scan closest to that time found,
// within phoneScanWithin, as for a point of its route. Any other device has
// none.
func phoneScanHandler(d Device, source PhoneScanSource) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		at, err := strconv.ParseInt(r.URL.Query().Get("time"), 10, 64)
		if err != nil || at < 0 {
			http.Error(w, "time must be a Unix time in seconds", http.StatusBadRequest)
			return
		}
		if d.Kind != hub.KindPhone {
			http.Error(w, "only a phone's app sends its scans", http.StatusNotFound)
			return
		}
		scan, err := source.PhoneScanNear(r.Context(), d.ID, time.Unix(at, 0), phoneScanWithin)
		if err != nil {
			slog.Error("read a phone's scan", "device", d.ID, "error", err)
			http.Error(w, "could not read the phone's scan", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, phoneScanResponse{Time: at, Scan: scan})
	}
}

// PositionSource reads the places the phones scanned the Wi-Fi networks at,
// and keeps what the user tells of them.
type PositionSource interface {
	WiFiPositions(ctx context.Context, from, to time.Time) ([]history.WiFiPosition, error)
	RenamePositionPlace(ctx context.Context, id int64, name string) error
	MergePositionPlace(ctx context.Context, id, into int64) error
	SplitPositionPlace(ctx context.Context, id int64) error
	KeepPositionPlacesApart(ctx context.Context, a, b int64) error
	TownWiFi(ctx context.Context, from, to time.Time) (history.TownWiFi, error)
}

// positionsResponse is the body of GET /api/wifi/positions. Times are Unix
// seconds.
type positionsResponse struct {
	From   int64                  `json:"from"`
	To     int64                  `json:"to"`
	Places []history.WiFiPosition `json:"places"`
}

// positionsHandler serves GET /api/wifi/positions?from=<unix seconds>&to=<unix
// seconds>: the places the phones scanned the Wi-Fi networks at in that
// range, by where their routes were, each with every network heard there by
// any of them. The range is limited to the phones' retention period and ends now at
// the latest.
func positionsHandler(source PositionSource, retention time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, to, ok := scanRange(w, r, retention)
		if !ok {
			return
		}
		places, err := source.WiFiPositions(r.Context(), time.Unix(from, 0), time.Unix(to, 0))
		if err != nil {
			slog.Error("read the places of the phones' scans", "error", err)
			http.Error(w, "could not read the places of the phones' scans", http.StatusInternalServerError)
			return
		}
		if places == nil {
			places = []history.WiFiPosition{}
		}
		writeJSON(w, http.StatusOK, positionsResponse{From: from, To: to, Places: places})
	}
}

// townResponse is the body of GET /api/wifi/town. Times are Unix seconds.
type townResponse struct {
	From int64 `json:"from"`
	To   int64 `json:"to"`
	history.TownWiFi
}

// townHandler serves GET /api/wifi/town?from=<unix seconds>&to=<unix
// seconds>: where the hub learned the access points around town are from the
// phones' scans with a GPS position, and the phones' ways in that range
// placed by those access points alone. The range is limited as for
// positionsHandler.
func townHandler(source PositionSource, retention time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, to, ok := scanRange(w, r, retention)
		if !ok {
			return
		}
		town, err := source.TownWiFi(r.Context(), time.Unix(from, 0), time.Unix(to, 0))
		if err != nil {
			slog.Error("place the phones by the Wi-Fi around town", "error", err)
			http.Error(w, "could not place the phones by the Wi-Fi around town", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, townResponse{From: from, To: to, TownWiFi: town})
	}
}

// scanRange reads the range of a request for the phones' scans, limited to
// the retention period and ending now at the latest, in Unix seconds. It
// answers a request without one and returns false.
func scanRange(w http.ResponseWriter, r *http.Request, retention time.Duration) (from, to int64, ok bool) {
	from, fromErr := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64)
	to, toErr := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64)
	if fromErr != nil || toErr != nil || from >= to {
		http.Error(w, "from and to must be Unix times in seconds, with from before to", http.StatusBadRequest)
		return 0, 0, false
	}
	now := time.Now()
	kept := keptSince(now, retention)
	from = min(max(from, kept), now.Unix())
	to = min(max(to, from+1), now.Unix()+1)
	return from, to, true
}

// keptSince returns the Unix time of the oldest data a retention keeps at
// now; a retention of zero keeps everything, as the phones' routes and Wi-Fi
// by default.
func keptSince(now time.Time, retention time.Duration) int64 {
	if retention <= 0 {
		return 0
	}
	return now.Add(-retention).Unix()
}

// RouteDeleter deletes where a phone was in a stretch of time.
type RouteDeleter interface {
	DeleteRoute(ctx context.Context, device string, from, to time.Time) (int64, error)
}

// deleteRouteRequest is the body of DELETE /api/phones/{id}/route; times are
// Unix seconds.
type deleteRouteRequest struct {
	Password string `json:"password"`
	From     int64  `json:"from"`
	To       int64  `json:"to"`
}

// deleteRoute serves DELETE /api/phones/{id}/route: deletes where the phone
// was from from up to (not including) to, and what tells the same (see
// history.Store.DeleteRoute), as when a day of its route should not be kept.
func (c *deviceChanges) deleteRoute(devices Devices, routes RouteDeleter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var request deleteRouteRequest
		if !readJSON(w, r, &request) {
			return
		}
		if request.From < 0 || request.From >= request.To {
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, "from and to must be Unix times in seconds, with from before to"})
			return
		}
		id := r.PathValue("id")
		// The day deleted is told in the browser's time zone, which the hub does not know.
		day := strconv.FormatInt(request.From, 10) + "-" + strconv.FormatInt(request.To, 10)
		c.change(w, r, request.Password, true, changelog.Entry{Action: changelog.ActionDeleteRoute, Device: id, Detail: day}, func() (any, error) {
			phone := slices.ContainsFunc(devices.List(), func(d Device) bool { return d.ID == id && d.Kind == hub.KindPhone })
			if !phone {
				return nil, &hub.InputError{Problem: hub.ProblemNotFound, Message: "there is no phone with this id"}
			}
			deleted, err := routes.DeleteRoute(r.Context(), id, time.Unix(request.From, 0), time.Unix(request.To, 0))
			if err == nil {
				slog.Info("deleted a stretch of a phone's route", "device", id, "points", deleted)
			}
			return nil, err
		})
	}
}
