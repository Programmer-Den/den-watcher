package server

import (
	"context"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/energy"
)

// fakeEnergyPrice keeps a price in memory, refusing the currency "XXX".
type fakeEnergyPrice struct{ stored energy.Price }

func (f *fakeEnergyPrice) Read(context.Context) (energy.Price, error) { return f.stored, nil }

func (f *fakeEnergyPrice) Write(_ context.Context, price energy.Price) error {
	if price.Currency == "XXX" {
		return &energy.InputError{Message: "not a currency"}
	}
	f.stored = price
	return nil
}

func newEnergyPriceHandler(store EnergyPriceStore) http.Handler {
	return New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), EnergyPrice: store, Files: site})
}

func TestKeepsTheEnergyPriceForEveryBrowser(t *testing.T) {
	store := &fakeEnergyPrice{stored: energy.Price{Currency: "EUR"}}
	handler := newEnergyPriceHandler(store)
	if rec := send(handler, http.MethodPut, "/api/energy-price", `{"perKwh":0.31,"currency":"CHF"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("PUT = %d %s, want %d", rec.Code, rec.Body, http.StatusNoContent)
	}
	if want := (energy.Price{PerKWh: new(0.31), Currency: "CHF"}); !reflect.DeepEqual(store.stored, want) {
		t.Errorf("stored = %v, want %v", store.stored, want)
	}
	rec := send(handler, http.MethodGet, "/api/energy-price", "")
	if want := `{"perKwh":0.31,"currency":"CHF"}`; rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != want {
		t.Errorf("GET = %d %s, want 200 with %s", rec.Code, rec.Body, want)
	}
}

func TestRefusesAnEnergyPriceThatIsNotValid(t *testing.T) {
	for name, body := range map[string]string{
		"not json":      `{"perKwh":`,
		"unknown field": `{"perKwh":0.3,"currency":"EUR","tax":19}`,
		"refused":       `{"perKwh":0.3,"currency":"XXX"}`,
		"text":          `{"perKwh":"0.3","currency":"EUR"}`,
		"too large":     `{"currency":"` + strings.Repeat("A", maxEnergyPriceBytes) + `"}`,
	} {
		t.Run(name, func(t *testing.T) {
			store := &fakeEnergyPrice{stored: energy.Price{Currency: "EUR"}}
			if rec := send(newEnergyPriceHandler(store), http.MethodPut, "/api/energy-price", body); rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
			if store.stored != (energy.Price{Currency: "EUR"}) {
				t.Errorf("stored = %v, want it unchanged", store.stored)
			}
		})
	}
}

func TestLeavesOutTheEnergyPriceWithoutAStore(t *testing.T) {
	handler := New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Files: site})
	if rec := send(handler, http.MethodPut, "/api/energy-price", `{"currency":"EUR"}`); rec.Code == http.StatusNoContent {
		t.Errorf("PUT = %d, want it refused", rec.Code)
	}
}
