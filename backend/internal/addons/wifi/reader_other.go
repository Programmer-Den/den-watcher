//go:build !windows

package wifi

import (
	"context"
	"path/filepath"

	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

// NewReader returns what reads each connected wireless interface: from the
// host's /proc/net/wireless, which only Linux has; elsewhere it reads
// nothing.
func NewReader() func(context.Context) []Reading {
	// The first process's, since /proc/net describes the network of the
	// reading process, which in a container or a service without network is
	// not the host's.
	file := filepath.Join(sysfile.HostProc(), "1", "net", "wireless")
	return func(context.Context) []Reading { return Read(file) }
}
