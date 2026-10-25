// Command den-watcher-wifi is the Wi-Fi add-on of den-watcher: every few
// seconds it reads the link quality and signal of each connected wireless
// interface, from /proc/net/wireless on Linux and through the Native Wifi API
// on Windows, and writes them to the add-on folder (see package addons). On
// other systems it reports nothing.
//
// Settings come from environment variables:
//
//	ADDONS_DIR  the add-on folder den-watcher reads (default
//	            /run/den-watcher-addons, the folder the systemd service
//	            makes)
//	HOST_PROC   on Linux, where the host's /proc is, in a container
//	            (default /proc)
package main

import (
	"context"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/wifi"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func main() {
	addons.Main("wifi", "UsageControlWifi", func() addons.Read {
		read := wifi.NewReader()
		return func(ctx context.Context, _ time.Time) []metrics.Extra {
			return wifi.Extras(read(ctx))
		}
	})
}
