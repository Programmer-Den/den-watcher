// Package password keeps the password that protects changes to a hub's list
// of devices. It is chosen when the first device is added and stays the same
// after that. The same kind of password, kept in a table of its own, guards
// the remote status page, and that one can be changed. Only a salted hash is
// stored.
package password

import (
	"context"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"errors"
	"fmt"
	"net/netip"
	"sync"
	"time"
	"unicode/utf8"
)

// MinLength and MaxLength limit the length of a new password, in characters.
const (
	MinLength = 8
	MaxLength = 128
)

const (
	// iterations is how often the hash is repeated, so guessing is slow even
	// with a copy of the database (OWASP's recommendation for PBKDF2-SHA256).
	iterations = 600_000
	saltBytes  = 16
	keyBytes   = 32
	// failureDelay is how long a wrong password is answered late, so a
	// password cannot be guessed quickly over the network: each client
	// checks one password at a time, so it gets at most one guess a second.
	failureDelay = time.Second
)

var (
	// ErrWrong is returned for a password that does not match.
	ErrWrong = errors.New("wrong password")
	// ErrLength is returned for a new password that is too short or too long.
	ErrLength = errors.New("the password must have 8 to 128 characters")
	// ErrNotSet is returned when no password has been chosen yet.
	ErrNotSet = errors.New("no password has been chosen yet")
	// ErrAlreadySet is returned when a password is chosen a second time.
	ErrAlreadySet = errors.New("the password has been chosen already")
)

// schema creates a table for one password; %s is its name.
const schema = `
CREATE TABLE IF NOT EXISTS %s (
	id   INTEGER PRIMARY KEY CHECK (id = 1), -- there is only one password
	salt BLOB NOT NULL,
	hash BLOB NOT NULL
);
`

// StatusTable is the table of the password for the remote status page.
const StatusTable = "status_password"

// Password is the stored password.
type Password struct {
	db *sql.DB
	// table is the name of the table the password is kept in, set in code.
	table string
	// iterations is how often the hash is repeated; fewer only in tests.
	iterations int

	// mu lets one hash be worked out at a time, so many guesses at once
	// keep one processor core busy at most.
	mu sync.Mutex

	// clientsMu guards clients.
	clientsMu sync.Mutex
	// clients has a turn for each client with a check running or waiting,
	// so each checks one password at a time, the wait after a wrong one
	// included. A client is dropped once none of its checks runs or waits.
	clients map[netip.Addr]*turn
}

// turn is held by the one check of a client that runs.
type turn struct {
	held chan struct{}
	// checks is how many checks of the client run or wait.
	checks int
}

// Open returns the password for changing devices kept in db, creating its
// table when needed.
func Open(ctx context.Context, db *sql.DB) (*Password, error) {
	return OpenTable(ctx, db, "password")
}

// OpenTable returns the password kept in the table of db named table, such
// as StatusTable, creating it when needed. table is a name set in code.
func OpenTable(ctx context.Context, db *sql.DB, table string) (*Password, error) {
	if _, err := db.ExecContext(ctx, fmt.Sprintf(schema, table)); err != nil {
		return nil, err
	}
	return &Password{db: db, table: table, iterations: iterations}, nil
}

