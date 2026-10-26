package metrics

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"
)

// AddOnReport is what an add-on writes to its file in the add-on folder: the
// extras it read and when. An add-on is a separate program that tracks more
// than the collector does, such as the busiest processes, and runs with the
// rights it needs, so the collector itself stays small and unprivileged.
type AddOnReport struct {
	Time   time.Time `json:"time"`
	Extras []Extra   `json:"extras"`
	// Own is what the add-on itself uses of the machine, which the collector
	// adds to its own; an add-on that does not report it is not counted.
	Own *OwnUsage `json:"own,omitempty"`
	// WiFi is what the machine's Wi-Fi sees nearby, which only the Wi-Fi
	// add-on reports.
	WiFi *NearbyWiFi `json:"wifi,omitempty"`
}

const (
	// addOnStaleAfter is how old a report may be before it is left out, as
	// its add-on has stopped.
	addOnStaleAfter = 30 * time.Second
	// maxAddOnFileBytes is the largest report that is read.
	maxAddOnFileBytes = 256 << 10
)

// AddOns reads the reports add-ons write to one folder, each in a file of
// its own ending in .json.
type AddOns struct {
	// Dir is the folder; empty reads nothing.
	Dir string
	// MaxEntries is how many groups of extras, and values in each, are kept.
	MaxEntries int

	// mu guards failed, the files whose failure was logged, so a broken file
	// is logged once and not at every reading, and files, what was last read
	// from each file.
	mu     sync.Mutex
	failed map[string]bool
	files  map[string]addOnFile
}

// addOnFile is what was read from a report file, and the modification time
// and size the file had then: while both stay the same, the file is not read
// again.
type addOnFile struct {
	modified time.Time
	size     int64
	report   AddOnReport
	err      error
}

// Read returns the extras of every report that is not older than
// addOnStaleAfter, in the order of the file names, cut down like another
// device's extras by CleanExtras; see addOnFile.fresh. A file is read again only once its modification
// time or size has changed.
func (a *AddOns) Read(now time.Time) []Extra {
	if a == nil || a.Dir == "" {
		return nil
	}
	files, err := filepath.Glob(filepath.Join(a.Dir, "*.json"))
	if err != nil {
		return nil
	}
	slices.Sort(files)
	a.mu.Lock()
	defer a.mu.Unlock()
	read := make(map[string]addOnFile, len(files))
	var extras []Extra
	for _, file := range files {
		f := readAddOnReport(file, a.files[file])
		read[file] = f
		a.logOnce(file, f.err)
		if !f.fresh(now) {
			continue
		}
		extras = append(extras, f.report.Extras...)
	}
	a.files = read
	return CleanExtras(extras, a.MaxEntries)
}

// Own returns what each add-on whose report the last Read kept uses of the
// machine, for the add-ons that report it.
func (a *AddOns) Own(now time.Time) []OwnUsage {
	if a == nil {
		return nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	files := slices.Sorted(maps.Keys(a.files))
	var usages []OwnUsage
	for _, file := range files {
		if f := a.files[file]; f.fresh(now) && f.report.Own != nil {
			usages = append(usages, *f.report.Own)
		}
	}
	return usages
}

// WiFi returns what the machine's Wi-Fi sees nearby, from the first report
// the last Read kept that has it, cut down like another device's by
// CleanNearbyWiFi; nil when none has.
func (a *AddOns) WiFi(now time.Time) *NearbyWiFi {
	if a == nil {
		return nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, file := range slices.Sorted(maps.Keys(a.files)) {
		if f := a.files[file]; f.fresh(now) && f.report.WiFi != nil {
			return CleanNearbyWiFi(f.report.WiFi)
		}
	}
	return nil
}

// fresh reports whether the report was read and is not older than
// addOnStaleAfter at now. A report from further in the future is not fresh
// either: it was written before the clock was set back, so its add-on may
// have stopped long ago.
func (f addOnFile) fresh(now time.Time) bool {
	return f.err == nil && now.Sub(f.report.Time) <= addOnStaleAfter && f.report.Time.Sub(now) <= addOnStaleAfter
}

// readAddOnReport reads a report file, or returns last again when the file
// has the modification time and size it had when last was read.
func readAddOnReport(file string, last addOnFile) addOnFile {
	// Add-ons rename a regular file into place. Anything else is not opened:
	// opening a named pipe would wait until something writes to it, and hold
	// up every reading of this device meanwhile.
	info, err := os.Stat(file)
	if err != nil {
		return addOnFile{err: err}
	}
	if !info.Mode().IsRegular() {
		return addOnFile{err: errors.New("the report is not a regular file")}
	}
	read := addOnFile{modified: info.ModTime(), size: info.Size()}
	if !last.modified.IsZero() && read.modified.Equal(last.modified) && read.size == last.size {
		return last
	}
	// file is a .json file in the add-on folder, which the ADDONS_DIR setting names.
	f, err := os.Open(file) //nolint:gosec // see above
	if err != nil {
		return addOnFile{err: err}
	}
	defer func() { _ = f.Close() }()
	data, err := io.ReadAll(io.LimitReader(f, maxAddOnFileBytes+1))
	if err != nil {
		read.err = err
		return read
	}
	if len(data) > maxAddOnFileBytes {
		read.err = errors.New("the report is larger than 256 KiB")
		return read
	}
	read.err = json.Unmarshal(data, &read.report)
	return read
}

// logOnce logs a file's failure the first time, and when it works again. The
// caller holds a.mu.
func (a *AddOns) logOnce(file string, err error) {
	if a.failed == nil {
		a.failed = map[string]bool{}
	}
	switch {
	case err != nil && !a.failed[file]:
		a.failed[file] = true
		slog.Warn("read an add-on's report", "file", file, "error", err)
	case err == nil && a.failed[file]:
		delete(a.failed, file)
		slog.Info("an add-on's report can be read again", "file", file)
	}
}

// WriteAddOnReport writes an add-on's report as name in folder so a reader
// never sees half of it: to a temporary file next to it first, which then
// replaces it. Each step goes through folder, which stays the folder it was
// opened as even when its path is changed meanwhile.
func WriteAddOnReport(folder *os.Root, name string, report AddOnReport) error {
	data, err := json.Marshal(report)
	if err != nil {
		return err
	}
	temporaryName := ".report-" + rand.Text()
	temporary, err := folder.OpenFile(temporaryName, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	defer func() { _ = folder.Remove(temporaryName) }()
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return err
	}
	// The collector may run as another user, which has to read it.
	if err := temporary.Chmod(0o644); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	// Windows refuses to replace a file while another program has it open,
	// as the collector has for a moment while it reads it, so a failed
	// replace is tried again a few times.
	for try := 1; ; try++ {
		err := folder.Rename(temporaryName, name)
		if err == nil || try == renameTries {
			return err
		}
		time.Sleep(renameRetryDelay)
	}
}

// renameTries is how often WriteAddOnReport tries to replace the report, and
// renameRetryDelay how long it waits between tries; reading a report takes
// far less.
const (
	renameTries      = 5
	renameRetryDelay = 20 * time.Millisecond
)
