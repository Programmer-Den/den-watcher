// Command den-watcher-bluetooth is the Bluetooth add-on of den-watcher:
// every few seconds it reads which Bluetooth devices are connected to the
// machine, with their name, kind or battery, from BlueZ over the system
// D-Bus on Linux, or only how many from /sys/class/bluetooth where BlueZ
// cannot be asked, and through the Bluetooth API on Windows, where the
// den-watcher service runs it as its child process, in the Local Service
// account. It writes them to the add-on folder (see package addons). On other
// systems it reports nothing.
//
// Settings come from environment variables:
//
//	ADDONS_DIR               the add-on folder den-watcher reads (default
//	                         /run/den-watcher-addons, the folder the
//	                         systemd service makes; on Windows
//	                         C:\ProgramData\Usage Control\addons)
//	HOST_SYS                 where the host's /sys is, in a container
//	                         (default /sys)
//	DBUS_SYSTEM_BUS_ADDRESS  where the system D-Bus is, in a container
//	                         (default unix:path=/var/run/dbus/system_bus_socket)
package main

import (
	"context"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/bluetooth"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

func main() {
	addons.Main("bluetooth", "UsageControlBluetooth", func() addons.Read {
		read := bluetooth.NewReader(sysfile.HostSys())
		return func(ctx context.Context, _ time.Time) []metrics.Extra {
			return bluetooth.Extras(read(ctx))
		}
	})
}
