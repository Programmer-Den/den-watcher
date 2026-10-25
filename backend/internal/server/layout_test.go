package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/layout"
)

// fakeLayout keeps a layout in memory, refusing one that folds "nothing".
type fakeLayout struct{ stored layout.Layout }

func (f *fakeLayout) Read(context.Context) (layout.Layout, error) { return f.stored, nil }

func (f *fakeLayout) Write(_ context.Context, l layout.Layout) error {
	if len(l.Folded) > 0 && l.Folded[0] == "nothing" {
		return &layout.InputError{Message: "not a category"}
	}
	f.stored = l
	return nil
}

func newLayoutHandler(store LayoutStore) http.Handler {
	return New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Layout: store, Files: site})
}

func TestKeepsTheLayoutForEveryBrowser(t *testing.T) {
	store := &fakeLayout{stored: layout.Layout{Folded: []string{}}}
	handler := newLayoutHandler(store)

	if rec := send(handler, http.MethodPut, "/api/layout", `{"folded":["storage"],"order":["memory","cpu"],"hidden":["extra:wifi"],"pinned":["fans"],"made":["value:kernel/forks"],"widths":{"cpu":2},"ungrouped":true}`); rec.Code != http.StatusNoContent {
		t.Fatalf("PUT status = %d, want %d: %s", rec.Code, http.StatusNoContent, rec.Body)
	}
	if want := (layout.Layout{Folded: []string{"storage"}, Order: []string{"memory", "cpu"}, Hidden: []string{"extra:wifi"}, Pinned: []string{"fans"}, Made: []string{"value:kernel/forks"}, Widths: map[string]int{"cpu": 2}, Ungrouped: true}); !reflect.DeepEqual(store.stored, want) {
		t.Errorf("stored = %#v, want %#v", store.stored, want)
	}
	rec := send(handler, http.MethodGet, "/api/layout", "")
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"folded":["storage"],"order":["memory","cpu"],"hidden":["extra:wifi"],"pinned":["fans"],"made":["value:kernel/forks"],"widths":{"cpu":2},"ungrouped":true}` {
		t.Errorf("GET = %d %s, want 200 with the stored layout", rec.Code, rec.Body)
	}
}

func TestRefusesALayoutThatIsNotValid(t *testing.T) {
	for name, body := range map[string]string{
		"refused by the store": `{"folded":["nothing"]}`,
		"unknown field":        `{"folded":[],"colors":"pink"}`,
		"not JSON":             `folded=storage`,
		"too large":            `{"folded":["` + strings.Repeat("a", maxLayoutBytes) + `"]}`,
	} {
		t.Run(name, func(t *testing.T) {
			store := &fakeLayout{stored: layout.Layout{Folded: []string{"network"}}}
			if rec := send(newLayoutHandler(store), http.MethodPut, "/api/layout", body); rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
			if want := []string{"network"}; !reflect.DeepEqual(store.stored.Folded, want) {
				t.Errorf("stored Folded = %v, want it unchanged at %v", store.stored.Folded, want)
			}
		})
	}
}

func TestTakesTheLongestValidLayout(t *testing.T) {
	names := make([]string, layout.MaxEntries)
	for i := range names {
		names[i] = fmt.Sprintf("%0*d", layout.MaxNameBytes, i)
	}
	widths := make(map[string]int, len(names))
	for _, name := range names {
		widths[name] = 4
	}
	l := layout.Layout{Folded: names, Order: names, Hidden: names, Pinned: names, Made: names, Widths: widths}
	body, err := json.Marshal(l)
	if err != nil {
		t.Fatal(err)
	}
	store := &fakeLayout{}
	if rec := send(newLayoutHandler(store), http.MethodPut, "/api/layout", string(body)); rec.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d for a layout of %d bytes", rec.Code, http.StatusNoContent, len(body))
	}
}

func TestNoLayoutWithoutAStore(t *testing.T) {
	if rec := send(newLayoutHandler(nil), http.MethodGet, "/api/layout", ""); rec.Code == http.StatusOK && strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		t.Errorf("GET /api/layout answered %d with JSON, want it left out", rec.Code)
	}
}
