package addons

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/winservice"
)

// Children are the add-ons the den-watcher service on Windows starts, through
// the add-on host (see StartHost), so Task Manager shows them under
// den-watcher.exe and they stop with it. They run in the service's own
// low-privilege account, as they did as services of their own. The smart add-on is not one of them: it
// needs LocalSystem, which a child of a Local Service process cannot get, so
// it stays a service of its own.
var Children = []string{"power", "gpu", "pressure", "kernel", "wifi", "memory", "ports", "processes", "bluetooth"}

// childRetryDelay is how long den-watcher waits before it starts an add-on
// again that stopped on its own. Each further stop in a row doubles the wait,
// up to maxChildRetryDelay, as the service manager did for the add-on
// services; an add-on that ran for maxChildRetryDelay starts over.
const (
	childRetryDelay    = 10 * time.Second
	maxChildRetryDelay = 5 * time.Minute
)

// HostArgument is the argument that makes den-watcher the add-on host: a
// second den-watcher.exe, started by the service, that starts the add-ons
// as its own children (RunHost). Task Manager groups the processes a program
// started under it only once one of them is the program itself, so without
// the host it lists every add-on on its own line.
const HostArgument = "addons"

// StartHost starts the running program again with HostArgument when any add-on
// of Children is installed next to it, and starts it again whenever it stops.
// The returned function ends the host, which ends the add-ons with it, waits
// until it has ended and removes the add-ons' reports from the add-on folder
// dir, as a killed add-on cannot.
func StartHost(dir string) (stop func()) {
	if dir == "" {
		dir = DefaultDir()
	}
	exe, err := os.Executable()
	if err != nil {
		slog.Error("the add-ons are not started, as the program's folder is unknown", "error", err)
		return func() {}
	}
	if len(installedChildren(exe)) == 0 {
		return func() {}
	}
	return startHost(dir, exe, []string{HostArgument}, append([]string{hostReport}, Children...), childRetryDelay, maxChildRetryDelay)
}

// hostReport is the name of the add-on host's report, which holds no values,
// only what the host itself uses, so den-watcher counts it with the add-ons.
const hostReport = "host"

// startHost runs program with args as StartHost does, and removes the
// reports of the add-ons names once it has ended it.
func startHost(dir, program string, args, names []string, retryDelay, maxRetryDelay time.Duration) (stop func()) {
	keep, err := newChildGroup()
	if err != nil {
		// The host still runs, but may outlive a den-watcher that crashes.
		slog.Warn("the add-on host is not tied to den-watcher's lifetime", "error", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		superviseChild(ctx, "the add-on host", retryDelay, maxRetryDelay, func(ctx context.Context) error {
			return runChild(ctx, program, args, keep)
		})
	}()
	return func() {
		cancel()
		<-done
		keep.close()
		for _, name := range names {
			removeReport(dir, name)
		}
	}
}

// RunHost is the add-on host: it starts each add-on of Children installed
// next to the running program, as den-watcher-<name>.exe, starts it again
// whenever it stops, and runs until den-watcher ends it, which ends the
// add-ons too. The installer puts only the add-ons picked at setup there.
func RunHost(dir string) {
	if dir == "" {
		dir = DefaultDir()
	}
	if exe, err := os.Executable(); err != nil {
		slog.Error("the add-ons are not started, as the program's folder is unknown", "error", err)
	} else {
		startChildren(dir, installedChildren(exe), childRetryDelay, maxChildRetryDelay)
	}
	go func() {
		noValues := func(context.Context, time.Time) []metrics.Extra { return nil }
		if err := Serve(context.Background(), hostReport, noValues); err != nil {
			slog.Warn("what the add-on host uses is not counted", "error", err)
		}
	}()
	// Go turns a user logging off Windows into SIGTERM, which would end the
	// host and the add-ons until den-watcher started it again.
	terms := make(chan os.Signal, 1)
	signal.Notify(terms, syscall.SIGTERM)
	for range terms {
		// Ignored: den-watcher ends the host.
	}
}

// installedChildren are the programs of the add-ons of Children installed
// next to exe.
func installedChildren(exe string) []string {
	var programs []string
	for _, name := range Children {
		program := filepath.Join(filepath.Dir(exe), "den-watcher-"+name+".exe")
		if _, err := os.Stat(program); err == nil {
			programs = append(programs, program)
		}
	}
	return programs
}

// startChildren runs each of programs, an add-on named den-watcher-<name>
// with an optional extension, as RunHost does. The returned function stops
// them, waits until they have ended and removes their reports from the
// add-on folder dir, as a killed add-on cannot.
func startChildren(dir string, programs []string, retryDelay, maxRetryDelay time.Duration) (stop func()) {
	if len(programs) == 0 {
		return func() {}
	}
	keep, err := newChildGroup()
	if err != nil {
		// The add-ons still run, but may outlive a den-watcher that crashes.
		slog.Warn("the add-ons are not tied to den-watcher's lifetime", "error", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	for _, program := range programs {
		name := childName(program)
		wg.Go(func() {
			superviseChild(ctx, "the "+name+" add-on", retryDelay, maxRetryDelay, func(ctx context.Context) error {
				return runChild(ctx, program, nil, keep)
			})
			removeReport(dir, name)
		})
	}
	return func() {
		cancel()
		wg.Wait()
		keep.close()
	}
}

// childName is the add-on's name in program's file name,
// den-watcher-<name>.exe.
func childName(program string) string {
	base := filepath.Base(program)
	base = base[:len(base)-len(filepath.Ext(base))]
	return base[len("den-watcher-"):]
}

// runChild runs program with args until it ends or ctx is done, which kills
// it.
func runChild(ctx context.Context, program string, args []string, keep *childGroup) error {
	cmd := exec.CommandContext(ctx, program, args...) //nolint:gosec // den-watcher itself or an add-on next to it
	// A child of a service has no console either, so its warnings go to the
	// event log, as they did when it was a service of its own.
	cmd.Env = append(os.Environ(), winservice.EventLogVariable+"=1")
	detach(cmd)
	if err := cmd.Start(); err != nil {
		return err
	}
	if err := keep.add(cmd.Process); err != nil {
		slog.Warn("the program is not tied to den-watcher's lifetime", "program", program, "error", err)
	}
	return cmd.Wait()
}

// superviseChild calls run, which runs the program name names, until ctx is
// done, waiting retryDelay before it calls it again after it returned, twice
// as long after each further return in a row, up to maxRetryDelay. A run that
// lasted maxRetryDelay or longer starts the waits over.
func superviseChild(ctx context.Context, name string, retryDelay, maxRetryDelay time.Duration, run func(context.Context) error) {
	maxDelay := max(maxRetryDelay, retryDelay)
	delay := time.Duration(0)
	for {
		started := time.Now()
		err := run(ctx)
		if ctx.Err() != nil {
			return
		}
		if delay == 0 || time.Since(started) >= maxDelay {
			delay = retryDelay
		} else {
			delay = min(2*delay, maxDelay)
		}
		if err == nil {
			err = errors.New("it ended")
		}
		slog.Warn(fmt.Sprintf("%s stopped; starting it again in %s", name, delay), "error", err)
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
	}
}

// removeReport removes the report of the add-on name from the add-on folder
// dir, through the folder as the add-on itself would (see openFolder).
func removeReport(dir, name string) {
	folder, err := openFolder(dir)
	if err != nil {
		return
	}
	defer func() { _ = folder.Close() }()
	if err := folder.Remove(name + ".json"); err != nil && !errors.Is(err, os.ErrNotExist) {
		slog.Warn("remove the add-on's report", "add-on", name, "error", err)
	}
}
