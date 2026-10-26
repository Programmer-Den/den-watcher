// Package addons runs an add-on of den-watcher: a separate program that
// every few seconds reads values den-watcher itself does not and writes
// them as extras to the add-on folder, which den-watcher shows on its page
// and a hub keeps in its history. Each add-on is a package below this one
// with its own command in cmd/den-watcher-<name>.
package addons

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/winservice"
)

// Interval is how often an add-on reads, as often as den-watcher reads the
// rest.
const Interval = 5 * time.Second

// ProgramInterval is how often an add-on starts another program, such as
// nvidia-smi or vcgencmd, using its last answer in between. Starting a
// process costs far more than the file reads of other values, and the
// history keeps one average a minute, which a value every half minute still
// fills.
const ProgramInterval = 30 * time.Second

// Due reports whether what was last done at last is due again at now, to be
// done every interval. Reads come every Interval, a little earlier or later
// each time, so it is due half an Interval before the interval is over:
// otherwise a read that came a moment early would put it off for another
// whole Interval.
func Due(last, now time.Time, interval time.Duration) bool {
	return last.IsZero() || now.Sub(last) >= interval-Interval/2
}

// Read returns an add-on's extras at now. now keeps Go's monotonic clock
// reading, so the time between two reads, which rates are worked out over,
// does not jump when the wall clock is set.
type Read func(ctx context.Context, now time.Time) []metrics.Extra

// ReadReport returns an add-on's report at now, as Read does its extras, for
// an add-on that reports more than extras. The report's Time and Own are set
// by the caller.
type ReadReport func(ctx context.Context, now time.Time) metrics.AddOnReport

// report returns the report of the extras read returns.
func (read Read) report(ctx context.Context, now time.Time) metrics.AddOnReport {
	return metrics.AddOnReport{Extras: read(ctx, now)}
}

// Main runs the add-on name, which reads with newRead: as the Windows service
// service when the service manager starts it, and everywhere else until it is
// interrupted. It writes ADDONS_DIR/<name>.json every Interval and exits the
// program when it fails. newRead is called once, when the add-on starts.
func Main(name, service string, newRead func() Read) {
	MainReport(name, service, func() ReadReport { return newRead().report })
}

// MainReport is Main for an add-on that reads its whole report with newRead.
func MainReport(name, service string, newRead func() ReadReport) {
	read := sync.OnceValue(newRead)
	start := func(ctx context.Context) error { return serve(ctx, name, read()) }
	// A service has no console, so its warnings go to the event log too.
	winservice.LogWarnings(service)
	ranAsService, err := winservice.Run(service, start, nil)
	if !ranAsService && err == nil {
		ctx, stop := signal.NotifyContext(context.Background(), stopSignals()...)
		err = start(ctx)
		stop()
	}
	if err != nil {
		// winservice.Run has written a service's error to the event log already.
		if !ranAsService {
			slog.Error("the add-on stopped", "add-on", name, "error", err)
		}
		os.Exit(1)
	}
}

// stopSignals are the signals an add-on outside the service manager stops on.
// Go turns a user logging off Windows into SIGTERM, which would stop a
// service for good, so a child of the den-watcher service, which has no
// console either and is started with EventLogVariable set, ignores it and
// stops when den-watcher ends it.
func stopSignals() []os.Signal {
	if os.Getenv(winservice.EventLogVariable) == "1" {
		return []os.Signal{os.Interrupt}
	}
	return []os.Signal{os.Interrupt, syscall.SIGTERM}
}

// Serve writes what read returns to the add-on folder until ctx is done, then
// removes the file, so den-watcher stops showing old values at once. It
// fails at once when the folder is missing, so the program exits and its
// service manager can start it again; a write that fails later is logged and
// tried again at the next interval.
func Serve(ctx context.Context, name string, read Read) error {
	return serve(ctx, name, read.report)
}

// serve is Serve for an add-on that reads its whole report.
func serve(ctx context.Context, name string, read ReadReport) error {
	dir := os.Getenv("ADDONS_DIR")
	if dir == "" {
		dir = DefaultDir()
	}
	if info, err := os.Stat(dir); err != nil { //nolint:gosec // the add-on folder its setting names
		return fmt.Errorf("the add-on folder: %w", err)
	} else if !info.IsDir() {
		return fmt.Errorf("the add-on folder %s is not a folder", dir)
	}
	file := filepath.Join(dir, name+".json")
	slog.Info("writing to the add-on folder", "file", file)
	run(ctx, read, file, Interval)
	if folder, err := openFolder(dir); err == nil {
		_ = folder.Remove(name + ".json")
		_ = folder.Close()
	}
	return nil
}

// DefaultDir is the add-on folder the installers set up.
func DefaultDir() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("ProgramData"), "Usage Control", "addons")
	}
	return "/run/den-watcher-addons"
}

// run writes a report, with what the add-on itself uses, every interval
// until ctx is done. A failed write is
// logged once and tried again at the next interval.
func run(ctx context.Context, read ReadReport, file string, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	var own metrics.OwnReader
	failing := false
	for {
		// time.Now, not time.Now().UTC(), which drops the monotonic reading.
		now := time.Now()
		report := read(ctx, now)
		report.Time, report.Own = now.UTC(), own.Read(ctx, now)
		err := writeReport(file, report)
		switch {
		case err != nil && !failing:
			slog.Error("write the add-on's report", "file", file, "error", err)
		case err == nil && failing:
			slog.Info("writing the add-on's report works again", "file", file)
		}
		failing = err != nil
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// writeReport writes report to file through its folder, unless that folder is
// one add-ons do not write to (see openFolder).
func writeReport(file string, report metrics.AddOnReport) error {
	folder, err := openFolder(filepath.Dir(file))
	if err != nil {
		return err
	}
	defer func() { _ = folder.Close() }()
	return metrics.WriteAddOnReport(folder, filepath.Base(file), report)
}

// readFailures holds the files whose failed read WarnRead has logged.
var readFailures sync.Map

// WarnRead logs err, the failure to read the file at path, the first time a
// read of that file fails for another reason than that it does not exist,
// such as a file only root may read. A missing file is what a machine
// without the hardware or the kernel feature has, and stays silent; the
// add-on leaves the file's values out either way.
func WarnRead(path string, err error) {
	if err == nil || errors.Is(err, fs.ErrNotExist) {
		return
	}
	if _, logged := readFailures.LoadOrStore(path, true); !logged {
		slog.Warn("a file the add-on reads cannot be read, so its values are left out", "file", path, "error", err)
	}
}
