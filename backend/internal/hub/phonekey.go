package hub

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
)

// phoneKeySchema keeps the secret the hub makes each phone's key from, made
// once when the hub first starts, and which keys it gave (by a hash of
// each), as each is given only once: the pairing code that asks for it is
// shown in the app, so whoever has the phone could ask for it later.
const phoneKeySchema = `
CREATE TABLE IF NOT EXISTS hub_phone_secret (
	secret TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hub_phone_keys_given (
	key_hash TEXT PRIMARY KEY
);
`

// readPhoneSecret returns the secret the hub makes each phone's key from,
// and makes one the first time.
func readPhoneSecret(ctx context.Context, db *sql.DB) ([]byte, error) {
	var stored string
	err := db.QueryRowContext(ctx, `SELECT secret FROM hub_phone_secret LIMIT 1`).Scan(&stored)
	if secret, decodeErr := hex.DecodeString(stored); err == nil && decodeErr == nil && len(secret) == 32 {
		return secret, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	// rand.Read never fails; it ends the program should the system have no
	// randomness to give.
	secret := make([]byte, 32)
	_, _ = rand.Read(secret)
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM hub_phone_secret`); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO hub_phone_secret (secret) VALUES (?)`, hex.EncodeToString(secret)); err != nil {
		return nil, err
	}
	return secret, tx.Commit()
}

// phoneKey returns the key of the phone with the pairing code, which the
// hub gives the app with its first push (see Push.NeedKey) and proves it
// allows a change with (see releaseProof). It is made from the hub's secret,
// so unlike the pairing code, which the app shows, whoever has the phone
// does not know it, and a server of theirs at the hub's address cannot
// unlock the app.
func phoneKey(secret []byte, code string) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte("den-watcher phone key " + code))
	return mac.Sum(nil)
}

// releaseProof proves to the app that sent a push at now, on its clock,
// that the hub allows a change for the seconds: only the hub has the
// phone's key, and an answer to an earlier push does not prove it for this
// one.
func releaseProof(key []byte, now, seconds int64) string {
	mac := hmac.New(sha256.New, key)
	mac.Write(fmt.Appendf(nil, "den-watcher release %d %d", now, seconds))
	return hex.EncodeToString(mac.Sum(nil))
}

// keyHash returns what hub_phone_keys_given keeps of a key.
func keyHash(key []byte) string {
	sum := sha256.Sum256(key)
	return hex.EncodeToString(sum[:])
}

// giveKey reports whether the phone's key may be given, and notes it as
// given: only the first time. While the hub's owner allows the phone a
// change, it may be given once more (see phone.takeRegive).
func giveKey(ctx context.Context, db *sql.DB, key []byte) (bool, error) {
	result, err := db.ExecContext(ctx, `INSERT OR IGNORE INTO hub_phone_keys_given (key_hash) VALUES (?)`, keyHash(key))
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n == 1, err
}
