package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
)

// oldDatabaseName is what the database file was called up to 4.0.0, and
// oldDataFolder the Windows data folder in ProgramData, now newDataFolder.
const (
	newDatabaseName = "den-watcher.db"
	oldDatabaseName = "usage-control.db"
	newDataFolder   = "Den-Watcher" // as addons.DefaultDir
	oldDataFolder   = "Usage Control"
)

// renameOldDatabase renames the database a release up to 4.0.0 kept under
// its old name to path, as long as path is called den-watcher.db and does
// not exist yet: the one next to path, or on Windows (where programData is
// the ProgramData folder, else empty) the one in the old data folder, which
// also gives up the encrypted router passwords and is deleted once nothing
// else is left in it. It returns the database to open: path, or the old
// one, kept where it is for now, when it could not be renamed, so den-watcher
// still starts with its history and tries again at its next start.
func renameOldDatabase(path, programData string) string {
	if filepath.Base(path) != newDatabaseName {
		return path
	}
	dir := filepath.Dir(path)
	oldDir := dir
	// Windows compares paths regardless of case.
	windowsFolder := programData != "" && strings.EqualFold(filepath.Clean(dir), filepath.Join(programData, newDataFolder))
	if windowsFolder {
		oldDir = filepath.Join(programData, oldDataFolder)
		if _, err := os.Stat(oldDir); err != nil { //nolint:gosec // ProgramData, set by Windows
			return path
		}
	}
	old := filepath.Join(oldDir, oldDatabaseName)
	if err := renameDatabaseFile(old, path); err != nil {
		slog.Warn("could not rename the database of 4.0.0 and before, so it is used under its old name for now", "from", old, "to", path, "error", err)
		return old
	}
	if windowsFolder {
		// The router passwords, encrypted for the service's account, which
		// did not change; ones already in the new folder stay.
		// router.protectedFile, Windows only
		passwords := "router-passwords.dpapi"
		if _, err := os.Stat(filepath.Join(dir, passwords)); errors.Is(err, fs.ErrNotExist) { //nolint:gosec // ProgramData, set by Windows
			if err := moveFile(filepath.Join(oldDir, passwords), filepath.Join(dir, passwords)); err != nil {
				slog.Warn("could not move the router passwords of 4.0.0 and before", "from", oldDir, "error", err)
				return path
			}
		}
		// Once the database moved, what is left are the add-ons' reports,
		// written again in the new folder, and backups that are no longer
		// needed; the old folder goes once it is empty.
		if _, err := os.Stat(old); !errors.Is(err, fs.ErrNotExist) { //nolint:gosec // ProgramData, set by Windows
			return path
		}
		leftovers, _ := filepath.Glob(filepath.Join(oldDir, "addons", "*"))
		backups, _ := filepath.Glob(filepath.Join(oldDir, ".den-watcher-backup-*.db"))
		for _, file := range append(append(leftovers, backups...), old+".backup") {
			_ = os.Remove(file) //nolint:gosec // ProgramData, set by Windows
		}
		_ = os.Remove(filepath.Join(oldDir, "addons")) //nolint:gosec // ProgramData, set by Windows
		if err := os.Remove(oldDir); err != nil {      //nolint:gosec // ProgramData, set by Windows
			slog.Warn("the data folder of 4.0.0 and before is left, as something else is still in it", "folder", oldDir)
		}
	}
	return path
}

// renameDatabaseFile renames the database old to path, with its backup,
// unless path exists or old does not. What the write-ahead log holds is
// written into the database first, which also makes sure no other program
// has it open, so the rename moves one file and cannot be cut short
// halfway; a log and index left under the new name belong to no database
// and are deleted before.
func renameDatabaseFile(old, path string) error {
	_, oldErr := os.Stat(old)                //nolint:gosec // DATABASE_PATH or ProgramData, set by whoever runs the program
	if _, err := os.Stat(path); err == nil { //nolint:gosec // DATABASE_PATH, set by whoever runs the program
		if oldErr == nil {
			slog.Warn("both databases are there, so the one of 4.0.0 and before is left unused; delete it once it is not needed", "unused", old, "used", path)
		}
		return nil
	} else if !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	if errors.Is(oldErr, fs.ErrNotExist) {
		return nil
	} else if oldErr != nil {
		return oldErr
	}
	if err := history.Checkpoint(context.Background(), old); err != nil {
		return fmt.Errorf("write the log of %s into it: %w", old, err)
	}
	for _, suffix := range []string{"-wal", "-shm"} {
		if err := os.Remove(path + suffix); err != nil && !errors.Is(err, fs.ErrNotExist) { //nolint:gosec // DATABASE_PATH, set by whoever runs the program
			return err
		}
	}
	if _, err := os.Stat(path + ".backup"); errors.Is(err, fs.ErrNotExist) { //nolint:gosec // DATABASE_PATH, set by whoever runs the program
		if err := moveFile(old+".backup", path+".backup"); err != nil {
			return err
		}
	}
	if err := os.Rename(old, path); err != nil { //nolint:gosec // DATABASE_PATH, set by whoever runs the program
		return err
	}
	slog.Info("renamed the database to its new name", "from", old, "to", path)
	return nil
}

// moveFile renames from to to; a missing from is nothing to move.
func moveFile(from, to string) error {
	err := os.Rename(from, to) //nolint:gosec // DATABASE_PATH, set by whoever runs the program
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}
