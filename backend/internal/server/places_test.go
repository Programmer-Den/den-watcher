package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/places"
)

// fakePlaces keeps places in memory, refusing a place named "nowhere".
type fakePlaces struct{ stored []places.Place }

func (f *fakePlaces) Read(context.Context) ([]places.Place, error) { return f.stored, nil }

func (f *fakePlaces) Write(_ context.Context, named []places.Place) error {
	for _, place := range named {
		if place.Name == "nowhere" {
			return &places.InputError{Message: "not a place"}
		}
	}
	f.stored = named
	return nil
}

func newPlacesHandler(store PlaceStore) http.Handler {
	return New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Places: store, Files: site})
}

func TestKeepsThePlacesForEveryBrowser(t *testing.T) {
	store := &fakePlaces{stored: []places.Place{}}
	handler := newPlacesHandler(store)
	if rec := send(handler, http.MethodPut, "/api/wifi/places", `{"places":[{"name":"Work","signals":{"17226b1f68ae":64}}]}`); rec.Code != http.StatusNoContent {
		t.Fatalf("PUT = %d %s, want %d", rec.Code, rec.Body, http.StatusNoContent)
	}
	if want := []places.Place{{Name: "Work", Signals: map[string]float64{"17226b1f68ae": 64}}}; !reflect.DeepEqual(store.stored, want) {
		t.Errorf("stored = %v, want %v", store.stored, want)
	}
	rec := send(handler, http.MethodGet, "/api/wifi/places", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"name":"Work"`) {
		t.Errorf("GET = %d %s, want 200 with the stored places", rec.Code, rec.Body)
	}
}

func TestRefusesPlacesThatAreNotValid(t *testing.T) {
	for name, body := range map[string]string{
		"not json":      `{"places":`,
		"unknown field": `{"places":[],"rooms":[]}`,
		"refused":       `{"places":[{"name":"nowhere","signals":{"17226b1f68ae":64}}]}`,
		"too large":     `{"places":[{"name":"` + strings.Repeat("a", maxPlacesBytes) + `"}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			store := &fakePlaces{stored: []places.Place{{Name: "Home"}}}
			if rec := send(newPlacesHandler(store), http.MethodPut, "/api/wifi/places", body); rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
			if len(store.stored) != 1 || store.stored[0].Name != "Home" {
				t.Errorf("stored = %v, want it unchanged", store.stored)
			}
		})
	}
}

func TestTakesTheMostPlaces(t *testing.T) {
	named := make([]places.Place, places.MaxPlaces)
	for i := range named {
		signals := make(map[string]float64, places.MaxSignals)
		for j := range places.MaxSignals {
			signals[fmt.Sprintf("%012x", j)] = 99.123456789
		}
		named[i] = places.Place{Name: fmt.Sprintf("%0*d", places.MaxNameBytes, i), Signals: signals}
	}
	body, err := json.Marshal(placesBody{named})
	if err != nil {
		t.Fatal(err)
	}
	if rec := send(newPlacesHandler(&fakePlaces{}), http.MethodPut, "/api/wifi/places", string(body)); rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d for places of %d bytes", rec.Code, http.StatusNoContent, len(body))
	}
}

func TestNoPlacesWithoutAStore(t *testing.T) {
	if rec := send(newPlacesHandler(nil), http.MethodGet, "/api/wifi/places", ""); rec.Code == http.StatusOK && strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		t.Errorf("GET /api/wifi/places answered %d with JSON, want it left out", rec.Code)
	}
}
