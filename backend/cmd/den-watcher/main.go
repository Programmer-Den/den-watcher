// Command den-watcher serves a website that shows the usage of the machine
// it runs on.
//
// Settings come from environment variables:
//
//	LISTEN_ADDR     address to listen on (default ":9393")
//	PUBLIC_PORT     port the page is reachable on from the network, when it is
//	                not the one in LISTEN_ADDR (set by compose.yaml)
//	DISK_PATHS      comma-separated paths whose disk usage is shown (default "/",
//	                or the system drive such as "C:\" on Windows)
//	DATABASE_PATH   SQLite file the history is kept in, or with DATA_ONLY the
//	                minutes kept for a hub (default "usage-control.db")
//	RETENTION_DAYS  days of history to keep; older values are deleted (default 30)
//	HISTORY_MAX_ENTRIES  how many disks, temperature sensors, network cards and
//	                GPUs each the history keeps per device (default 64)
//	HISTORY_FLUSH_MINUTES  how many minutes of history wait in memory before
//	                they are written to the database together, from 1 to 60
//	                (default 10); a power cut loses what waits, and a longer
//	                time writes less to an SD card
//	DEVICE_NAME     how the page names this device (default "Host Hub")
//	HUB_DEVICES     other devices to collect from, which turns on hub mode:
//	                comma-separated name=host:port entries (default none)
//	HUB_ROUTERS     routers to read, which the hub shows as devices:
//	                comma-separated name=protocol:address entries, such as
//	                Router=upnp:192.168.1.1, Router=asus:admin@192.168.1.1,
//	                Router=snmp:192.168.1.1, Router=snmpv3:user@192.168.1.1
//	                or Router=fritzbox:user@192.168.178.1 (default none)
//	HUB_CHECKS      things that run no den-watcher, such as a printer or NAS,
//	                which the hub only checks for whether they answer and
//	                shows as devices: comma-separated name=host:port entries
//	                to connect to a TCP port, or name=host to ping, such as
//	                Printer=192.168.1.50:631 or NAS=192.168.1.10 (default
//	                none)
//	ROUTER_PASSWORDS_FILE  file with the passwords of the routers that need a
//	                login, and the SNMPv2c community where it is not public,
//	                one name=password per line (default the file
//	                router-passwords in CREDENTIALS_DIRECTORY, where systemd
//	                decrypts it for the service)
//	DATA_ONLY       true to serve only the usage data for a hub, without the
//	                website and history (default false)
//	BUFFER_HOURS    with DATA_ONLY, how many hours of minutes this device keeps
//	                for a hub that cannot reach it, from 1 to 168; the hub
//	                fetches them once it can, and they are deleted then
//	                (default 24)
//	RESET_PASSWORD  true to delete the password for adding and removing
//	                devices on the page, if it is forgotten (default false)
//	UPDATE_CHECK    false to stop asking GitHub once a day whether a newer
//	                release exists, which the page then tells (default true;
//	                only releases check, and never with DATA_ONLY)
//	ADDONS_DIR      folder the installed add-ons write their reports to, which
//	                are shown as extras (default none: no add-ons)
//	ALLOWED_HOSTS   comma-separated names this device answers to besides its
//	                IP addresses, localhost, its hostname and .local names,
//	                such as a name from the router's DNS, without http://;
//	                another entry is left out with a warning (default none)
//	PROMETHEUS      true to serve GET /metrics, the usage of this device and
//	                of every device it collects from in the Prometheus text
//	                format, for Prometheus and Grafana (default false)
//	STATUS_ADDR     address of the remote status page, such as :9443: a
//	                minimal page, over HTTPS with a self-signed certificate
//	                and behind a password set on the website, that tells
//	                whether each device is online and how many alerts it
//	                has, meant to be reachable from the internet (default
//	                none: no status page; not with DATA_ONLY)
//	STATUS_PUBLIC_PORT  port the status page is reachable on, when it is not
//	                the one in STATUS_ADDR (set by compose.yaml)
package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/events"
	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/layout"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
	"github.com/Programmer-Den/den-watcher/backend/internal/password"
	"github.com/Programmer-Den/den-watcher/backend/internal/reach"
	"github.com/Programmer-Den/den-watcher/backend/internal/router"
	"github.com/Programmer-Den/den-watcher/backend/internal/server"
	"github.com/Programmer-Den/den-watcher/backend/internal/statuspage"
	"github.com/Programmer-Den/den-watcher/backend/internal/update"
	"github.com/Programmer-Den/den-watcher/backend/internal/version"
	"github.com/Programmer-Den/den-watcher/backend/internal/web"
	"github.com/Programmer-Den/den-watcher/backend/internal/winservice"
)

