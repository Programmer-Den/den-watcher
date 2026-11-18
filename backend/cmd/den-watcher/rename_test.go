package main

import (
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

func TestRenamesTheDatabaseUpTo400(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, oldDatabaseName, oldDatabaseName+"-wal", oldDatabaseName+".backup")
	path := filepath.Join(dir, "den-watcher.db")
	if err := renameOldDatabase(path, ""); err != nil {
		t.Fatal(err)
	}
	for _, suffix := range []string{"", "-wal", ".backup"} {
		got, err := os.ReadFile(path + suffix)
		if err != nil || string(got) != oldDatabaseName+suffix {
			t.Errorf("den-watcher.db%s = %q, %v; want the old file", suffix, got, err)
		}
		if _, err := os.Stat(filepath.Join(dir, oldDatabaseName+suffix)); !errors.Is(err, fs.ErrNotExist) {
			t.Errorf("%s%s is still there", oldDatabaseName, suffix)
		}
	}
	if _, err := os.Stat(path + "-shm"); !errors.Is(err, fs.ErrNotExist) {
		t.Error("made an index of the log that was not there")
	}
}

func TestFinishesARenameCutShort(t *testing.T) {
	dir := t.TempDir()
	// The log was renamed already, the database not yet.
	writeFiles(t, dir, oldDatabaseName, "den-watcher.db-wal")
	path := filepath.Join(dir, "den-watcher.db")
	if err := renameOldDatabase(path, ""); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(path); string(got) != oldDatabaseName {
		t.Errorf("den-watcher.db = %q, want the old database", got)
	}
	if got, _ := os.ReadFile(path + "-wal"); string(got) != "den-watcher.db-wal" {
		t.Errorf("den-watcher.db-wal = %q, want the log renamed before", got)
	}
}

func TestKeepsTheDatabaseThatHasTheNewName(t *testing.T) {
	dir := t.TempDir()
	writeFiles(t, dir, oldDatabaseName, "den-watcher.db")
	path := filepath.Join(dir, "den-watcher.db")
	if err := renameOldDatabase(path, ""); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(path); string(got) != "den-watcher.db" {
		t.Errorf("den-watcher.db = %q, want it kept", got)
	}
	// A database with another name is left alone.
	other := t.TempDir()
	writeFiles(t, other, oldDatabaseName)
	if err := renameOldDatabase(filepath.Join(other, "mine.db"), ""); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(other, "mine.db")); !errors.Is(err, fs.ErrNotExist) {
		t.Error("renamed the old database to a path of another name")
	}
}

func TestMovesTheWindowsDataFolderUpTo400(t *testing.T) {
	programData := t.TempDir()
	old := filepath.Join(programData, oldDataFolder)
	writeFiles(t, old, oldDatabaseName, oldDatabaseName+"-wal", "router-passwords.dpapi", filepath.Join("addons", "power.json"))
	dir := filepath.Join(programData, newDataFolder)
	if err := os.Mkdir(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := renameOldDatabase(filepath.Join(dir, "den-watcher.db"), programData); err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string]string{
		"den-watcher.db":         oldDatabaseName,
		"den-watcher.db-wal":     oldDatabaseName + "-wal",
		"router-passwords.dpapi": "router-passwords.dpapi",
	} {
		if got, err := os.ReadFile(filepath.Join(dir, name)); err != nil || string(got) != want {
			t.Errorf("%s = %q, %v; want %q", name, got, err, want)
		}
	}
	if _, err := os.Stat(old); !errors.Is(err, fs.ErrNotExist) {
		t.Error("the old data folder is still there")
	}
}

func TestLeavesTheOldWindowsDataFolderWithSomethingElseInIt(t *testing.T) {
	programData := t.TempDir()
	old := filepath.Join(programData, oldDataFolder)
	writeFiles(t, old, oldDatabaseName, "notes.txt")
	dir := filepath.Join(programData, newDataFolder)
	writeFiles(t, dir, "router-passwords.dpapi")
	if err := renameOldDatabase(filepath.Join(dir, "den-watcher.db"), programData); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(old, "notes.txt")); err != nil {
		t.Errorf("the old folder lost a file of its own: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "den-watcher.db")); err != nil {
		t.Errorf("the database was not moved: %v", err)
	}
}
