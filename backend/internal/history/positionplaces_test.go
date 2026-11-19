package history

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// scanAt stores a point of pixel's route and a scan hearing ssid there at t.
func scanAt(t *testing.T, store *Store, at time.Time, lat, lon float64, ssid string) {
	t.Helper()
	ctx := context.Background()
	if err := store.AddRoutePoints(ctx, "pixel", []RoutePoint{routePoint(at, lat, lon, 20)}); err != nil {
		t.Fatal(err)
	}
	if err := store.AddPhoneScans(ctx, "pixel", []FoundScan{{At: at, Found: []metrics.NearbyAccessPoint{{ID: ssid, SSID: ssid, SignalPercent: 80}}}}); err != nil {
		t.Fatal(err)
	}
}

// placesBy returns the places of the range by their names, or their first
// network's name for those without one.
func placesBy(t *testing.T, store *Store, from, to time.Time) map[string]WiFiPosition {
	t.Helper()
	got, err := store.WiFiPositions(context.Background(), from, to)
	if err != nil {
		t.Fatal(err)
	}
	places := map[string]WiFiPosition{}
	for _, p := range got {
		key := p.Name
		if key == "" {
			key = p.Networks[0].SSID
		}
		places[key] = p
	}
	return places
}

func TestPlacesKeepTheirIDsAcrossRanges(t *testing.T) {
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	scanAt(t, store, day, 53.5755, 9.9530, "Den")
	scanAt(t, store, day.Add(2*time.Hour), 53.5612, 9.9615, "Cafe")
	scanAt(t, store, day.Add(24*time.Hour), 53.5612, 9.9615, "Cafe")
	// 60 m from the first scan at home.
	scanAt(t, store, day.Add(48*time.Hour), 53.5760, 9.9530, "Den")

	// The second day alone first: the café's place starts there.
	second := placesBy(t, store, day.Add(20*time.Hour), day.Add(30*time.Hour))
	all := placesBy(t, store, day, day.Add(72*time.Hour))
	if len(all) != 2 || all["Cafe"].ID != second["Cafe"].ID || all["Cafe"].Scans != 2 {
		t.Errorf("all days = %+v, want the café as on the second day, with both scans", all)
	}
	third := placesBy(t, store, day.Add(44*time.Hour), day.Add(72*time.Hour))
	if third["Den"].ID != all["Den"].ID || third["Den"].Scans != 1 {
		t.Errorf("third day = %+v, want home as over all days", third)
	}
}