func main() {
	// Installed on Windows, the service manager starts the program and tells
	// it when to stop; everywhere else it runs until it is interrupted. A
	// service has no console, so its warnings go to the event log too. The
	// service starts the add-ons installed next to it through the add-on host,
	// a child process of its own program, and stops them when it stops.
	winservice.LogWarnings("UsageControl")
	if len(os.Args) == 2 && os.Args[1] == addons.HostArgument {
		addons.RunHost(os.Getenv("ADDONS_DIR"))
		return
	}
	if len(os.Args) == 2 && os.Args[1] == pairingCodeArgument {
		if err := printPairingCode(os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	ranAsService, err := winservice.Run("UsageControl", run, func() func() {
		return addons.StartHost(os.Getenv("ADDONS_DIR"))
	})
	if !ranAsService && err == nil {
		// Only outside the service manager: Go turns a user logging off
		// Windows into SIGTERM, which would stop the service for good.
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		err = run(ctx)
		stop()
	}
	if err != nil {
		// winservice.Run has written a service's error to the event log already.
		if !ranAsService {
			slog.Error("den-watcher stopped", "error", err)
		}
		os.Exit(1)
	}
}

// run serves the website, or with DATA_ONLY only the usage data, until ctx is done.
func run(ctx context.Context) error {
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = ":9393"
	}
	databasePath := cmp.Or(os.Getenv("DATABASE_PATH"), "usage-control.db")

	days, err := intSettingOr("RETENTION_DAYS", 30, 3650, " of days")
	if err != nil {
		return err
	}
	retention := time.Duration(days) * 24 * time.Hour
	port, err := pagePort(addr)
	if err != nil {
		return err
	}
	historyEntries, err := intSettingOr("HISTORY_MAX_ENTRIES", history.DefaultMaxEntries, 10000, "")
	if err != nil {
		return err
	}
	flushMinutes, err := intSettingOr("HISTORY_FLUSH_MINUTES", 10, 60, " of minutes")
	if err != nil {
		return err
	}
	remotes, err := hub.ParseDevices(os.Getenv("HUB_DEVICES"))
	if err != nil {
		return fmt.Errorf("check HUB_DEVICES: %w", err)
	}
	// complete is false when HUB_ROUTERS or HUB_CHECKS is left out for an
	// error: the hub then forgets none of the devices it misses at this start.
	complete := true
	routers, err := routerDevices(databasePath)
	if err != nil {
		// A wrong router setting must not stop this device's own
		// monitoring: it runs without the routers, and the log says why.
		slog.Error("the routers in HUB_ROUTERS are left out", "error", err)
		routers = nil
		complete = false
	}
	remotes = append(remotes, routers...)
	checks, err := checkDevices()
	if err != nil {
		// As with the routers, this device's own monitoring runs on.
		slog.Error("the checks in HUB_CHECKS are left out", "error", err)
		checks = nil
		complete = false
	}
	remotes = append(remotes, checks...)
	if err := hub.CheckFixed(remotes); err != nil {
		return fmt.Errorf("check HUB_DEVICES, HUB_ROUTERS and HUB_CHECKS: %w", err)
	}

	dataOnly, err := boolSettingOr("DATA_ONLY", false)
	if err != nil {
		return err
	}
	if dataOnly && len(remotes) > 0 {
		return errors.New("HUB_DEVICES, HUB_ROUTERS or HUB_CHECKS is set, but DATA_ONLY turns off the website that would show them; unset one of the two")
	}
	prometheus, err := boolSettingOr("PROMETHEUS", false)
	if err != nil {
		return err
	}
	if dataOnly && prometheus {
		return errors.New("PROMETHEUS is set, but DATA_ONLY serves only the usage for a hub; let Prometheus scrape the hub, which lists this device too, or unset one of the two")
	}
	statusAddr, statusPort, err := statusPageSettings()
	if err != nil {
		return err
	}
	if dataOnly && statusAddr != "" {
		return errors.New("STATUS_ADDR is set, but DATA_ONLY turns off the website and history the status page needs; set it on the hub instead, or unset one of the two")
	}

	hours, err := intSettingOr("BUFFER_HOURS", int(history.DefaultBufferSpan/time.Hour), 168, " of hours")
	if err != nil {
		return err
	}
	bufferSpan := time.Duration(hours) * time.Hour
	// Read before anything starts, so a wrong value stops the program before
	// the database is opened and the recorders run.
	checkUpdates, err := boolSettingOr("UPDATE_CHECK", true)
	if err != nil {
		return err
	}

	// Listening comes before the rest of the setup: while another program
	// holds the port, the Windows service tries again after 10 seconds, then
	// less often, up to every 5 minutes, and each try would otherwise open the
	// database and the readers anew.
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	defer func() { _ = listener.Close() }()
	hosts := allowedHosts()
	// A database from before pairing knows the hubs that collect already;
	// see pairing.Open.
	_, err = os.Stat(databasePath) //nolint:gosec // DATABASE_PATH, set by whoever runs the program
	existed := err == nil

	collector, err := metrics.NewCollector(context.Background(), diskPaths())
	if err != nil {
		return fmt.Errorf("check DISK_PATHS: %w; %s", err, diskPathsHint(runtime.GOOS, os.Getenv("HOST_PROC") != ""))
	}

	// stop ends the recorders before the database is closed.
	ctx, stop := context.WithCancel(ctx)
	defer stop()

	collector.Name = ownName()
	if dir := os.Getenv("ADDONS_DIR"); dir != "" {
		collector.AddOns = &metrics.AddOns{Dir: dir, MaxEntries: historyEntries}
		slog.Info("showing the values of the add-ons", "folder", dir)
	}

	collector.DatabasePath = databasePath

	// One sampler reads the usage for every page, hub and the recorder.
	sampler := metrics.NewSampler(collector)

	// With DATA_ONLY, a hub collects the usage and keeps the history, so this
	// device keeps only the minutes the hub has not fetched yet.
	var handler http.Handler
	var waitForRecorders func()
	// statusServer serves the remote status page; nil when it is off.
	var statusServer *http.Server
	var statusListener net.Listener
	if dataOnly {
		minutes, paired, wait := withBuffer(ctx, sampler, databasePath, bufferSpan, historyEntries, existed)
		waitForRecorders = wait
		handler = server.NewDataOnly(sampler, minutes, paired, hosts)
		slog.Info("serving only the usage data, for a hub; the website is turned off", "bufferHours", int(bufferSpan/time.Hour))
	} else {
		store, err := history.Open(context.Background(), databasePath)
		if err != nil {
			return fmt.Errorf("open the history database %s: %w; set DATABASE_PATH to a writable file", databasePath, err)
		}
		defer func() { _ = store.Close() }()
		store.SetFlushInterval(time.Duration(flushMinutes) * time.Minute)
		site, wait, err := withHistory(ctx, sampler, store, remotes, complete, retention, historyEntries, port, checkUpdates)
		if err != nil {
			return err
		}
		// As on a device without a website (withBuffer), a pairing code that
		// cannot be read lets every hub collect instead of stopping the site.
		if paired, err := pairing.Open(ctx, store.DB(), existed, nil); err == nil {
			logPairingCode(paired)
			site.Pairing = paired
		} else {
			slog.Warn("could not read the pairing code, so any hub can collect from this device without it", "path", databasePath, "error", err)
		}
		waitForRecorders = wait
		site.AllowedHosts = hosts
		site.Prometheus = prometheus
		if prometheus {
			slog.Info("serving the usage for Prometheus at /metrics")
		}
		if statusAddr != "" {
			page, certs, err := openStatusPage(ctx, store, site.Devices)
			if err == nil {
				statusListener, err = statuspage.Listen(statusAddr, certs)
			}
			if err != nil {
				// The recorders stop before the database is closed.
				stop()
				wait()
				return fmt.Errorf("set up the status page at STATUS_ADDR: %w", err)
			}
			defer func() { _ = statusListener.Close() }()
			statusServer = statuspage.NewServer(page)
			site.StatusPage = remoteStatus{Page: page, certs: certs, port: statusPort}
		}
		handler = server.New(site)
	}
	// The recorders stop before the database is closed.
	defer func() {
		stop()
		waitForRecorders()
	}()

	// The page gives up on an answer after ANSWER_TIMEOUT_MS (15 s,
	// frontend/src/app/connection/connection.ts); keep WriteTimeout below it.
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("den-watcher listening", "addr", addr)
		serveErr <- httpServer.Serve(listener)
	}()
	statusErr := make(chan error, 1)
	if statusServer != nil {
		go func() {
			slog.Info("serving the status page over HTTPS", "addr", statusAddr)
			statusErr <- statusServer.Serve(statusListener)
		}()
	}

	select {
	case err := <-serveErr:
		return err
	case err := <-statusErr:
		return fmt.Errorf("serve the status page: %w", err)
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if statusServer != nil {
		// The status page has nothing to finish that matters, so an error
		// here does not stop the website's own shutdown.
		_ = statusServer.Shutdown(shutdownCtx)
	}
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// withHistory returns the website's devices with their history: this device
// and every device the hub collects from, from HUB_DEVICES or added on the
// page. Each gets a recorder that reads its usage into the history until ctx
// is done, and one pruner deletes what is older than retention; the returned
// function waits until they have stopped. Of each device's disks, sensors,
// network cards and GPUs, the first historyEntries are kept. With
// checkUpdates, a release asks GitHub for a newer one.
func withHistory(ctx context.Context, sampler *metrics.Sampler, store *history.Store, fixed []hub.Device, complete bool, retention time.Duration, historyEntries int, pagePort string, checkUpdates bool) (server.Site, func(), error) {
	devicesPassword, err := password.Open(ctx, store.DB())
	if err != nil {
		return server.Site{}, nil, err
	}
	reset, err := boolSettingOr("RESET_PASSWORD", false)
	if err != nil {
		return server.Site{}, nil, err
	}
	if reset {
		if err := devicesPassword.Reset(ctx); err != nil {
			return server.Site{}, nil, err
		}
		slog.Warn("RESET_PASSWORD deleted the password for changing devices; the next change chooses a new one. Unset RESET_PASSWORD again.")
	}

	// The alerts and events are opened before the hub, which deletes them for
	// every device it forgets, also while it starts. They look at the hub's
	// devices only once they run.
	var others *hub.Hub
	localName := strings.TrimSpace(os.Getenv("DEVICE_NAME"))
	watcher, err := alerts.Open(ctx, store.DB(), func() []alerts.Target {
		return alertTargets(localName, sampler.Reusing(reuseFor), others)
	}, retention)
	if err != nil {
		return server.Site{}, nil, err
	}

	happenings, err := events.Open(ctx, store.DB(), func() []events.Target {
		return eventTargets(sampler.Reusing(reuseFor), others)
	}, retention)
	if err != nil {
		return server.Site{}, nil, err
	}

	others, err = hub.New(ctx, store, fixed, complete, historyEntries, retention, pagePort, sampler.Reusing(reuseFor), watcher.Forget, happenings.Forget)
	if err != nil {
		return server.Site{}, nil, err
	}

	pageLayout, err := layout.Open(ctx, store.DB())
	if err != nil {
		return server.Site{}, nil, err
	}

	recent := &history.Recent{}
	recorder := &history.Recorder{Store: store, Recent: recent, Collector: sampler.Reusing(reuseFor), Device: history.LocalDevice, MaxEntries: historyEntries, WiFi: store}
	pruner := &history.Pruner{Store: store, Retention: retention}
	var recording sync.WaitGroup
	recording.Go(func() { recorder.Run(ctx) })
	recording.Go(func() { pruner.Run(ctx) })
	recording.Go(func() { store.RunFlusher(ctx) })
	recording.Go(func() { watcher.Run(ctx) })
	recording.Go(func() { happenings.Run(ctx) })

	site := server.Site{
		Devices: hubDevices{
			local: server.Device{
				ID:      hub.LocalID,
				Name:    localName,
				Metrics: sampler,
				History: history.Reader{Store: store, Recent: recent, Device: history.LocalDevice},
			},
			hub:    others,
			alerts: watcher,
		},
		Hub:       others,
		Password:  devicesPassword,
		Retention: retention,
		PagePort:  pagePort,
		Files:     web.Files(),
		Update:    func() update.Status { return update.Status{Current: version.Version} },

		Minutes: history.Reader{Store: store, Recent: recent, Device: history.LocalDevice},
		Alerts:  watcher,
		Layout:  pageLayout,
		Backups: store,
		Events:  happenings,
		WiFi:    store,
	}
	if checker := update.NewChecker(version.Version); checker != nil && checkUpdates {
		site.Update = checker.Status
		recording.Go(func() { checker.Run(ctx) })
	}
	wait := func() {
		recording.Wait()
		others.Wait()
	}
	return site, wait, nil
}

// reuseFor is how old a reading the recorder takes from a hub or page that
// asked meanwhile, instead of reading the machine again: less than the time
// between its own readings, so it never takes the same one twice.
const reuseFor = history.RecentInterval - time.Second

// withBuffer keeps this device's minutes for a hub that cannot reach it, for
// up to span, in a buffer in the database at path, until ctx is done, with
// the pairing code a hub must be given; the returned function waits until the
// recorder has stopped and closes the database. Of its disks, sensors,
// network cards and GPUs, the first historyEntries are kept. existed tells
// that the database was there before this start (see pairing.Open). When the
// database cannot be opened, the device still serves its usage, without
// minutes and to every hub: the hub then stores the average of its own
// readings, as for a device from before they were kept.
func withBuffer(ctx context.Context, sampler *metrics.Sampler, path string, span time.Duration, historyEntries int, existed bool) (server.MinuteSource, server.Pairing, func()) {
	buffer, err := history.OpenBuffer(ctx, path, span)
	if err != nil {
		slog.Warn("could not open the database for the usage kept for a hub, so a hub that cannot reach this device has a gap in its history, and any hub can collect from it without the pairing code; set DATABASE_PATH to a writable file",
			"path", path, "error", err)
		return nil, nil, func() {}
	}
	var paired server.Pairing
	known, err := buffer.Hubs(ctx)
	if err == nil {
		var p *pairing.Pairing
		if p, err = pairing.Open(ctx, buffer.DB(), existed, known); err == nil {
			logPairingCode(p)
			paired = p
		}
	}
	if err != nil {
		slog.Warn("could not read the pairing code, so any hub can collect from this device without it", "path", path, "error", err)
	}
	recorder := &history.Recorder{
		Store: buffer,
		// Only the readings until their average is kept are needed.
		Recent:     &history.Recent{Span: 2 * history.SampleInterval},
		Collector:  sampler.Reusing(reuseFor),
		Device:     history.LocalDevice,
		MaxEntries: historyEntries,
	}
	var recording sync.WaitGroup
	recording.Go(func() { recorder.Run(ctx) })
	wait := func() {
		recording.Wait()
		_ = buffer.Close()
	}
	return buffer, paired, wait
}

// logPairingCode tells this device's pairing code, which a hub asks for when
// the device is added there.
func logPairingCode(p *pairing.Pairing) {
	slog.Info("to collect from this device, a hub asks for its pairing code, which den-watcher pairing-code prints too", "code", p.Code())
}

// pairingCodeArgument makes the program print the pairing code of the
// den-watcher running on this machine, for a device without a website.
const pairingCodeArgument = "pairing-code"

// printPairingCode asks the den-watcher running on this machine, at
// LISTEN_ADDR, for its pairing code and writes it to out.
func printPairingCode(out io.Writer) error {
	addr := cmp.Or(os.Getenv("LISTEN_ADDR"), ":9393")
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("LISTEN_ADDR is %q; set it to an address and port such as :9393", addr)
	}
	// A LISTEN_ADDR of one address, such as 192.168.1.5:9393, is not
	// answered on localhost.
	if ip := net.ParseIP(host); host == "" || ip != nil && ip.IsUnspecified() {
		host = "localhost"
	}
	url := "http://" + net.JoinHostPort(host, port) + "/api/pairing"
	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Get(url) //nolint:gosec // this machine, at LISTEN_ADDR
	if err != nil {
		return fmt.Errorf("ask den-watcher on this machine for its pairing code: %w; is it running, with LISTEN_ADDR as here?", err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("ask den-watcher on this machine for its pairing code: it answered %s; it needs a version with pairing, and its database must be writable", response.Status)
	}
	var answer struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&answer); err != nil || answer.Code == "" {
		return fmt.Errorf("read the pairing code from %s: the answer is not one", url)
	}
	_, err = fmt.Fprintln(out, answer.Code)
	return err
}

// hubDevices lists this device and the devices the hub collects from, each
// with its active alerts.
type hubDevices struct {
	local  server.Device
	hub    *hub.Hub
	alerts *alerts.Watcher
}

func (d hubDevices) List() []server.Device {
	local := d.local
	local.Alerts = d.alerts.Active(local.ID)
	devices := []server.Device{local}
	for _, remote := range d.hub.Remotes() {
		since, unreachable := remote.Unreachable()
		var unreachableSince *time.Time
		if unreachable && !since.IsZero() {
			unreachableSince = &since
		}
		devices = append(devices, server.Device{
			ID:               remote.ID,
			Name:             remote.Name,
			Address:          remote.Address,
			Kind:             remote.Kind(),
			Removable:        !remote.Fixed,
			Unreachable:      unreachable,
			UnreachableSince: unreachableSince,
			Refused:          remote.Refused(),
			Pairing:          remote.Pairing(),
			Router:           remote.Router(),
			Checked:          remote.Checked,
			Alerts:           d.alerts.Active(remote.ID),
			Metrics:          remote.Agent.Latest(),
			History:          remote.Reader,
			Availability:     remote,
		})
	}
	return devices
}

// alertTargets lists this device, read by local, and the devices the hub
// collects from, for the alerts watcher.
func alertTargets(localName string, local metrics.Source, others *hub.Hub) []alerts.Target {
	targets := []alerts.Target{{ID: hub.LocalID, Name: localName, Usage: local}}
	for _, remote := range others.Remotes() {
		since, unreachable := remote.Unreachable()
		targets = append(targets, alerts.Target{
			ID:               remote.ID,
			Name:             remote.Name,
			PC:               remote.Kind() == hub.KindPC || remote.Kind() == hub.KindPhone,
			Unreachable:      unreachable,
			UnreachableSince: since,
			Usage:            remote.Agent.Latest(),
		})
	}
	return targets
}

// eventTargets lists this device, read by local, and the devices the hub
// collects from, for the events log.
func eventTargets(local metrics.Source, others *hub.Hub) []events.Target {
	targets := []events.Target{{ID: hub.LocalID, Usage: local}}
	for _, remote := range others.Remotes() {
		targets = append(targets, events.Target{ID: remote.ID, Usage: remote.Agent.Latest()})
	}
	return targets
}

// routerDevices returns the routers in HUB_ROUTERS as devices, each with
// the password it needs: from the passwords file (see router.PasswordsPath),
// or else the one the Windows installer stored next to the database at
// databasePath (see router.StoredPasswords).
func routerDevices(databasePath string) ([]hub.Device, error) {
	configs, err := router.ParseConfigs(os.Getenv("HUB_ROUTERS"))
	if err != nil {
		return nil, fmt.Errorf("check HUB_ROUTERS: %w", err)
	}
	needsSecret, needsLogin := "", ""
	for _, config := range configs {
		if config.Protocol.HasSecret() && needsSecret == "" {
			needsSecret = config.Name
		}
		if config.Protocol.NeedsLogin() && needsLogin == "" {
			needsLogin = config.Name
		}
	}
	var passwords map[string]string
	source := router.PasswordsPath()
	if needsSecret != "" {
		switch {
		case source != "":
			passwords, err = router.ReadPasswords(source, hub.IDOf)
			// SNMPv2c with the community public needs no file.
			if err != nil && (!errors.Is(err, fs.ErrNotExist) || needsLogin != "") {
				return nil, fmt.Errorf("read the router passwords: %w", err)
			}
		default:
			var stored bool
			passwords, stored, err = router.StoredPasswords(filepath.Dir(databasePath), hub.IDOf)
			if err != nil {
				return nil, fmt.Errorf("read the router passwords the installer stored: %w", err)
			}
			source = "the installer"
			if !stored && needsLogin != "" {
				return nil, fmt.Errorf("the router %q needs a password; run the installer again to enter it, or set ROUTER_PASSWORDS_FILE to a file with a line %s=<password>", needsLogin, needsLogin)
			}
		}
	}
	var devices []hub.Device
	for _, config := range configs {
		device, err := hub.NewRouter(config.Name, config.Address, nil)
		if err != nil {
			return nil, fmt.Errorf("check HUB_ROUTERS: %w", err)
		}
		password, ok := passwords[device.ID]
		if config.Protocol.NeedsLogin() && !ok {
			return nil, fmt.Errorf("the router %q needs a password, but %s has none for it; run the installer again to enter it", config.Name, source)
		}
		if config.Protocol == router.SNMPv3 && len(password) < 8 {
			// SNMPv3 makes its keys from at least 8 characters (RFC 3414).
			return nil, fmt.Errorf("the SNMPv3 password of the router %q is shorter than 8 characters; run the installer again to enter it", config.Name)
		}
		device.Source = router.New(config, password)
		devices = append(devices, device)
	}
	return devices, nil
}

// checkDevices returns the things in HUB_CHECKS as devices, each checked
// for whether it answers.
func checkDevices() ([]hub.Device, error) {
	configs, err := reach.ParseConfigs(os.Getenv("HUB_CHECKS"))
	if err != nil {
		return nil, fmt.Errorf("check HUB_CHECKS: %w", err)
	}
	var devices []hub.Device
	for _, config := range configs {
		device, err := hub.NewCheck(config.Name, config.Address(), reach.New(config))
		if err != nil {
			return nil, fmt.Errorf("check HUB_CHECKS: %w", err)
		}
		devices = append(devices, device)
	}
	return devices, nil
}

// ownName returns what this device calls itself, which a hub offers as the
// name when it is added there: DEVICE_NAME, or else the machine's hostname.
// In a container, where HOST_PROC is set, the hostname is the container's,
// so there it is only DEVICE_NAME.
func ownName() string {
	if name := strings.TrimSpace(os.Getenv("DEVICE_NAME")); name != "" {
		return name
	}
	if os.Getenv("HOST_PROC") != "" {
		return ""
	}
	hostname, _ := os.Hostname()
	return hostname
}

// boolSettingOr reads a setting that is true or false, with a default for
// when it is not set.
func boolSettingOr(name string, fallback bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback, nil
	}
	on, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s is %q; set it to true or false", name, value)
	}
	return on, nil
}

