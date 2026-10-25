package server

import (
	"encoding/json"
	"errors"
	"log/slog"
	"mime"
	"net/http"

	"github.com/Programmer-Den/den-watcher/backend/internal/layout"
)

// maxLayoutBytes is the largest body of PUT /api/layout: room for every list
// of the layout at its longest.
const maxLayoutBytes = 128 << 10

// readLayout serves GET /api/layout: how the page is arranged.
func readLayout(store LayoutStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		l, err := store.Read(r.Context())
		if err != nil {
			slog.Error("read the layout", "error", err)
			http.Error(w, "could not read the layout", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, l)
	}
}

// writeLayout serves PUT /api/layout, which keeps a new arrangement of the
// page. It needs no password: the layout changes only how the page looks,
// not what the hub collects, and only the local network reaches the page.
func writeLayout(store LayoutStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var l layout.Layout
		if !readLayoutJSON(w, r, &l) {
			return
		}
		err := store.Write(r.Context(), l)
		var input *layout.InputError
		switch {
		case errors.As(err, &input):
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, input.Message})
		case err != nil:
			slog.Error("store the layout", "error", err)
			http.Error(w, "could not store the layout", http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}
}

// readLayoutJSON is readJSON for a layout, whose body may be larger than a
// change of a device. It stays apart from readJSON so the small limit of the
// device changes stays fixed.
func readLayoutJSON(w http.ResponseWriter, r *http.Request, l *layout.Layout) bool {
	mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mediaType != "application/json" {
		writeJSON(w, http.StatusUnsupportedMediaType, problemResponse{problemRequest, "send the request as application/json"})
		return false
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxLayoutBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(l); err != nil {
		writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, "the request is not valid JSON: " + err.Error()})
		return false
	}
	return true
}
