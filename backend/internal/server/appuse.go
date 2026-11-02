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

// AppUseSource reads how a phone's apps were used, in steps of whole hours.
type AppUseSource interface {
	AppUses(ctx context.Context, device string, from, to time.Time, step time.Duration) (history.AppUsage, error)
}

// maxAppUseSteps is about how many steps GET /api/phone/usage returns at
// most, as for GET /api/wifi.
const maxAppUseSteps = 200

// appUseResponse is the body of GET /api/phone/usage. Times are Unix seconds.
type appUseResponse struct {
	From int64 `json:"from"`
	To   int64 `json:"to"`
	history.AppUsage
}

// appUseHandler serves GET /api/phone/usage?device=<id>&from=<unix
// seconds>&to=<unix seconds>: the phone's screen time, unlocks and the time
// in each app in that range, which its app sends when its user allowed it
// to read them. The range is limited to the retention period and ends now
// at the latest. Any other device has none.
func appUseHandler(d Device, source AppUseSource, retention time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, fromErr := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64)
		to, toErr := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64)
		if fromErr != nil || toErr != nil || from >= to {
			http.Error(w, "from and to must be Unix times in seconds, with from before to", http.StatusBadRequest)
			return
		}
		if d.Kind != hub.KindPhone {
			http.Error(w, "only a phone's app tells how its apps were used", http.StatusNotFound)
			return
		}
		now := time.Now()
		from = min(max(from, now.Add(-retention).Unix()), now.Unix())
		to = min(max(to, from+1), now.Unix()+1)
		step := time.Duration(to-from) * time.Second / maxAppUseSteps
		usage, err := source.AppUses(r.Context(), d.ID, time.Unix(from, 0), time.Unix(to, 0), step)
		if err != nil {
			slog.Error("read how a phone's apps were used", "device", d.ID, "error", err)
			http.Error(w, "could not read how the phone's apps were used", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, appUseResponse{From: from, To: to, AppUsage: usage})
	}
}
