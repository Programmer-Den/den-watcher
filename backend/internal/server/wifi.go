package server

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
)

// WiFiSource reads what the devices' Wi-Fi saw nearby, in steps of whole
// hours.
type WiFiSource interface {
	WiFi(ctx context.Context, from, to time.Time, step time.Duration) (history.WiFiHistory, error)
}

// maxWiFiSteps is about how many steps GET /api/wifi returns at most, so a
// range of a month has steps of a few hours.
const maxWiFiSteps = 200

// wifiResponse is the body of GET /api/wifi. Times are Unix seconds.
type wifiResponse struct {
	From int64 `json:"from"`
	To   int64 `json:"to"`
	history.WiFiHistory
}

// wifiHandler serves GET /api/wifi?from=<unix seconds>&to=<unix seconds>:
// what the Wi-Fi of each device saw nearby in that range, each access point
// on its own, so the page can compare them. The range is limited to the
// retention period and ends now at the latest.
func wifiHandler(source WiFiSource, retention time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, fromErr := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64)
		to, toErr := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64)
		if fromErr != nil || toErr != nil || from >= to {
			http.Error(w, "from and to must be Unix times in seconds, with from before to", http.StatusBadRequest)
			return
		}
		now := time.Now()
		from = min(max(from, now.Add(-retention).Unix()), now.Unix())
		to = min(max(to, from+1), now.Unix()+1)
		step := time.Duration(to-from) * time.Second / maxWiFiSteps
		seen, err := source.WiFi(r.Context(), time.Unix(from, 0), time.Unix(to, 0), step)
		if err != nil {
			slog.Error("read what the Wi-Fi saw", "error", err)
			http.Error(w, "could not read what the Wi-Fi saw", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, wifiResponse{From: from, To: to, WiFiHistory: seen})
	}
}
