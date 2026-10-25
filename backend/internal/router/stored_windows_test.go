package router

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
)

func TestDPAPIRoundTrip(t *testing.T) {
	plain := formatPasswords(map[string]string{"Router": "se=cret ", "Box": "x"})
	encrypted, err := dpapi(plain, true)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(encrypted, []byte("se=cret")) {
		t.Error("the password is in the encrypted data")
	}
	decrypted, err := dpapi(encrypted, false)
	if err != nil || !bytes.Equal(decrypted, plain) {
		t.Fatalf("got %q, %v", decrypted, err)
	}
}

func TestStoredPasswordsReadsTheEncryptedFile(t *testing.T) {
	dir := t.TempDir()
	encrypted, err := dpapi(formatPasswords(map[string]string{"Router": "secret"}), true)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, protectedFile), encrypted, 0o600); err != nil {
		t.Fatal(err)
	}
	passwords, stored, err := StoredPasswords(dir, hub.IDOf)
	if err != nil || !stored || passwords["router"] != "secret" {
		t.Errorf("got %v, %v, %v", passwords, stored, err)
	}
	if _, stored, err := StoredPasswords(t.TempDir(), hub.IDOf); err != nil || stored {
		t.Errorf("an empty folder: %v, %v", stored, err)
	}
}

func TestStoredPasswordsTakeTheLastOneForARouter(t *testing.T) {
	dir := t.TempDir()
	// Written by a version that kept both names.
	encrypted, err := dpapi([]byte("Router=old\nrouter=new\n"), true)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, protectedFile), encrypted, 0o600); err != nil {
		t.Fatal(err)
	}
	passwords, _, err := StoredPasswords(dir, hub.IDOf)
	if err != nil || passwords["router"] != "new" || len(passwords) != 1 {
		t.Errorf("got %q, %v; want only router=new", passwords, err)
	}
}
