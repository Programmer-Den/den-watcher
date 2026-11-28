// Package program is den-watcher itself: it reads the settings from the
// environment and serves the website, or only the usage data for a hub,
// until it is stopped. The command den-watcher runs it, and so does the
// Android hub app, inside its own process (see backend/mobile).
package program

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/changelog"
	"github.com/Programmer-Den/den-watcher/backend/internal/energy"
	"github.com/Programmer-Den/den-watcher/backend/internal/events"
	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/layout"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
	"github.com/Programmer-Den/den-watcher/backend/internal/password"
	"github.com/Programmer-Den/den-watcher/backend/internal/places"
	"github.com/Programmer-Den/den-watcher/backend/internal/server"
	"github.com/Programmer-Den/den-watcher/backend/internal/statuspage"
	"github.com/Programmer-Den/den-watcher/backend/internal/update"
	"github.com/Programmer-Den/den-watcher/backend/internal/version"
	"github.com/Programmer-Den/den-watcher/backend/internal/web"
)

// Run serves the website, or with DATA_ONLY only the usage data, until ctx
// is done. The settings are the environment variables listed in the
// documentation of the command den-watcher.
func Run(ctx context.Context) error {
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = ":9393"
	}
	databasePath := cmp.Or(os.Getenv("DATABASE_PATH"), newDatabaseName)
	programData := ""
	if runtime.GOOS == "windows" {
		programData = os.Getenv("ProgramData")
	}
	databasePath = renameOldDatabase(databasePath, programData)

	days, err := intSettingOr("RETENTION_DAYS", 30, 3650, " of days")
	if err != nil {
		return err
	}
	retention := time.Duration(days) * 24 * time.Hour
	// Empty keeps where the phones were and their Wi-Fi for good.
	phoneDays, err := phoneRetentionDays()
	if err != nil {
		return err
	}
	phoneRetention := time.Duration(phoneDays) * 24 * time.Hour
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

	phone, err := ownPhoneSetting()
	if err != nil {
		return err
	}
	if dataOnly && phone.Name != "" {
		return errors.New("HUB_OWN_PHONE is set, but DATA_ONLY turns off the hub that would pair it; unset one of the two")
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
		site, wait, err := withHistory(ctx, sampler, store, remotes, phone, complete, retention, phoneRetention, historyEntries, port, checkUpdates)
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
func withHistory(ctx context.Context, sampler *metrics.Sampler, store *history.Store, fixed []hub.Device, phone ownPhone, complete bool, retention, phoneRetention time.Duration, historyEntries int, pagePort string, checkUpdates bool) (server.Site, func(), error) {
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

	// Opened before the hub, which starts collecting, so an error here
	// leaves nothing running.
	pageLayout, err := layout.Open(ctx, store.DB())
	if err != nil {
		return server.Site{}, nil, err
	}

	wifiPlaces, err := places.Open(ctx, store.DB())
	if err != nil {
		return server.Site{}, nil, err
	}

	energyPrice, err := energy.Open(ctx, store.DB())
	if err != nil {
		return server.Site{}, nil, err
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

	changes, err := changelog.Open(ctx, store.DB(), retention)
	if err != nil {
		return server.Site{}, nil, err
	}

	others, err = hub.New(ctx, store, fixed, complete, historyEntries, retention, phoneRetention, pagePort, sampler.Reusing(reuseFor), watcher.Forget, happenings.Forget)
	if err != nil {
		return server.Site{}, nil, err
	}
	if phone.Name != "" {
		// A wrong code or a name another device has must not stop the hub:
		// it runs without its own phone, and the log says why.
		if err := others.KeepPhone(ctx, phone.Name, phone.Code); err != nil {
			slog.Error("the phone in HUB_OWN_PHONE is left out", "error", err)
		}
	}

	recent := &history.Recent{}
	recorder := &history.Recorder{Store: store, Recent: recent, Collector: sampler.Reusing(reuseFor), Device: history.LocalDevice, MaxEntries: historyEntries, WiFi: store}
	pruner := &history.Pruner{Store: store, Retention: retention, PhoneRetention: phoneRetention}
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
				History: history.Reader{Store: store, Recent: recent, Device: history.LocalDevice, Retention: retention},
			},
			hub:    others,
			alerts: watcher,
		},
		Hub:            others,
		Password:       devicesPassword,
		Retention:      retention,
		PhoneRetention: phoneRetention,
		Routes:         others,
		PagePort:       pagePort,
		Files:          web.Files(),
		Update:         func() update.Status { return update.Status{Current: version.Version} },

		Minutes:         history.Reader{Store: store, Recent: recent, Device: history.LocalDevice},
		Alerts:          watcher,
		Layout:          pageLayout,
		Places:          wifiPlaces,
		EnergyPrice:     energyPrice,
		Backups:         store,
		Events:          happenings,
		Changes:         changes,
		WiFi:            store,
		AppUses:         store,
		WiFiConnections: store,
		Route:           store,
		PhoneScans:      store,
		Positions:       store,
		Routers:         others,
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
