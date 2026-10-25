//go:build !windows

package memory

import (
	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

// New returns what reads the memory details of this machine: /proc, which
// only Linux has, so elsewhere it reads nothing.
func New() addons.Read {
	return NewReader(sysfile.HostProc()).Read
}
