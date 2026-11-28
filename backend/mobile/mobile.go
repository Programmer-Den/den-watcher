// Package mobile runs den-watcher inside an Android app: the hub app builds
// it with gomobile bind into a library and starts the hub in its own process,
// so Android sees one app and does not stop the hub as a stray program. The
// phone app does not use it.
//
// Android has no /etc/resolv.conf and Go does not know its time zone, so the
// app passes both, read from Android, besides the settings.
package mobile

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/program"
)

// settingName is what a setting may be called: the names of the program's
// environment variables, such as DATABASE_PATH.
var settingName = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)

var (
	mu sync.Mutex
	// stop ends the running den-watcher; nil while none runs.
	stop context.CancelFunc
	// done is closed when the running den-watcher has returned.
	done chan struct{}
	// failure is why the last den-watcher stopped on its own.
	failure string
	// set are the names of the settings the last Start set, which the next
	// one unsets first, so a setting left out goes back to its default.
	set []string

	// localOnce sets time.Local at the first Start only: Go reads it without
	// a lock, so it cannot change while anything runs. A new time zone takes
	// effect when the app starts again.
	localOnce sync.Once
	// resolverOnce puts the resolver that asks dnsServers in place of Go's
	// at the first Start that passes servers.
	resolverOnce sync.Once
	// dnsServers are the servers the resolver asks, host:port each; each
	// Start that passes servers replaces them, as they change with the
	// network.
	dnsServers atomic.Pointer[[]string]
)

// Start runs den-watcher in the background until Stop. settings are its
// environment variables, one NAME=value per line, such as
// DATABASE_PATH=/data/user/0/den.watcher.hub/files/den-watcher.db; empty
// lines are skipped. timeZone is the IANA name of Android's time zone, such as
// Europe/Berlin, or empty to keep UTC; only the first Start sets it. servers
// are the addresses of the network's DNS servers, comma-separated, for the
// daily check for a newer release, or empty to keep the ones before.
//
// Start returns an error for a setting it cannot read, an unknown time zone or
// a DNS server that is no address, and when den-watcher runs already; why
// den-watcher stopped after it started, such as a port in use, is Failure.
func Start(settings, timeZone, servers string) error {
	values, err := parseSettings(settings)
	if err != nil {
		return err
	}
	var location *time.Location
	if timeZone != "" {
		if location, err = time.LoadLocation(timeZone); err != nil {
			return fmt.Errorf("time zone %q: %w", timeZone, err)
		}
	}
	addrs, err := parseServers(servers)
	if err != nil {
		return err
	}

	mu.Lock()
	defer mu.Unlock()
	if stop != nil {
		return errors.New("den-watcher runs already; stop it first")
	}
	for _, name := range set {
		_ = os.Unsetenv(name)
	}
	set = set[:0]
	for _, v := range values {
		if err := os.Setenv(v.name, v.value); err != nil {
			return fmt.Errorf("setting %s: %w", v.name, err)
		}
		set = append(set, v.name)
	}
	if location != nil {
		localOnce.Do(func() { time.Local = location })
	}
	if len(addrs) > 0 {
		dnsServers.Store(&addrs)
		resolverOnce.Do(func() { net.DefaultResolver = newResolver(&dnsServers) })
	}

	ctx, cancel := context.WithCancel(context.Background())
	stop, done, failure = cancel, make(chan struct{}), ""
	go func(done chan struct{}) {
		err := program.Run(ctx)
		mu.Lock()
		if err != nil {
			failure = err.Error()
		}
		// Stopped on its own: the next Start may run it again.
		if stop != nil && ctx.Err() == nil {
			stop = nil
		}
		mu.Unlock()
		cancel()
		close(done)
	}(done)
	return nil
}

// Stop ends den-watcher and waits until it has written what waits in memory
// to its database, which takes a few seconds at most. It does nothing when
// den-watcher does not run.
func Stop() {
	mu.Lock()
	cancel, wait := stop, done
	stop = nil
	mu.Unlock()
	if cancel == nil {
		// It may have stopped on its own and still be finishing.
		if wait != nil {
			<-wait
		}
		return
	}
	cancel()
	<-wait
}

// Running reports whether den-watcher runs.
func Running() bool {
	mu.Lock()
	defer mu.Unlock()
	return stop != nil
}

// Failure is why den-watcher last stopped on its own, such as its port being
// in use; empty while it runs, when it was stopped with Stop and before the
// first Start.
func Failure() string {
	mu.Lock()
	defer mu.Unlock()
	return failure
}

// setting is one NAME=value line of Start's settings.
type setting struct {
	name, value string
}

// parseSettings reads Start's settings.
func parseSettings(settings string) ([]setting, error) {
	var values []setting
	for line := range strings.Lines(settings) {
		line = strings.TrimRight(line, "\r\n")
		if strings.TrimSpace(line) == "" {
			continue
		}
		name, value, ok := strings.Cut(line, "=")
		if !ok || !settingName.MatchString(name) {
			return nil, fmt.Errorf("setting %q is not NAME=value", line)
		}
		values = append(values, setting{name: name, value: value})
	}
	return values, nil
}

// parseServers reads Start's DNS servers into host:port addresses.
func parseServers(servers string) ([]string, error) {
	var addrs []string
	for _, field := range strings.Split(servers, ",") {
		field = strings.TrimSpace(field)
		if field == "" {
			continue
		}
		addr, err := netip.ParseAddr(field)
		if err != nil {
			return nil, fmt.Errorf("DNS server %q is no IP address: %w", field, err)
		}
		addrs = append(addrs, net.JoinHostPort(addr.String(), "53"))
	}
	return addrs, nil
}

// newResolver returns a resolver that asks the servers in order, as they are
// at each lookup.
func newResolver(servers *atomic.Pointer[[]string]) *net.Resolver {
	return &net.Resolver{
		PreferGo: true,
		// Go would ask the servers of /etc/resolv.conf, which Android does
		// not have.
		Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			var dialer net.Dialer
			var errs []error
			for _, server := range *servers.Load() {
				conn, err := dialer.DialContext(ctx, network, server)
				if err == nil {
					return conn, nil
				}
				errs = append(errs, err)
			}
			return nil, errors.Join(errs...)
		},
	}
}
