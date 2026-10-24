package server

import (
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

// pushHandler serves POST /api/phone/minutes: what a phone kept of its own
// usage, sent by the phone with its pairing code (see hub.Push). A code no
// phone has is answered a second late, as a wrong code is on a device, so
// codes cannot be tried quickly.
func pushHandler(h Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if mediaType != "application/json" {
			writeJSON(w, http.StatusUnsupportedMediaType, problemResponse{problemRequest, "send the push as application/json"})
			return
		}
		var push hub.Push
		// Fields a newer app sends are left out, so it can still push to an
		// older hub.
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, hub.MaxPushBytes)).Decode(&push); err != nil {
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, "the push is not valid JSON: " + err.Error()})
			return
		}
		answer, err := h.Receive(r.Context(), r.Header.Get(pairing.CodeHeader), push)
		switch {
		case err == nil:
			writeJSON(w, http.StatusOK, answer)
		case errors.Is(err, hub.ErrUnknownPhone):
			select {
			case <-time.After(wrongCodeDelay):
			case <-r.Context().Done():
				return
			}
			w.Header().Set(pairing.ProblemHeader, "wrong")
			http.Error(w, "no phone on this hub has this pairing code; add the phone in the hub's Devices dialog with the code its app shows", http.StatusForbidden)
		case errors.Is(err, hub.ErrPushTooLarge):
			writeJSON(w, http.StatusRequestEntityTooLarge, problemResponse{problemRequest, err.Error()})
		default:
			writeProblem(w, err)
		}
	}
}
