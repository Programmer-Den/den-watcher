package server

import (
	"encoding/json"
	"errors"
	"log/slog"
	"mime"
	"net/http"

	"github.com/Programmer-Den/den-watcher/backend/internal/energy"
)

// maxEnergyPriceBytes is the largest body of PUT /api/energy-price, which
// holds a number and a currency.
const maxEnergyPriceBytes = 1 << 10

// readEnergyPrice serves GET /api/energy-price: what a kilowatt-hour costs.
func readEnergyPrice(store EnergyPriceStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		price, err := store.Read(r.Context())
		if err != nil {
			slog.Error("read the energy price", "error", err)
			http.Error(w, "could not read the energy price", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, price)
	}
}

// writeEnergyPrice serves PUT /api/energy-price, which keeps a new price of
// energy. Like the layout it needs no password: the price changes only the
// costs the page shows, not what the hub collects.
func writeEnergyPrice(store EnergyPriceStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if mediaType != "application/json" {
			writeJSON(w, http.StatusUnsupportedMediaType, problemResponse{problemRequest, "send the request as application/json"})
			return
		}
		var price energy.Price
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxEnergyPriceBytes))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&price); err != nil {
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, "the request is not valid JSON: " + err.Error()})
			return
		}
		err := store.Write(r.Context(), price)
		var input *energy.InputError
		switch {
		case errors.As(err, &input):
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, input.Message})
		case err != nil:
			slog.Error("store the energy price", "error", err)
			http.Error(w, "could not store the energy price", http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}
}
