package power

import (
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

// lastReadings keeps the readings of a program the add-on starts, vcgencmd
// or nvidia-smi, for interval, or addons.ProgramInterval when it is 0.
type lastReadings struct {
	interval time.Duration
	readings []Reading
	at       time.Time
}

// get returns the kept readings until they are due again (see addons.Due),
// and then those read returns.
func (l *lastReadings) get(now time.Time, read func() []Reading) []Reading {
	interval := l.interval
	if interval == 0 {
		interval = addons.ProgramInterval
	}
	if addons.Due(l.at, now, interval) {
		l.readings, l.at = read(), now
	}
	return l.readings
}

// lookPath returns where a program is, or "" when it is not installed.
func lookPath(name string) string {
	path, err := exec.LookPath(name)
	if err != nil {
		return ""
	}
	return path
}

// idOf turns parts of a name into an id for an extra: lowercase letters and
// digits joined by "-", at most 40 characters. A longer one is cut and ends
// in a checksum of the whole, so two names that start the same keep apart.
func idOf(parts ...string) string {
	return metrics.ShortID(strings.Join(parts, "-"), 40)
}

// readUint reads a file under /sys that holds one whole number, such as a
// RAPL zone's energy counter. It is false when the file cannot be read or
// holds no such number; a read that fails for another reason than a missing
// file, such as a counter only root may read, is logged once.
func readUint(path string) (uint64, bool) {
	text, err := sysfile.Read(path)
	addons.WarnRead(path, err)
	n, err := strconv.ParseUint(strings.TrimSpace(string(text)), 10, 64)
	return n, err == nil
}
