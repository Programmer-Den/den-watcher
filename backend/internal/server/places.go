package server

import (
	"encoding/json"
	"errors"
	"log/slog"
	"mime"
	"net/http"

	"github.com/Programmer-Den/den-watcher/backend/internal/places"
)

// maxPlacesBytes is the largest body of PUT /api/wifi/places: room for the
// most places with the most access points each.
const maxPlacesBytes = 512 << 10

// placesBody is the body of GET and PUT /api/wifi/places.
type placesBody struct {
	Places []places.Place `json:"places"`
}

// readPlaces serves GET /api/wifi/places: the places named on the page.
func readPlaces(store PlaceStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		named, err := store.Read(r.Context())
		if err != nil {
			slog.Error("read the places", "error", err)
			http.Error(w, "could not read the places", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, placesBody{named})
	}
}

// writePlaces serves PUT /api/wifi/places, which keeps the places named on
// the page in place of the ones before. Like the layout it needs no
// password: the places change only what the page calls where a device was,
// not what the hub collects.
func writePlaces(store PlaceStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if mediaType != "application/json" {
			writeJSON(w, http.StatusUnsupportedMediaType, problemResponse{problemRequest, "send the request as application/json"})
			return
		}
		var body placesBody
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPlacesBytes))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, "the request is not valid JSON: " + err.Error()})
			return
		}
		err := store.Write(r.Context(), body.Places)
		var input *places.InputError
		switch {
		case errors.As(err, &input):
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, input.Message})
		case err != nil:
			slog.Error("store the places", "error", err)
			http.Error(w, "could not store the places", http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}
}
