// Command den-watcher-wifi is the Wi-Fi add-on of den-watcher: every few
// seconds it reads the link quality and signal of each connected wireless
// interface, from /proc/net/wireless on Linux and through the Native Wifi API
// on Windows, and the Wi-Fi networks nearby that the system's own scans
// found, every half minute (addons.ProgramInterval), on Windows asking for a
// scan of each connected interface every scanEvery, from NetworkManager
// over the system D-Bus on Linux and through the Native Wifi API on Windows, and writes them to the add-on folder (see
// package addons), the networks also each access point on its own, for a hub
// to compare what its devices see. On other systems it reports nothing.
//
// Settings come from environment variables:
//
//	ADDONS_DIR  the add-on folder den-watcher reads (default
//	            /run/den-watcher-addons, the folder the systemd service
//	            makes)
//	HOST_PROC   on Linux, where the host's /proc is, in a container
//	            (default /proc)
//	DBUS_SYSTEM_BUS_ADDRESS
//	            on Linux, where the system D-Bus is, in a container
//	            (default where the system keeps it)
//	WIFI_SCAN   on Windows, 0 to never ask for a scan, as a scan takes the
//	            Wi-Fi to other channels for a moment (default 1)
package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/wifi"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// scanEvery is how often the add-on asks Windows to scan a connected Wi-Fi
// interface, which Windows itself hardly does then: often enough that a
// laptop's networks show where it is now, seldom enough that the moment its
// Wi-Fi spends on other channels for a scan goes unnoticed.
const scanEvery = 5 * time.Minute

func main() {
	addons.MainReport("wifi", "UsageControlWifi", func() addons.ReadReport {
		read := wifi.NewReader()
		readNetworks := wifi.NewNetworksReader(scanInterval(os.Getenv("WIFI_SCAN")))
		// The nearby networks change only with the scans, which come every
		// few minutes, and asking for them brings back all
		// of NetworkManager's objects or the whole BSS list, so they are
		// read every ProgramInterval and the last list is used in between.
		var networks []wifi.AccessPoint
		var networksRead time.Time
		return func(ctx context.Context, now time.Time) metrics.AddOnReport {
			if addons.Due(networksRead, now, addons.ProgramInterval) {
				networks, networksRead = readNetworks(ctx), now
			}
			return metrics.AddOnReport{
				Extras: append(wifi.Extras(read(ctx)), wifi.NetworkExtras(networks)...),
				WiFi:   wifi.Nearby(networks),
			}
		}
	})
}

// scanInterval is how often the add-on asks for a scan with the WIFI_SCAN
// setting value: scanEvery, or 0 for never with 0. The installer refuses
// any other value than 0 or 1, so one that gets here anyway is warned about
// and scans.
func scanInterval(value string) time.Duration {
	switch strings.TrimSpace(value) {
	case "0":
		return 0
	case "", "1":
	default:
		slog.Warn("WIFI_SCAN must be 0 or 1, so the add-on asks for scans", "WIFI_SCAN", value)
	}
	return scanEvery
}
