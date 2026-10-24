// Command den-watcher-inodes is the inodes add-on of den-watcher: every
// few seconds it reads how many inodes (files and folders) each real mounted
// filesystem has in use and writes it to the add-on folder (see package
// addons). It runs on Linux only, as a service of its own; elsewhere it
// reports nothing.
//
// Settings come from environment variables:
//
//	ADDONS_DIR  the add-on folder den-watcher reads (default
//	            /run/den-watcher-addons, the folder the systemd service
//	            makes)
//	DOCKER_DIR  Docker's data folder where Docker keeps its data elsewhere
//	            than /var/lib/docker; what is mounted below it, other than a
//	            disk, is a container's and left out
package main

import (
	"context"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/inodes"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func main() {
	addons.Main("inodes", "UsageControlInodes", func() addons.Read {
		reader := inodes.NewReader("/proc/self/mounts")
		return func(context.Context, time.Time) []metrics.Extra {
			return inodes.Extras(reader.Read())
		}
	})
}
