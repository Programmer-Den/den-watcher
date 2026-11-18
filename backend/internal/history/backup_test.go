package history

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBackupCopiesTheDatabaseNextToIt(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store, err := Open(ctx, filepath.Join(dir, "den-watcher.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer func() { _ = store.Close() }()
	at := time.Unix(1_700_000_000, 0)
	if err := store.Add(ctx, LocalDevice, at, map[string]float64{"cpu": 42}); err != nil {
		t.Fatalf("Add() error = %v", err)
	}

	path, err := store.Backup(ctx)
	if err != nil {
		t.Fatalf("Backup() error = %v", err)
	}

	if filepath.Dir(path) != dir {
		t.Errorf("Backup() = %s, want a file in %s, next to the database", path, dir)
	}
	// Opened under another name, as Open deletes backups left in its folder.
	renamed := filepath.Join(t.TempDir(), "den-watcher-2026-10-13.db")
	if err := os.Rename(path, renamed); err != nil {
		t.Fatal(err)
	}
	copied, err := Open(ctx, renamed)
	if err != nil {
		t.Fatalf("Open() of the backup error = %v", err)
	}
	defer func() { _ = copied.Close() }()
	series, err := copied.Range(ctx, LocalDevice, at, at.Add(time.Minute), time.Minute)
	if err != nil || len(series) != 1 || series[0].Points[0].Value != 42 {
		t.Errorf("Range() of the backup = %v, %v; want the value added before", series, err)
	}
}

func TestBackupOfAFolderThatIsGoneFails(t *testing.T) {
	ctx := context.Background()
	dir := filepath.Join(t.TempDir(), "data")
	if err := os.Mkdir(dir, 0o750); err != nil {
		t.Fatal(err)
	}
	store, err := Open(ctx, filepath.Join(dir, "den-watcher.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer func() { _ = store.Close() }()
	store.path = filepath.Join(dir, "gone", "den-watcher.db")

	if path, err := store.Backup(ctx); err == nil {
		t.Errorf("Backup() = %s, want an error for a folder that does not exist", path)
	}
}

func TestAFailedBackupLeavesNoFile(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(context.Background(), filepath.Join(dir, "den-watcher.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer func() { _ = store.Close() }()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if path, err := store.Backup(ctx); err == nil {
		t.Errorf("Backup() with a cancelled context = %s, want an error", path)
	}
	if left, _ := filepath.Glob(filepath.Join(dir, backupPattern)); len(left) > 0 {
		t.Errorf("a failed Backup() left %v", left)
	}
}

func TestOpenDeletesBackupsLeftFromBefore(t *testing.T) {
	dir := t.TempDir()
	left := filepath.Join(dir, ".den-watcher-backup-123.db")
	other := filepath.Join(dir, "den-watcher.db.backup")
	for _, file := range []string{left, other} {
		if err := os.WriteFile(file, []byte("copy"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	store, err := Open(context.Background(), filepath.Join(dir, "den-watcher.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer func() { _ = store.Close() }()

	if _, err := os.Stat(left); !os.IsNotExist(err) {
		t.Errorf("a backup left from before is still there (%v); Open should delete it", err)
	}
	if _, err := os.Stat(other); err != nil {
		t.Errorf("the copy made before an update to the layout is gone (%v); Open should keep it", err)
	}
}
