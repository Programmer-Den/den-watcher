package hub

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"unicode/utf8"

	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

// pairingSchema keeps the pairing code of each device that has one, which
// the hub sends with every request; see the pairing package. It is a table
// of its own, as hub_device_kinds is, so the devices from HUB_DEVICES can
// have one too.
const pairingSchema = `
CREATE TABLE IF NOT EXISTS hub_pairing_codes (
	device TEXT PRIMARY KEY,
	code   TEXT NOT NULL
);
`

// maxCodeLength is the longest pairing code the page may send. A device's
// code is shorter; this only keeps out what is no code at all.
const maxCodeLength = 32

// checkCode returns a pairing code given on the page as it is sent to the
// device, or an InputError when it can be no code.
func checkCode(code string) (string, error) {
	code = pairing.Normalize(code)
	if utf8.RuneCountInString(code) > maxCodeLength {
		return "", &InputError{Problem: ProblemPairingWrong, Message: "the pairing code is too long; give the code the device shows, such as 7KQM-X2RP"}
	}
	for _, r := range code {
		if (r < '0' || r > '9') && (r < 'A' || r > 'Z') {
			return "", &InputError{Problem: ProblemPairingWrong, Message: "the pairing code has letters and digits only; give the code the device shows, such as 7KQM-X2RP"}
		}
	}
	return code, nil
}

// checkPhoneCode returns a phone's pairing code, checked by checkCode, or an
// InputError when it is not a code as an app shows it, such as 7KQM-X2RP. It
// is all a phone's pushes are taken with, so a short one could be guessed.
func checkPhoneCode(code string) error {
	if code == "" || (len(code) == 8 && pairing.Valid(code[:4]+"-"+code[4:])) {
		return nil
	}
	return &InputError{Problem: ProblemPairingWrong, Message: "a phone's pairing code has 8 letters and digits; give the code the phone shows, such as 7KQM-X2RP"}
}

// readCode returns the pairing code of device, empty when it has none.
func readCode(ctx context.Context, db *sql.DB, device string) (string, error) {
	var code string
	err := db.QueryRowContext(ctx, `SELECT code FROM hub_pairing_codes WHERE device = ?`, device).Scan(&code)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return code, err
}

// storeCode keeps the pairing code of device; an empty one is stored as no row.
func storeCode(ctx context.Context, db execer, device, code string) error {
	if code == "" {
		_, err := db.ExecContext(ctx, `DELETE FROM hub_pairing_codes WHERE device = ?`, device)
		return err
	}
	_, err := db.ExecContext(ctx, `
		INSERT INTO hub_pairing_codes (device, code) VALUES (?, ?)
		ON CONFLICT (device) DO UPDATE SET code = excluded.code`, device, code)
	return err
}

// pairingInputError explains a device that refused the hub's pairing code,
// or nil for another error.
func pairingInputError(err error) error {
	switch {
	case errors.Is(err, errPairingNeeded):
		return &InputError{Problem: ProblemPairingNeeded, Message: "the device asks for its pairing code; it shows it on its page, in its tray icon on Windows, or in its log and with den-watcher pairing-code"}
	case errors.Is(err, errPairingWrong):
		return &InputError{Problem: ProblemPairingWrong, Message: "the pairing code is not the device's; give the code it shows on its page, in its tray icon on Windows, or in its log and with den-watcher pairing-code"}
	}
	return nil
}

// SetCode changes the pairing code the hub sends a device, one from
// HUB_DEVICES too, once the device took it: one that refuses it is an
// InputError and keeps the code it had. A device that does not answer at
// all, as one switched off, keeps the code, which it is sent once it answers.
func (h *Hub) SetCode(ctx context.Context, id, code string) error {
	code, err := checkCode(code)
	if err != nil {
		return err
	}
	h.mu.Lock()
	remote := h.find(id)
	if remote != nil && remote.Phone {
		defer h.mu.Unlock()
		return h.setPhoneCode(ctx, remote, code)
	}
	h.mu.Unlock()
	if remote == nil {
		return &InputError{Problem: ProblemNotFound, Message: "there is no device with this id"}
	}
	if remote.ReadByHub() {
		return &InputError{Problem: ProblemPairingNone, Message: "the device runs no den-watcher, so it has no pairing code"}
	}
	// Asked without holding mu, so the page is not held up while the device
	// answers, with an agent of its own, so the readings go on meanwhile.
	var agent *Agent
	if remote.Fixed {
		agent = NewAgent(remote.Address)
	} else {
		agent = h.pageAgent(remote.Address)
	}
	agent.hubID, agent.code = h.id, code
	if _, err := askOnceWith(ctx, agent); err != nil {
		if input := pairingInputError(err); input != nil {
			return input
		}
		slog.Info("keeping a pairing code a device could not be asked about", "name", remote.Name, "error", err)
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.find(id) != remote {
		return &InputError{Problem: ProblemNotFound, Message: "there is no device with this id"}
	}
	if err := storeCode(context.WithoutCancel(ctx), h.store.DB(), id, code); err != nil {
		return err
	}
	remote.Agent.setPairingCode(code)
	slog.Info("changed the pairing code of another device", "name", remote.Name)
	return nil
}

// Pairing returns why the device does not answer the hub, as far as its
// pairing code is concerned: "needed" while the hub has none for it, "wrong"
// while the one it has is not the device's, else empty. As with Refused, it
// is set only while the device does not answer (see Unreachable).
func (r *Remote) Pairing() string {
	if r.Agent.answers() {
		return ""
	}
	return r.watched.pairingRefused()
}

// setPhoneCode changes the pairing code a phone's pushes are taken with, as
// when its app was set up anew and shows another code. A phone is not asked:
// it comes to the hub. The caller holds mu.
func (h *Hub) setPhoneCode(ctx context.Context, remote *Remote, code string) error {
	if code == "" {
		return &InputError{Problem: ProblemPairingNeeded, Message: "give the pairing code the phone shows, such as 7KQM-X2RP"}
	}
	if err := checkPhoneCode(code); err != nil {
		return err
	}
	if other := h.phoneWith(code); other != nil && other != remote {
		return &InputError{Problem: ProblemPairingTaken, Message: "another phone has this pairing code; give the code this phone shows"}
	}
	if err := storeCode(context.WithoutCancel(ctx), h.store.DB(), remote.ID, code); err != nil {
		return err
	}
	remote.Agent.setPairingCode(code)
	slog.Info("changed the pairing code of a phone", "name", remote.Name)
	return nil
}