// diskPathsHint tells how to fix a path in DISK_PATHS that cannot be read on
// goos, in a container or not.
func diskPathsHint(goos string, container bool) string {
	switch {
	case goos == "windows":
		return `list drives or folders that exist, such as C:\,D:\`
	case container:
		return "mount each path read-only in compose.yaml"
	default:
		return "list folders that exist, such as /,/mnt/usb"
	}
}

// allowedHosts returns the entries of ALLOWED_HOSTS that are names or IP
// addresses. Each other one, such as http://pi.lan, is left out with a
// warning instead of stopping the start, so an install that has one keeps
// running after an update rather than restarting over and over in Docker or
// failing to start as a Windows service.
func allowedHosts() []string {
	valid, invalid := server.SplitAllowedHosts(listSetting("ALLOWED_HOSTS"))
	for _, entry := range invalid {
		slog.Warn("an entry of ALLOWED_HOSTS is not a name or IP address and is left out; give the name alone, such as pi.lan, without http:// or a path, and a name with letters such as ü in the xn-- form the browser sends, such as xn--kche-0ra.lan for küche.lan", "entry", entry)
	}
	return valid
}

// diskPaths returns the paths from DISK_PATHS, each once, or the system disk
// when it is not set.
func diskPaths() []string {
	var paths []string
	for _, path := range listSetting("DISK_PATHS") {
		if !slices.Contains(paths, path) {
			paths = append(paths, path)
		}
	}
	if len(paths) == 0 {
		return []string{systemDisk()}
	}
	return paths
}

// listSetting reads a comma-separated setting, without blank entries.
func listSetting(name string) []string {
	var values []string
	for _, value := range strings.Split(os.Getenv(name), ",") {
		if value = strings.TrimSpace(value); value != "" {
			values = append(values, value)
		}
	}
	return values
}

// systemDisk returns the root of the disk the operating system is installed
// on: / on Linux and macOS, and the system drive, usually C:\, on Windows.
func systemDisk() string {
	if runtime.GOOS == "windows" {
		return os.Getenv("SystemDrive") + `\`
	}
	return "/"
}

// statusPageSettings reads STATUS_ADDR, the address of the remote status
// page, empty when it is off, and the port it is reachable on: from
// STATUS_PUBLIC_PORT, or the port of STATUS_ADDR.
func statusPageSettings() (addr, port string, err error) {
	addr = strings.TrimSpace(os.Getenv("STATUS_ADDR"))
	if addr == "" {
		return "", "", nil
	}
	_, port, err = net.SplitHostPort(addr)
	if n, convErr := strconv.Atoi(port); err != nil || convErr != nil || n < 1 || n > 65535 {
		return "", "", fmt.Errorf("STATUS_ADDR is %q; set it to an address and port such as :9443, or leave it empty for no status page", addr)
	}
	if public := strings.TrimSpace(os.Getenv("STATUS_PUBLIC_PORT")); public != "" {
		if n, err := strconv.Atoi(public); err != nil || n < 1 || n > 65535 {
			return "", "", fmt.Errorf("STATUS_PUBLIC_PORT is %q; set it to a port from 1 to 65535", public)
		}
		port = public
	}
	return addr, port, nil
}

// openStatusPage returns the remote status page for devices, with its
// password and self-signed certificate kept in store.
func openStatusPage(ctx context.Context, store *history.Store, devices server.Devices) (*statuspage.Page, *statuspage.Certificates, error) {
	statusPassword, err := password.OpenTable(ctx, store.DB(), password.StatusTable)
	if err != nil {
		return nil, nil, err
	}
	certs, err := statuspage.OpenCertificates(ctx, store.DB())
	if err != nil {
		return nil, nil, err
	}
	slog.Info("the status page's certificate; check that a browser shows the same before trusting it", "sha256", certs.Fingerprint())
	return statuspage.New(func() []statuspage.Device { return statusDevices(devices.List()) }, statusPassword), certs, nil
}

// statusDevices is what the remote status page shows of devices: each one's
// name, whether it answers and how many alerts it has. A PC or phone that
// does not answer is switched off rather than offline, and a device waiting
// for its pairing code answers all the same.
func statusDevices(devices []server.Device) []statuspage.Device {
	shown := make([]statuspage.Device, 0, len(devices))
	for _, d := range devices {
		state := statuspage.Online
		if d.Unreachable && d.Pairing == "" {
			state = statuspage.Offline
			if d.Kind == hub.KindPC || d.Kind == hub.KindPhone {
				state = statuspage.Off
			}
		}
		shown = append(shown, statuspage.Device{Name: d.Name, State: state, Alerts: len(d.Alerts)})
	}
	return shown
}

// remoteStatus is the status page as the website sets its password and
// tells where it is.
type remoteStatus struct {
	*statuspage.Page
	certs *statuspage.Certificates
	port  string
}

func (s remoteStatus) Port() string        { return s.port }
func (s remoteStatus) Fingerprint() string { return s.certs.Fingerprint() }

// pagePort returns the port the page is reachable on from the network, which
// a hub tells the devices it collects from: PUBLIC_PORT, or the port of
// LISTEN_ADDR. They differ in Docker, where the host's port is mapped to the
// container's 9393.
func pagePort(listenAddr string) (string, error) {
	value := strings.TrimSpace(os.Getenv("PUBLIC_PORT"))
	if value == "" {
		_, port, err := net.SplitHostPort(listenAddr)
		if err != nil {
			return "", fmt.Errorf("LISTEN_ADDR is %q; set it to an address and port such as :9393", listenAddr)
		}
		return port, nil
	}
	if port, err := strconv.Atoi(value); err != nil || port < 1 || port > 65535 {
		return "", fmt.Errorf("PUBLIC_PORT is %q; set it to a port from 1 to 65535", value)
	}
	return value, nil
}

// intSettingOr reads a setting that is a whole number from 1 to most, with a
// default for when it is not set; unit, such as " of days", names what it counts.
func intSettingOr(name string, fallback, most int, unit string) (int, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 || n > most {
		return 0, fmt.Errorf("%s is %q; set it to a whole number%s from 1 to %d", name, value, unit, most)
	}
	return n, nil
}
