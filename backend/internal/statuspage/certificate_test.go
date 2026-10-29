package statuspage

import (
	"context"
	"crypto/tls"
	"database/sql"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "status.db"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestTheCertificateIsKeptAcrossRestarts(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t)
	first, err := OpenCertificates(ctx, db)
	if err != nil {
		t.Fatalf("OpenCertificates() error = %v", err)
	}
	again, err := OpenCertificates(ctx, db)
	if err != nil {
		t.Fatalf("OpenCertificates() again: error = %v", err)
	}
	if first.Fingerprint() == "" || again.Fingerprint() != first.Fingerprint() {
		t.Errorf("fingerprints %q and %q, want the same one kept", first.Fingerprint(), again.Fingerprint())
	}
	if len(first.Fingerprint()) != 32*3-1 {
		t.Errorf("Fingerprint() = %q, want 32 pairs of hex digits split by colons", first.Fingerprint())
	}
}

func TestTheCertificateIsReplacedBeforeItEnds(t *testing.T) {
	ctx := context.Background()
	certs, err := OpenCertificates(ctx, openTestDB(t))
	if err != nil {
		t.Fatalf("OpenCertificates() error = %v", err)
	}
	old := certs.Fingerprint()
	certs.now = func() time.Time { return time.Now().Add(certificateLife - renewBefore) }
	cert, err := certs.GetCertificate(&tls.ClientHelloInfo{})
	if err != nil {
		t.Fatalf("GetCertificate() error = %v", err)
	}
	if certs.Fingerprint() == old {
		t.Error("the certificate was kept although it ends soon")
	}
	if !cert.Leaf.NotAfter.After(certs.now().Add(renewBefore)) {
		t.Errorf("the new certificate ends %v, too soon", cert.Leaf.NotAfter)
	}
}

func TestTheCertificateStaysWhenANewOneCannotBeKept(t *testing.T) {
	ctx := context.Background()
	db := openTestDB(t)
	certs, err := OpenCertificates(ctx, db)
	if err != nil {
		t.Fatalf("OpenCertificates() error = %v", err)
	}
	old := certs.Fingerprint()
	if _, err := db.ExecContext(ctx, `DROP TABLE status_certificate`); err != nil {
		t.Fatalf("drop the table: %v", err)
	}
	certs.now = func() time.Time { return time.Now().Add(certificateLife - renewBefore) }
	if _, err := certs.GetCertificate(&tls.ClientHelloInfo{}); err != nil {
		t.Fatalf("GetCertificate() error = %v, want the current certificate", err)
	}
	if certs.Fingerprint() != old {
		t.Error("the certificate was replaced by one that could not be kept")
	}
}

func TestThePageIsServedOverTLSOnly(t *testing.T) {
	ctx := context.Background()
	certs, err := OpenCertificates(ctx, openTestDB(t))
	if err != nil {
		t.Fatalf("OpenCertificates() error = %v", err)
	}
	listener, err := Listen("127.0.0.1:0", certs)
	if err != nil {
		t.Fatalf("Listen() error = %v", err)
	}
	page := New(func() []Device { return nil }, &fakePassword{word: "correct horse"})
	srv := NewServer(page)
	go func() { _ = srv.Serve(listener) }()
	t.Cleanup(func() { _ = srv.Close() })

	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}} //nolint:gosec // the test's own self-signed certificate
	response, err := client.Get("https://" + listener.Addr().String() + "/")
	if err != nil {
		t.Fatalf("GET over TLS: %v", err)
	}
	body, _ := io.ReadAll(response.Body)
	_ = response.Body.Close()
	if response.StatusCode != http.StatusOK || !strings.Contains(string(body), `name="password"`) {
		t.Errorf("GET over TLS = %d, want the sign-in form; body %s", response.StatusCode, body)
	}
	if got := fingerprint(response.TLS.PeerCertificates[0].Raw); got != certs.Fingerprint() {
		t.Errorf("served certificate %s, want %s", got, certs.Fingerprint())
	}

	plain, err := http.Get("http://" + listener.Addr().String() + "/")
	if err == nil {
		_ = plain.Body.Close()
		if plain.StatusCode == http.StatusOK {
			t.Error("GET over plain HTTP = 200, want it refused")
		}
	}
}
