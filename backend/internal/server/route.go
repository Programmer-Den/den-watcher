package server

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

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
// The range is limited to the retention period and ends now at the latest.
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
		from = min(max(from, now.Add(-retention).Unix()), now.Unix())
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
