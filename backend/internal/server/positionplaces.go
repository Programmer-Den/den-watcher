package server

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
)

// placeNameRequest is the body of PUT /api/wifi/positions/{id}/name.
type placeNameRequest struct {
	Name string `json:"name"`
}

// placeMergeRequest is the body of PUT /api/wifi/positions/{id}/merged-into:
// the place to merge into, or null to undo the merge.
type placeMergeRequest struct {
	Into *int64 `json:"into"`
}

// placeApartRequest is the body of POST /api/wifi/positions/{id}/apart.
type placeApartRequest struct {
	Other int64 `json:"other"`
}

// changePlace serves a change to the place in the path, which change makes
// with its ID once the body was read into request. Like the layout, it needs
// no password: it changes only what the page calls a place, not what the
// hub collects.
func changePlace[T any](change func(r *http.Request, id int64, request T) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "no such place", http.StatusNotFound)
			return
		}
		var request T
		if !readJSON(w, r, &request) {
			return
		}
		err = change(r, id, request)
		var input *history.PlaceInputError
		switch {
		case errors.Is(err, history.ErrNoPositionPlace):
			http.Error(w, "no such place", http.StatusNotFound)
		case errors.As(err, &input):
			writeJSON(w, http.StatusBadRequest, problemResponse{problemRequest, input.Message})
		case err != nil:
			slog.Error("change a place", "place", id, "error", err)
			http.Error(w, "could not change the place", http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}
}

// renamePlace serves PUT /api/wifi/positions/{id}/name.
func renamePlace(source PositionSource) http.HandlerFunc {
	return changePlace(func(r *http.Request, id int64, request placeNameRequest) error {
		return source.RenamePositionPlace(r.Context(), id, request.Name)
	})
}

// mergePlace serves PUT /api/wifi/positions/{id}/merged-into.
func mergePlace(source PositionSource) http.HandlerFunc {
	return changePlace(func(r *http.Request, id int64, request placeMergeRequest) error {
		if request.Into == nil {
			return source.SplitPositionPlace(r.Context(), id)
		}
		return source.MergePositionPlace(r.Context(), id, *request.Into)
	})
}

// keepPlacesApart serves POST /api/wifi/positions/{id}/apart.
func keepPlacesApart(source PositionSource) http.HandlerFunc {
	return changePlace(func(r *http.Request, id int64, request placeApartRequest) error {
		return source.KeepPositionPlacesApart(r.Context(), id, request.Other)
	})
}
