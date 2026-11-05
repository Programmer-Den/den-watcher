// Package energy keeps the price of energy entered on the page, so every
// browser that opens it shows what the power the devices draw costs.
package energy

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
)

// MaxPerKWh is the highest price per kilowatt-hour the page may send, in any
// currency: far above what energy costs, yet low enough to catch a price
// typed in the wrong unit, such as cents.
const MaxPerKWh = 1000

// Price is what a kilowatt-hour of energy costs.
type Price struct {
	// PerKWh is the price of a kilowatt-hour; nil while none was entered,
	// and the page then shows no costs.
	PerKWh *float64 `json:"perKwh"`
	// Currency is the price's currency as its ISO 4217 code, such as "EUR".
	Currency string `json:"currency"`
}

// DefaultCurrency is the currency of a price before one was chosen.
const DefaultCurrency = "EUR"

// InputError tells what is wrong with a price sent by the page.
type InputError struct{ Message string }

func (e *InputError) Error() string { return e.Message }

const schema = `
CREATE TABLE IF NOT EXISTS energy_price (
	id    INTEGER PRIMARY KEY CHECK (id = 1), -- there is only one price
	price TEXT NOT NULL                       -- the Price as JSON
);
`

// validCurrency matches an ISO 4217 code.
var validCurrency = regexp.MustCompile(`^[A-Z]{3}$`)

// Store keeps the price in the database.
type Store struct{ db *sql.DB }

// Open creates the price's table in db when it does not exist yet.
func Open(ctx context.Context, db *sql.DB) (*Store, error) {
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

// Read returns the stored price; one without a price per kilowatt-hour when
// none was stored yet.
func (s *Store) Read(ctx context.Context) (Price, error) {
	var stored string
	err := s.db.QueryRowContext(ctx, `SELECT price FROM energy_price WHERE id = 1`).Scan(&stored)
	if errors.Is(err, sql.ErrNoRows) {
		return Price{Currency: DefaultCurrency}, nil
	}
	if err != nil {
		return Price{}, err
	}
	var price Price
	if err := json.Unmarshal([]byte(stored), &price); err != nil {
		return Price{}, fmt.Errorf("read the stored energy price: %w", err)
	}
	return price, nil
}

// Write checks the price and stores it in place of the one before. A price
// that is not valid is an *InputError.
func (s *Store) Write(ctx context.Context, price Price) error {
	if !validCurrency.MatchString(price.Currency) {
		return &InputError{"the currency must be an ISO 4217 code of three capital letters, such as EUR"}
	}
	if p := price.PerKWh; p != nil && (math.IsNaN(*p) || *p < 0 || *p > MaxPerKWh) {
		return &InputError{fmt.Sprintf("the price per kilowatt-hour must be from 0 to %d", MaxPerKWh)}
	}
	stored, err := json.Marshal(price)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO energy_price (id, price) VALUES (1, ?)
		ON CONFLICT (id) DO UPDATE SET price = excluded.price`, string(stored))
	return err
}
