// Command den-watcher-containers is the containers add-on of
// den-watcher: every few seconds it reads the CPU and memory each running
// container uses, from the kernel's cgroups (v2 only), and writes them to the
// add-on folder (see package addons). It never talks to Docker or Podman. It
// runs as root on Linux, without any capability, to read the names of
// Docker's containers from its data folder; without that right it names them
// by their short id. It reads nothing on other systems.
//
// Settings come from environment variables:
//
//	ADDONS_DIR  the add-on folder den-watcher reads (default
//	            /run/den-watcher-addons, the folder the systemd service
//	            makes)
//	HOST_SYS    where the host's /sys is, in a container (default /sys)
//	DOCKER_DIR  Docker's data folder, whose containers folder holds the
//	            containers' names (default /var/lib/docker)
package main

import (
	"context"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/containers"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

func main() {
	addons.Main("containers", "UsageControlContainers", func() addons.Read {
		reader := containers.NewReader(sysfile.HostSys(), containers.DockerDir())
		return func(_ context.Context, now time.Time) []metrics.Extra {
			return containers.Extras(reader.Read(now))
		}
	})
}
