package statuspage

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"sync"
	"time"
)

const (
	// certificateLife is how long a certificate is valid: the longest Apple's
	// systems accept.
	certificateLife = 825 * 24 * time.Hour
	// renewRetry is how long after a new certificate could not be kept it is
	// tried again.
	renewRetry = time.Hour
	// renewBefore is how long before it ends a certificate is replaced.
	renewBefore = 30 * 24 * time.Hour
)

const certificateSchema = `
CREATE TABLE IF NOT EXISTS status_certificate (
	id          INTEGER PRIMARY KEY CHECK (id = 1), -- there is only one certificate
	certificate BLOB NOT NULL, -- DER
	key         BLOB NOT NULL  -- PKCS #8 DER
);
`

// Certificates is the self-signed certificate the page is served with. It is
// kept in the database, so a browser that was told to trust it keeps
// trusting it after a restart, and is replaced shortly before it ends.
type Certificates struct {
	db *sql.DB
	// now is time.Now, but for the tests.
	now func() time.Time

	mu      sync.Mutex
	current *tls.Certificate
	// failed is when a new certificate could not be kept, so the current one,
	// still valid, is served until renewRetry later.
	failed time.Time
}

// OpenCertificates returns the certificate kept in db, making one when there
// is none yet or the one kept ends soon.
func OpenCertificates(ctx context.Context, db *sql.DB) (*Certificates, error) {
	if _, err := db.ExecContext(ctx, certificateSchema); err != nil {
		return nil, err
	}
	c := &Certificates{db: db, now: time.Now}
	var der, key []byte
	err := db.QueryRowContext(ctx, `SELECT certificate, key FROM status_certificate WHERE id = 1`).Scan(&der, &key)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if err == nil {
		if cert, err := parseCertificate(der, key); err == nil {
			c.current = cert
		}
	}
	if _, err := c.certificate(ctx); err != nil {
		return nil, err
	}
	return c, nil
}

// GetCertificate is for tls.Config: the certificate, replaced first when it
// ends soon.
func (c *Certificates) GetCertificate(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
	ctx := hello.Context()
	if ctx == nil {
		// A ClientHelloInfo made outside crypto/tls has none.
		ctx = context.Background()
	}
	return c.certificate(ctx)
}

// Fingerprint is the SHA-256 of the certificate, as pairs of hex digits
// split by colons, as browsers show it, so a visitor can tell it is this
// hub's before trusting it.
func (c *Certificates) Fingerprint() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.current == nil {
		return ""
	}
	return fingerprint(c.current.Certificate[0])
}

func (c *Certificates) certificate(ctx context.Context) (*tls.Certificate, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	if c.current != nil && now.Before(c.current.Leaf.NotAfter.Add(-renewBefore)) {
		return c.current, nil
	}
	valid := c.current != nil && now.Before(c.current.Leaf.NotAfter)
	if valid && now.Before(c.failed.Add(renewRetry)) {
		return c.current, nil
	}
	der, key, err := makeCertificate(now)
	if err != nil {
		return nil, err
	}
	cert, err := parseCertificate(der, key)
	if err != nil {
		return nil, err
	}
	if _, err := c.db.ExecContext(ctx, `INSERT OR REPLACE INTO status_certificate (id, certificate, key) VALUES (1, ?, ?)`, der, key); err != nil {
		if valid {
			// Visitors keep the certificate they know until a new one is kept.
			slog.Warn("could not keep a new certificate for the status page, so the current one stays until it can", "ends", c.current.Leaf.NotAfter, "error", err)
			c.failed = now
			return c.current, nil
		}
		return nil, fmt.Errorf("keep the status page's certificate: %w", err)
	}
	c.current = cert
	return cert, nil
}

// makeCertificate makes a self-signed certificate, valid from an hour before
// now, for clocks that are a little behind, for certificateLife.
func makeCertificate(now time.Time) (der, key []byte, err error) {
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 127))
	if err != nil {
		return nil, nil, err
	}
	template := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: "den-watcher status page"},
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.Add(certificateLife),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	der, err = x509.CreateCertificate(rand.Reader, template, template, &private.PublicKey, private)
	if err != nil {
		return nil, nil, err
	}
	key, err = x509.MarshalPKCS8PrivateKey(private)
	if err != nil {
		return nil, nil, err
	}
	return der, key, nil
}

func parseCertificate(der, key []byte) (*tls.Certificate, error) {
	leaf, err := x509.ParseCertificate(der)
	if err != nil {
		return nil, err
	}
	private, err := x509.ParsePKCS8PrivateKey(key)
	if err != nil {
		return nil, err
	}
	return &tls.Certificate{Certificate: [][]byte{der}, PrivateKey: private, Leaf: leaf}, nil
}

func fingerprint(der []byte) string {
	sum := sha256.Sum256(der)
	pairs := make([]string, len(sum))
	for i, b := range sum {
		pairs[i] = fmt.Sprintf("%02X", b)
	}
	return strings.Join(pairs, ":")
}
