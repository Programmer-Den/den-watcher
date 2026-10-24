// Command den-watcher-memory is the memory add-on of den-watcher: every
// few seconds it reads details of the machine's memory, such as how much is
// waiting to be written or held by the kernel and how many page faults and
// how much swapping happen per second, and writes them to the add-on folder
// (see package addons). On Linux it reads /proc, on Windows the Memory
// performance counters; elsewhere it writes no values.
//
// Settings come from environment variables:
//
//	ADDONS_DIR  the add-on folder den-watcher reads (default
//	            /run/den-watcher-addons, the folder the systemd service
//	            makes, and C:\ProgramData\Usage Control\addons on Windows)
//	HOST_PROC   where the host's /proc is, in a container (default /proc)
package main

import (
	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/memory"
)

func main() {
	addons.Main("memory", "UsageControlMemory", memory.New)
}
