//go:build !windows

package pressure

import (
	"log/slog"
	"os"
	"path/filepath"
	"runtime"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

// NewReader returns what reads the pressure: on Linux the files in
// /proc/pressure under HostProc; other systems have none and report nothing.
func NewReader() func() []metrics.Extra {
	procDir := sysfile.HostProc()
	if runtime.GOOS == "linux" {
		if _, err := os.Stat(filepath.Join(procDir, "pressure")); err != nil {
			slog.Warn("the kernel reports no pressure stall information (PSI); on Raspberry Pi OS, add psi=1 to /boot/firmware/cmdline.txt and restart",
				"folder", filepath.Join(procDir, "pressure"))
		}
	}
	return func() []metrics.Extra { return Read(procDir) }
}
