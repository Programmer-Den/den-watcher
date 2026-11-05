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