func TestPlacesCanBeNamed(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	scanAt(t, store, day, 53.5755, 9.9530, "Den")
	scanAt(t, store, day.Add(time.Hour), 53.5755, 9.9530, "Den")
	scanAt(t, store, day.Add(2*time.Hour), 53.5612, 9.9615, "Cafe")
	places := placesBy(t, store, day, day.Add(3*time.Hour))
	cafe := places["Cafe"].ID

	if err := store.RenamePositionPlace(ctx, cafe, "  Café Nord "); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFiPositions(ctx, day, day.Add(3*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	// Named first, though home has more scans.
	if len(got) != 2 || got[0].ID != cafe || got[0].Name != "Café Nord" {
		t.Errorf("places = %+v, want the named café first", got)
	}

	var input *PlaceInputError
	if err := store.RenamePositionPlace(ctx, places["Den"].ID, "café nord"); !errors.As(err, &input) {
		t.Errorf("a name taken in another case = %v, want refused", err)
	}
	if err := store.RenamePositionPlace(ctx, places["Den"].ID, strings.Repeat("x", MaxPlaceNameBytes+1)); !errors.As(err, &input) {
		t.Errorf("a name too long = %v, want refused", err)
	}
	if err := store.RenamePositionPlace(ctx, places["Den"].ID, "Home\n"); err != nil {
		t.Errorf("a name with a line break at its end = %v, want it trimmed", err)
	}
	if err := store.RenamePositionPlace(ctx, places["Den"].ID, "Ho\tme"); !errors.As(err, &input) {
		t.Errorf("a name with a tab = %v, want refused", err)
	}
	if err := store.RenamePositionPlace(ctx, 999, "Gym"); !errors.Is(err, ErrNoPositionPlace) {
		t.Errorf("an unknown place = %v, want ErrNoPositionPlace", err)
	}
	if err := store.RenamePositionPlace(ctx, cafe, ""); err != nil {
		t.Fatal(err)
	}
	if got := placesBy(t, store, day, day.Add(3*time.Hour)); got["Home"].ID != places["Den"].ID || got["Cafe"].Name != "" {
		t.Errorf("places = %+v, want home named and the café's name taken away", got)
	}
}

func TestMergedPlacesCountAsOne(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	scanAt(t, store, day, 53.5755, 9.9530, "Den")
	// 150 m off, as with a vague position: a place of its own.
	scanAt(t, store, day.Add(time.Hour), 53.5768, 9.9530, "Den 2")
	scanAt(t, store, day.Add(2*time.Hour), 53.5612, 9.9615, "Cafe")
	places := placesBy(t, store, day, day.Add(3*time.Hour))
	home, near, cafe := places["Den"].ID, places["Den 2"].ID, places["Cafe"].ID
	if err := store.RenamePositionPlace(ctx, near, "Home"); err != nil {
		t.Fatal(err)
	}

	if err := store.MergePositionPlace(ctx, near, home); err != nil {
		t.Fatal(err)
	}
	got := placesBy(t, store, day, day.Add(3*time.Hour))
	if len(got) != 2 || got["Home"].ID != home || got["Home"].Scans != 2 || !slices.Equal(got["Home"].Merged, []int64{near}) {
		t.Errorf("places = %+v, want both scans at home, which took the merged one's name", got)
	}
	// Merging home into the café takes what was merged into home along.
	if err := store.MergePositionPlace(ctx, home, cafe); err != nil {
		t.Fatal(err)
	}
	if got := placesBy(t, store, day, day.Add(3*time.Hour)); len(got) != 1 || got["Home"].ID != cafe || got["Home"].Scans != 3 {
		t.Errorf("places = %+v, want all at the café, named Home", got)
	}
	var input *PlaceInputError
	if err := store.MergePositionPlace(ctx, cafe, near); !errors.As(err, &input) {
		t.Errorf("merging a place into one merged into it = %v, want refused", err)
	}

	if err := store.SplitPositionPlace(ctx, home); err != nil {
		t.Fatal(err)
	}
	got = placesBy(t, store, day, day.Add(3*time.Hour))
	if got["Home"].ID != cafe || got["Home"].Scans != 2 || !slices.Equal(got["Home"].Apart, []int64{home}) {
		t.Errorf("café = %+v, want it with the near scan, kept apart from home", got["Home"])
	}
	if got["Den"].ID != home || got["Den"].Scans != 1 || !slices.Equal(got["Den"].Apart, []int64{cafe}) {
		t.Errorf("home = %+v, want it on its own again, kept apart from the café", got["Den"])
	}
}

func TestPlacesCanBeKeptApart(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	scanAt(t, store, day, 53.5755, 9.9530, "Den")
	scanAt(t, store, day.Add(time.Hour), 53.5612, 9.9615, "Cafe")
	places := placesBy(t, store, day, day.Add(3*time.Hour))
	home, cafe := places["Den"].ID, places["Cafe"].ID
	for range 2 {
		if err := store.KeepPositionPlacesApart(ctx, cafe, home); err != nil {
			t.Fatal(err)
		}
	}
	got := placesBy(t, store, day, day.Add(3*time.Hour))
	if !slices.Equal(got["Den"].Apart, []int64{cafe}) || !slices.Equal(got["Cafe"].Apart, []int64{home}) {
		t.Errorf("places = %+v, want each kept apart from the other", got)
	}
	var input *PlaceInputError
	if err := store.KeepPositionPlacesApart(ctx, home, home); !errors.As(err, &input) {
		t.Errorf("a place apart from itself = %v, want refused", err)
	}
	if err := store.KeepPositionPlacesApart(ctx, home, 999); !errors.Is(err, ErrNoPositionPlace) {
		t.Errorf("an unknown place = %v, want ErrNoPositionPlace", err)
	}
}

func TestOldPlacesAreDeletedUnlessTheUserToldOfThem(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	day := time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)
	scanAt(t, store, day, 53.5755, 9.9530, "Den")
	scanAt(t, store, day.Add(time.Hour), 53.5612, 9.9615, "Cafe")
	scanAt(t, store, day.Add(2*time.Hour), 53.5500, 9.9700, "Gym")
	scanAt(t, store, day.Add(3*time.Hour), 53.5400, 9.9800, "Park")
	scanAt(t, store, day.Add(48*time.Hour), 53.5300, 9.9900, "Station")
	places := placesBy(t, store, day, day.Add(72*time.Hour))
	if err := store.RenamePositionPlace(ctx, places["Den"].ID, "Home"); err != nil {
		t.Fatal(err)
	}
	if err := store.MergePositionPlace(ctx, places["Gym"].ID, places["Cafe"].ID); err != nil {
		t.Fatal(err)
	}
	if err := store.KeepPositionPlacesApart(ctx, places["Park"].ID, places["Station"].ID); err != nil {
		t.Fatal(err)
	}

	if _, err := store.DeleteBefore(ctx, day.Add(24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	var ids []int64
	rows, err := store.db.QueryContext(ctx, `SELECT id FROM position_places ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	if err := scanRows(rows, func() error {
		var id int64
		err := rows.Scan(&id)
		ids = append(ids, id)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	want := []int64{places["Den"].ID, places["Cafe"].ID, places["Gym"].ID, places["Station"].ID}
	slices.Sort(want)
	if !slices.Equal(ids, want) {
		t.Errorf("kept places %v, want %v: the named, the merged and the recent ones", ids, want)
	}
	var apart int
	if err := store.db.QueryRowContext(ctx, `SELECT count(*) FROM position_places_apart`).Scan(&apart); err != nil || apart != 0 {
		t.Errorf("%d places kept apart, %v; want none once the park is gone", apart, err)
	}
}
