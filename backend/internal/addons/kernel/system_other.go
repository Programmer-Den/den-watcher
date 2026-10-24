//go:build !windows

package kernel

import "github.com/Programmer-Den/den-watcher/backend/internal/sysfile"

// NewSystemReader returns the reader of this machine: /proc, which only
// Linux has; on other systems it finds nothing.
func NewSystemReader() Source {
	return NewReader(sysfile.HostProc())
}
