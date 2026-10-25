package server

import (
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
)

// eventsResponse is the body of GET /api/events. Times are Unix seconds.
type eventsResponse struct {
	From   int64   `json:"from"`
	To     int64   `json:"to"`
	Events []event `json:"events"`
}

// event is something that happened to a device, which the page marks on its
// charts: an alert, an outage, a reboot or an update of den-watcher.
type event struct {
	Kind string `json:"kind"`
	// Time is when it happened, or started.
	Time int64 `json:"time"`
	// End is when an alert or outage ended; missing while an alert lasts.
	End *int64 `json:"end,omitempty"`
	// Detail is the new version of an update.
	Detail string `json:"detail,omitempty"`
	// Alert is the alert of an alert event.
	Alert *alerts.Alert `json:"alert,omitempty"`
}

// eventsHandler serves GET /api/events?from=<unix seconds>&to=<unix seconds>:
// what happened to the device in that range, oldest first: the alerts that
// lasted at some time in it, the times it did not answer the hub, its
// reboots and the updates of den-watcher on it. The range is limited to the
// retention period, like the history's.
func eventsHandler(d Device, alertLog AlertLog, eventLog EventLog, retention time.Duration) http.HandlerFunc {
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
		start, end := time.Unix(from, 0), time.Unix(to, 0)
		ctx := r.Context()
		list := []event{}

		alerted, err := alertLog.Between(ctx, d.ID, start, end)
		if err != nil {
			slog.Error("read the alerts of a device", "device", d.ID, "error", err)
			http.Error(w, "could not read the events", http.StatusInternalServerError)
			return
		}
		for i := range alerted {
			a := &alerted[i]
			list = append(list, event{Kind: "alert", Time: a.Started.Unix(), End: unixOf(a.Ended), Alert: a})
		}

		if d.Availability != nil {
			outages, err := d.Availability.OutagesBetween(ctx, start, end)
			if err != nil {
				slog.Error("read the outages of a device", "device", d.ID, "error", err)
				http.Error(w, "could not read the events", http.StatusInternalServerError)
				return
			}
			for _, o := range outages {
				list = append(list, event{Kind: "outage", Time: o.Start.Unix(), End: unixOf(&o.End)})
			}
		}

		happened, err := eventLog.Between(ctx, d.ID, start, end)
		if err != nil {
			slog.Error("read the events of a device", "device", d.ID, "error", err)
			http.Error(w, "could not read the events", http.StatusInternalServerError)
			return
		}
		for _, e := range happened {
			list = append(list, event{Kind: string(e.Kind), Time: e.Time.Unix(), Detail: e.Detail})
		}

		slices.SortStableFunc(list, func(a, b event) int { return int(a.Time - b.Time) })
		writeJSON(w, http.StatusOK, eventsResponse{From: from, To: to, Events: list})
	}
}

// unixOf returns t in Unix seconds, or nil for none.
func unixOf(t *time.Time) *int64 {
	if t == nil {
		return nil
	}
	s := t.Unix()
	return &s
}
