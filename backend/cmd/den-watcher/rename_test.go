package main

import (
	"database/sql"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

// writeFiles writes each file in dir, holding its own name.
func writeFiles(t *testing.T, dir string, names ...string) {
	t.Helper()
	for _, name := range names {
		if err := os.MkdirAll(filepath.Dir(filepath.Join(dir, name)), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), []byte(name), 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

// oldDatabase makes the database of 4.0.0 in dir, usage-control.db, with
// a row that is still only in its write-ahead log, as when it stopped
// without a checkpoint.
func oldDatabase(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	made := filepath.Join(t.TempDir(), "made.db")
	db, err := sql.Open("sqlite", "file:"+made+"?_pragma=journal_mode(WAL)")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	db.SetMaxOpenConns(1)
	for _, statement := range []string{
		"PRAGMA wal_autocheckpoint=0",
		"CREATE TABLE kept (value TEXT)",
		"INSERT INTO kept VALUES ('history')",
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	// Copied while open, so the row is in the log only.
	for _, suffix := range []string{"", "-wal"} {
		data, err := os.ReadFile(made + suffix)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, oldDatabaseName+suffix), data, 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

// keptRow reads the row oldDatabase wrote from the database at path.
func keptRow(t *testing.T, path string) string {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+path+"?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	var value string
	if err := db.QueryRow("SELECT value FROM kept").Scan(&value); err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return value
}

func TestRenamesTheDatabaseUpTo400(t *testing.T) {
	dir := t.TempDir()
	oldDatabase(t, dir)
	writeFiles(t, dir, oldDatabaseName+".backup")
	path := filepath.Join(dir, "den-watcher.db")
	if got := renameOldDatabase(path, ""); got != path {
		t.Fatalf("renameOldDatabase = %s, want the new path", got)
	}
	if got := keptRow(t, path); got != "history" {
		t.Errorf("den-watcher.db holds %q, want what the old log held", got)
	}
	if got, _ := os.ReadFile(path + ".backup"); string(got) != oldDatabaseName+".backup" {
		t.Errorf("den-watcher.db.backup = %q, want the old backup", got)
	}
	for _, suffix := range []string{"", "-wal", "-shm", ".backup"} {
		if _, err := os.Stat(filepath.Join(dir, oldDatabaseName+suffix)); !errors.Is(err, fs.ErrNotExist) {
			t.Errorf("%s%s is still there", oldDatabaseName, suffix)
		}
	}
}

func TestDropsALogLeftUnderTheNewName(t *testing.T) {
	dir := t.TempDir()
	oldDatabase(t, dir)
	// A log of a database deleted since, which must not be read into it.
	writeFiles(t, dir, "den-watcher.db-wal", "den-watcher.db-shm")
	path := filepath.Join(dir, "den-watcher.db")
	if got := renameOldDatabase(path, ""); got != path {
		t.Fatalf("renameOldDatabase = %s, want the new path", got)
	}
	if got := keptRow(t, path); got != "history" {
		t.Errorf("den-watcher.db holds %q, want the old history", got)
	}
}

func TestKeepsTheDatabaseThatHasTheNewName(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, oldDatabaseName, "den-watcher.db")
	path := filepath.Join(dir, "den-watcher.db")
	if got := renameOldDatabase(path, ""); got != path {
		t.Fatalf("renameOldDatabase = %s, want the new path", got)
	}
	if got, _ := os.ReadFile(path); string(got) != "den-watcher.db" {
		t.Errorf("den-watcher.db = %q, want it kept", got)
	}
	// A database with another name is left alone.
	other := t.TempDir()
	writeFiles(t, other, oldDatabaseName)
	if got := renameOldDatabase(filepath.Join(other, "mine.db"), ""); got != filepath.Join(other, "mine.db") {
		t.Fatalf("renameOldDatabase = %s, want the new path", got)
	}
	if _, err := os.Stat(filepath.Join(other, "mine.db")); !errors.Is(err, fs.ErrNotExist) {
		t.Error("renamed the old database to a path of another name")
	}
}

func TestMovesTheWindowsDataFolderUpTo400(t *testing.T) {
	programData := t.TempDir()
	old := filepath.Join(programData, oldDataFolder)
	oldDatabase(t, old)
	writeFiles(t, old, "router-passwords.dpapi", filepath.Join("addons", "power.json"))
	dir := filepath.Join(programData, newDataFolder)
	if err := os.Mkdir(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if got := renameOldDatabase(filepath.Join(dir, "den-watcher.db"), programData); got != filepath.Join(dir, "den-watcher.db") {
		t.Fatalf("renameOldDatabase = %s, want the new path", got)
	}
	if got := keptRow(t, filepath.Join(dir, "den-watcher.db")); got != "history" {
		t.Errorf("den-watcher.db holds %q, want the old history", got)
	}
	if got, err := os.ReadFile(filepath.Join(dir, "router-passwords.dpapi")); err != nil || string(got) != "router-passwords.dpapi" {
		t.Errorf("router-passwords.dpapi = %q, %v; want the old one", got, err)
	}
	if _, err := os.Stat(old); !errors.Is(err, fs.ErrNotExist) {
		t.Error("the old data folder is still there")
	}
}

func TestMovesTheRouterPasswordsWithoutADatabase(t *testing.T) {
	programData := t.TempDir()
	old := filepath.Join(programData, oldDataFolder)
	writeFiles(t, old, "router-passwords.dpapi")
	dir := filepath.Join(programData, newDataFolder)
	if err := os.Mkdir(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if got := renameOldDatabase(filepath.Join(dir, "den-watcher.db"), programData); got != filepath.Join(dir, "den-watcher.db") {
		t.Fatalf("renameOldDatabase = %s, want the new path", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "router-passwords.dpapi")); err != nil {
		t.Errorf("the router passwords were not moved: %v", err)
	}
	if _, err := os.Stat(old); !errors.Is(err, fs.ErrNotExist) {
		t.Error("the old data folder is still there")
	}
}

func TestLeavesTheOldWindowsDataFolderWithSomethingElseInIt(t *testing.T) {
	programData := t.TempDir()
	old := filepath.Join(programData, oldDataFolder)
	oldDatabase(t, old)
	writeFiles(t, old, "notes.txt")
	dir := filepath.Join(programData, newDataFolder)
	writeFiles(t, dir, "router-passwords.dpapi")
	if got := renameOldDatabase(filepath.Join(dir, "den-watcher.db"), programData); got != filepath.Join(dir, "den-watcher.db") {
		t.Fatalf("renameOldDatabase = %s, want the new path", got)
	}
	if _, err := os.Stat(filepath.Join(old, "notes.txt")); err != nil {
		t.Errorf("the old folder lost a file of its own: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "den-watcher.db")); err != nil {
		t.Errorf("the database was not moved: %v", err)
	}
}

func TestKeepsTheOldDatabaseWhileAnotherProgramHasItOpen(t *testing.T) {
	dir := t.TempDir()
	oldDatabase(t, dir)
	old := filepath.Join(dir, oldDatabaseName)
	db, err := sql.Open("sqlite", "file:"+old)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	// A read that keeps the log from being written into the database.
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback() }()
	var value string
	if err := tx.QueryRow("SELECT value FROM kept").Scan(&value); err != nil {
		t.Fatal(err)
	}
	if got := renameOldDatabase(filepath.Join(dir, newDatabaseName), ""); got != old {
		t.Fatalf("renameOldDatabase = %s, want the old database, used where it is", got)
	}
	if _, err := os.Stat(filepath.Join(dir, newDatabaseName)); !errors.Is(err, fs.ErrNotExist) {
		t.Error("renamed the database another program has open")
	}
	if _, err := os.Stat(old + "-wal"); err != nil {
		t.Errorf("the old log is gone: %v", err)
	}
}

func TestKeepsTheOldDatabaseWhileAnotherProgramHasItOpenIdle(t *testing.T) {
	dir := t.TempDir()
	oldDatabase(t, dir)
	old := filepath.Join(dir, oldDatabaseName)
	db, err := sql.Open("sqlite", "file:"+old)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	// A connection that read once and stays open, outside a transaction.
	db.SetMaxOpenConns(1)
	var value string
	if err := db.QueryRow("SELECT value FROM kept").Scan(&value); err != nil {
		t.Fatal(err)
	}
	if got := renameOldDatabase(filepath.Join(dir, newDatabaseName), ""); got != old {
		t.Fatalf("renameOldDatabase = %s, want the old database, used where it is", got)
	}
	if _, err := os.Stat(filepath.Join(dir, newDatabaseName)); !errors.Is(err, fs.ErrNotExist) {
		t.Error("renamed the database another program has open")
	}
}
