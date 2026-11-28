// Command den-watcher serves a website that shows the usage of the machine
// it runs on. The program itself is internal/program; this command only
// starts it, as a Windows service or until it is interrupted.
//
// Settings come from environment variables:
//
//	LISTEN_ADDR     address to listen on (default ":9393")
//	PUBLIC_PORT     port the page is reachable on from the network, when it is
//	                not the one in LISTEN_ADDR (set by compose.yaml)
//	DISK_PATHS      comma-separated paths whose disk usage is shown (default "/",
//	                or the system drive such as "C:\" on Windows)
//	DATABASE_PATH   SQLite file the history is kept in, or with DATA_ONLY the
//	                minutes kept for a hub (default "den-watcher.db"; a
//	                usage-control.db next to it, the name up to 4.0.0, is
//	                renamed to it)
//	RETENTION_DAYS  days of history to keep; older values are deleted (default 30)
//	PHONE_RETENTION_DAYS  days to keep where the phones were and their Wi-Fi,
//	                from 1 to 36500; empty or 0 keeps them for good (the default)
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
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/program"
	"github.com/Programmer-Den/den-watcher/backend/internal/winservice"
)

func main() {
	// Installed on Windows, the service manager starts the program and tells
	// it when to stop; everywhere else it runs until it is interrupted. A
	// service has no console, so its warnings go to the event log too. The
	// service starts the add-ons installed next to it through the add-on host,
	// a child process of its own program, and stops them when it stops.
	winservice.LogWarnings("DenWatcher")
	if len(os.Args) == 2 && os.Args[1] == addons.HostArgument {
		addons.RunHost(os.Getenv("ADDONS_DIR"))
		return
	}
	if len(os.Args) == 2 && os.Args[1] == program.HealthcheckArgument {
		if err := program.CheckHealth(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	if len(os.Args) == 2 && os.Args[1] == program.PairingCodeArgument {
		if err := program.PrintPairingCode(os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	ranAsService, err := winservice.Run("DenWatcher", program.Run, func() func() {
		return addons.StartHost(os.Getenv("ADDONS_DIR"))
	})
	if !ranAsService && err == nil {
		// Only outside the service manager: Go turns a user logging off
		// Windows into SIGTERM, which would stop the service for good.
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		err = program.Run(ctx)
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
