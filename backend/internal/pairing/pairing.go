// Package pairing keeps the code a hub is given when this machine is added on
// it. A hub sends its id with every request (see hub.HubIDHeader); one whose
// id this machine does not know yet is only answered once it sends the code
// too, and is known from then on. The code is made at random once and stays
// the same after that. A machine that had a database before it kept a code,
// as one updated from a version without pairing, knows the hubs that ask in
// the first minutes after its start, so the hubs that already collect from it
// go on without a code.
package pairing

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"time"
)

const (
	// CodeHeader is sent by a hub with every request, with the code given
	// when the device was added, if any.
	CodeHeader = "Usage-Control-Pairing-Code"
	// ProblemHeader is sent with the answer 403 to a hub that is not paired:
	// "needed" when it sent no code, "wrong" when it sent another one.
	ProblemHeader = "Usage-Control-Pairing"
)

// alphabet are the characters of a code: digits and capital letters, without
// 0, 1, I and O, which are easily mistaken for each other. 32 characters to
// the power of codeLength are about 10^12 codes.
const (
	alphabet   = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
	codeLength = 8
)

// OpenFor is how long after its start a machine that had a database before it
// kept a code knows every hub that asks. A hub asks every 5 seconds, so each
// one that collects from it while it is updated is known by then.
const OpenFor = 10 * time.Minute

// maxOpenHubs is how many hubs are paired without a code for OpenFor at
// most. A household has a hub or two; one that sends a new id with each
// request cannot fill the table with ids that are paired for good.
const maxOpenHubs = 16

const schema = `
CREATE TABLE IF NOT EXISTS pairing_code (
	id   INTEGER PRIMARY KEY CHECK (id = 1), -- there is only one code
	code TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pairing_hubs (
	hub    TEXT    NOT NULL PRIMARY KEY, -- the id the hub sends
	paired INTEGER NOT NULL              -- Unix time in seconds
) WITHOUT ROWID;
`

// Answer tells whether a hub may collect from this machine.
type Answer int

const (
	// Paired is a hub this machine knows, or one that sent the right code.
	Paired Answer = iota
	// Needed is a hub this machine does not know that sent no code.
	Needed
	// Wrong is a hub this machine does not know that sent another code.
	Wrong
)

// Pairing is the code of this machine and the hubs that gave it.
type Pairing struct {
	db   *sql.DB
	code string
	// openUntil is when the hubs that ask stop being known without a code;
	// zero for a machine that kept a code before.
	openUntil time.Time
	// clock tells the time; nil for time.Now, replaced in tests.
	clock func() time.Time

	mu     sync.Mutex
	paired map[string]bool
	// openPaired counts the hubs paired without a code for OpenFor.
	openPaired int
}

// Open returns the code kept in db, and makes one the first time, creating
// its tables when needed. existed tells that db was there before this start:
// without a code yet, it is from a version without pairing, so the hubs in
// known, and every hub that asks for OpenFor, are paired without one.
func Open(ctx context.Context, db *sql.DB, existed bool, known []string) (*Pairing, error) {
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return nil, err
	}
	p := &Pairing{db: db, paired: map[string]bool{}}
	err := db.QueryRowContext(ctx, `SELECT code FROM pairing_code WHERE id = 1`).Scan(&p.code)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		p.code = newCode()
		if _, err := db.ExecContext(ctx, `INSERT INTO pairing_code (id, code) VALUES (1, ?)`, p.code); err != nil {
			return nil, err
		}
		if existed {
			p.openUntil = time.Now().Add(OpenFor)
			for _, hub := range known {
				p.store(ctx, hub)
			}
		}
	case err != nil:
		return nil, err
	}
	// Versions up to 3.0.0w could pair the empty id of a request without a
	// hub id, which let every such request pass from then on.
	if _, err := db.ExecContext(ctx, `DELETE FROM pairing_hubs WHERE hub = ''`); err != nil {
		return nil, err
	}
	rows, err := db.QueryContext(ctx, `SELECT hub FROM pairing_hubs`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var hub string
		if err := rows.Scan(&hub); err != nil {
			return nil, err
		}
		p.paired[hub] = true
	}
	return p, rows.Err()
}

// newCode returns a code made at random.
func newCode() string {
	// rand.Read never fails; it ends the program should the system have no
	// randomness to give.
	var random [codeLength]byte
	_, _ = rand.Read(random[:])
	code := make([]byte, codeLength)
	for i, b := range random {
		// 256 is a multiple of 32, so every character is as likely.
		code[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(code)
}

// Code returns the code as it is shown: two groups of four characters, such
// as 7KQM-X2RP.
func (p *Pairing) Code() string {
	return p.code[:codeLength/2] + "-" + p.code[codeLength/2:]
}

// Valid reports whether code is a code as Code shows it, such as 7KQM-X2RP.
func Valid(code string) bool {
	if len(code) != codeLength+1 || code[codeLength/2] != '-' {
		return false
	}
	return strings.Trim(code[:codeLength/2]+code[codeLength/2+1:], alphabet) == ""
}

// Normalize returns code as it is compared: in capitals, without the spaces
// and dashes it may be written with.
func Normalize(code string) string {
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '-' {
			return -1
		}
		return r
	}, strings.ToUpper(strings.TrimSpace(code)))
}

// Allow tells whether the hub with this id may collect from this machine,
// with the code it sent, empty when it sent none. A hub that sent the right
// code, or asks while the hubs are known without one, is paired from then
// on; the latter only maxOpenHubs at most. An empty id is no hub and is
// never paired, so leaving out the id does not get around the code. The code
// is compared in full, so how long that takes does not tell how much of it
// was right.
func (p *Pairing) Allow(ctx context.Context, hub, code string) Answer {
	if hub == "" {
		return Needed
	}
	code = Normalize(code)
	p.mu.Lock()
	defer p.mu.Unlock()
	switch {
	case p.paired[hub]:
		return Paired
	case subtle.ConstantTimeCompare([]byte(code), []byte(p.code)) == 1:
		slog.Info("a hub gave the pairing code and collects from this device from now on")
	case p.now().Before(p.openUntil) && p.openPaired < maxOpenHubs:
		p.openPaired++
		slog.Info("a hub that asked right after the update collects from this device without the pairing code")
	case code == "":
		return Needed
	default:
		return Wrong
	}
	p.paired[hub] = true
	p.store(context.WithoutCancel(ctx), hub)
	return Paired
}

// store keeps that the hub is paired. A hub that cannot be stored is still
// paired until the program stops.
func (p *Pairing) store(ctx context.Context, hub string) {
	_, err := p.db.ExecContext(ctx, `INSERT OR IGNORE INTO pairing_hubs (hub, paired) VALUES (?, ?)`, hub, time.Now().Unix())
	if err != nil {
		slog.Error("store that a hub is paired", "error", err)
	}
}

func (p *Pairing) now() time.Time {
	if p.clock == nil {
		return time.Now()
	}
	return p.clock()
}