// IsSet reports whether a password has been chosen.
func (p *Password) IsSet(ctx context.Context) (bool, error) {
	var count int
	err := p.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM `+p.table).Scan(&count)
	return count > 0, err
}

// Check checks password, sent by the client at from, against the stored one.
// It returns ErrNotSet when none has been chosen yet. A client checks one
// password at a time, and a wrong one is answered failureDelay late, so a
// client guessing in parallel gets no more guesses, while others are not
// held up by its waits.
func (p *Password) Check(ctx context.Context, from netip.Addr, password string) error {
	done, err := p.wait(ctx, Client(from))
	if err != nil {
		return err
	}
	defer done()

	var salt, hash []byte
	err = p.db.QueryRowContext(ctx, `SELECT salt, hash FROM `+p.table+` WHERE id = 1`).Scan(&salt, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotSet
	}
	if err != nil {
		return err
	}

	p.mu.Lock()
	given, err := p.derive(password, salt)
	p.mu.Unlock()
	if err != nil {
		return err
	}
	if subtle.ConstantTimeCompare(given, hash) != 1 {
		// Waited in the client's turn but without holding mu, so the wait
		// holds up only the same client's next guess.
		time.Sleep(failureDelay)
		return ErrWrong
	}
	return nil
}

// wait waits for the client's turn, and returns the function that ends it.
func (p *Password) wait(ctx context.Context, client netip.Addr) (func(), error) {
	p.clientsMu.Lock()
	if p.clients == nil {
		p.clients = map[netip.Addr]*turn{}
	}
	t := p.clients[client]
	if t == nil {
		t = &turn{held: make(chan struct{}, 1)}
		p.clients[client] = t
	}
	t.checks++
	p.clientsMu.Unlock()

	leave := func() {
		p.clientsMu.Lock()
		defer p.clientsMu.Unlock()
		if t.checks--; t.checks == 0 {
			delete(p.clients, client)
		}
	}
	select {
	case t.held <- struct{}{}:
		return func() {
			<-t.held
			leave()
		}, nil
	case <-ctx.Done():
		leave()
		return nil, ctx.Err()
	}
}

// Client is who sent a request from the address from: the address itself,
// or for IPv6 its /64 network, as a device can pick any address in it.
func Client(from netip.Addr) netip.Addr {
	from = from.Unmap().WithZone("")
	if from.Is6() {
		return netip.PrefixFrom(from, 64).Masked().Addr()
	}
	return from
}

// Set chooses the password. It returns ErrAlreadySet when one has been chosen
// before, since it never changes, and ErrLength when password is too short
// or too long.
func (p *Password) Set(ctx context.Context, password string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	salt, hash, err := p.hashNew(password)
	if err != nil {
		return err
	}
	result, err := p.db.ExecContext(ctx, `INSERT OR IGNORE INTO `+p.table+` (id, salt, hash) VALUES (1, ?, ?)`, salt, hash) //nolint:gosec // table is a name set in code
	if err != nil {
		return err
	}
	if inserted, err := result.RowsAffected(); err != nil || inserted == 0 {
		return errors.Join(ErrAlreadySet, err)
	}
	return nil
}

// Change sets the password, whether one was chosen before or not. It returns
// ErrLength when password is too short or too long.
func (p *Password) Change(ctx context.Context, password string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	salt, hash, err := p.hashNew(password)
	if err != nil {
		return err
	}
	_, err = p.db.ExecContext(ctx, `INSERT OR REPLACE INTO `+p.table+` (id, salt, hash) VALUES (1, ?, ?)`, salt, hash) //nolint:gosec // table is a name set in code
	return err
}

// hashNew returns a new salt and the hash of password with it, or ErrLength
// when password is too short or too long.
func (p *Password) hashNew(password string) (salt, hash []byte, err error) {
	if err := CheckNew(password); err != nil {
		return nil, nil, err
	}
	salt = make([]byte, saltBytes)
	if _, err := rand.Read(salt); err != nil {
		return nil, nil, err
	}
	hash, err = p.derive(password, salt)
	return salt, hash, err
}

// CheckNew returns ErrLength when password is too short or too long to be chosen.
func CheckNew(password string) error {
	if length := utf8.RuneCountInString(password); length < MinLength || length > MaxLength {
		return ErrLength
	}
	return nil
}

// Reset deletes the password, so the next change chooses a new one.
func (p *Password) Reset(ctx context.Context) error {
	_, err := p.db.ExecContext(ctx, `DELETE FROM `+p.table) //nolint:gosec // table is a name set in code
	return err
}

func (p *Password) derive(password string, salt []byte) ([]byte, error) {
	return pbkdf2.Key(sha256.New, password, salt, p.iterations, keyBytes)
}
