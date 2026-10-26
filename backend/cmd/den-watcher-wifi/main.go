// Command den-watcher-wifi is the Wi-Fi add-on of den-watcher: every few
// seconds it reads the link quality and signal of each connected wireless
// interface, from /proc/net/wireless on Linux and through the Native Wifi API
// on Windows, and the Wi-Fi networks nearby that the system's own scans
// found, from NetworkManager over the system D-Bus on Linux and through the
// Native Wifi API on Windows, and writes them to the add-on folder (see
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
package main

import (
	"context"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/wifi"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func main() {
	addons.MainReport("wifi", "UsageControlWifi", func() addons.ReadReport {
		read := wifi.NewReader()
		readNetworks := wifi.NewNetworksReader()
		return func(ctx context.Context, _ time.Time) metrics.AddOnReport {
			networks := readNetworks(ctx)
			return metrics.AddOnReport{
				Extras: append(wifi.Extras(read(ctx)), wifi.NetworkExtras(networks)...),
				WiFi:   wifi.Nearby(networks),
			}
		}
	})
}
