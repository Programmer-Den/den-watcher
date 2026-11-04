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

// WiFiConnectionSource reads which Wi-Fi a phone was connected to and when.
type WiFiConnectionSource interface {
	WiFiConnections(ctx context.Context, device string, from, to time.Time) ([]history.PhoneConnection, error)
}

// wifiConnectionResponse is the body of GET /api/phone/wifi. Times are Unix
// seconds.
type wifiConnectionResponse struct {
	From        int64                     `json:"from"`
	To          int64                     `json:"to"`
	Connections []history.PhoneConnection `json:"connections"`
}

// wifiConnectionHandler serves GET /api/phone/wifi?device=<id>&from=<unix
// seconds>&to=<unix seconds>: which Wi-Fi the phone was connected to in
// that range and when, oldest first, which its app sends when its user
// allowed it the Wi-Fi networks. The range is limited to the retention
// period and ends now at the latest. Any other device has none.
func wifiConnectionHandler(d Device, source WiFiConnectionSource, retention time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, fromErr := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64)
		to, toErr := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64)
		if fromErr != nil || toErr != nil || from >= to {
			http.Error(w, "from and to must be Unix times in seconds, with from before to", http.StatusBadRequest)
			return
		}
		if d.Kind != hub.KindPhone {
			http.Error(w, "only a phone's app tells which Wi-Fi it was connected to", http.StatusNotFound)
			return
		}
		now := time.Now()
		from = min(max(from, now.Add(-retention).Unix()), now.Unix())
		to = min(max(to, from+1), now.Unix()+1)
		connections, err := source.WiFiConnections(r.Context(), d.ID, time.Unix(from, 0), time.Unix(to, 0))
		if err != nil {
			slog.Error("read which Wi-Fi a phone was connected to", "device", d.ID, "error", err)
			http.Error(w, "could not read which Wi-Fi the phone was connected to", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, wifiConnectionResponse{From: from, To: to, Connections: connections})
	}
}
