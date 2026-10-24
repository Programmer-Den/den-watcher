// Command den-watcher-power is the power add-on of den-watcher: every
// few seconds it reads how much power the machine draws and writes it to the
// add-on folder (see package addons). It runs as root on Linux, as newer
// kernels let only root read the CPU's energy counters; den-watcher itself
// stays without privileges. On Windows, where it reads the energy meters and
// batteries Windows offers and NVIDIA GPUs, the den-watcher service runs it
// as its child process, in the Local Service account.
//
// Settings come from environment variables:
//
//	ADDONS_DIR  the add-on folder den-watcher reads (default
//	            /run/den-watcher-addons, the folder the systemd service
//	            makes; on Windows C:\ProgramData\Usage Control\addons)
//	HOST_SYS    where the host's /sys is, in a container (default /sys)
package main

import (
	"context"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/power"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

func main() {
	addons.Main("power", "UsageControlPower", func() addons.Read {
		reader := power.NewReader(sysfile.HostSys())
		return func(ctx context.Context, now time.Time) []metrics.Extra {
			return power.Extras(reader.Read(ctx, now))
		}
	})
}
