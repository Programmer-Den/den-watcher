package energy

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"path/filepath"
	"reflect"
	"testing"

	_ "modernc.org/sqlite"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "energy.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	s, err := Open(context.Background(), db)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	return s
}

func TestThereIsNoPriceUntilOneIsEntered(t *testing.T) {
	got, err := openTestStore(t).Read(context.Background())
	if want := (Price{Currency: DefaultCurrency}); err != nil || !reflect.DeepEqual(got, want) {
		t.Errorf("Read() = %#v, %v; want %#v", got, err, want)
	}
}

func TestTheLastWrittenPriceIsKept(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	want := Price{PerKWh: new(0.2875), Currency: "CHF"}
	for _, price := range []Price{{PerKWh: new(0.31), Currency: "EUR"}, want} {
		if err := s.Write(ctx, price); err != nil {
			t.Fatalf("Write(%v) error = %v", price, err)
		}
	}
	got, err := s.Read(ctx)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Errorf("Read() = %v, %v; want %v", got, err, want)
	}
}

func TestAPriceCanBeTakenAway(t *testing.T) {
	ctx := context.Background()
	s := openTestStore(t)
	for _, price := range []Price{{PerKWh: new(0.31), Currency: "EUR"}, {Currency: "EUR"}} {
		if err := s.Write(ctx, price); err != nil {
			t.Fatalf("Write(%v) error = %v", price, err)
		}
	}
	if got, err := s.Read(ctx); err != nil || got.PerKWh != nil {
		t.Errorf("Read() = %v, %v; want no price per kilowatt-hour", got, err)
	}
}

func TestRefusesAPriceThatIsNotValid(t *testing.T) {
	for name, price := range map[string]Price{
		"negative":           {PerKWh: new(-0.1), Currency: "EUR"},
		"too high":           {PerKWh: new(MaxPerKWh + 1.0), Currency: "EUR"},
		"not a number":       {PerKWh: new(math.NaN()), Currency: "EUR"},
		"no currency":        {PerKWh: new(0.3)},
		"lower case":         {PerKWh: new(0.3), Currency: "eur"},
		"symbol":             {PerKWh: new(0.3), Currency: "€"},
		"too long currency":  {PerKWh: new(0.3), Currency: "EURO"},
		"currency with JSON": {PerKWh: new(0.3), Currency: `E"R`},
	} {
		t.Run(name, func(t *testing.T) {
			s := openTestStore(t)
			var input *InputError
			if err := s.Write(context.Background(), price); !errors.As(err, &input) {
				t.Errorf("Write(%v) error = %v, want an *InputError", price, err)
			}
			if got, _ := s.Read(context.Background()); got.PerKWh != nil {
				t.Errorf("stored %v, want nothing", got)
			}
		})
	}
}

func TestTakesFreeEnergy(t *testing.T) {
	if err := openTestStore(t).Write(context.Background(), Price{PerKWh: new(0.0), Currency: "USD"}); err != nil {
		t.Errorf("Write() error = %v, want none", err)
	}
}
