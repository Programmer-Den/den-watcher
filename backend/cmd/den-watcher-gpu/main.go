// Command den-watcher-gpu is the gpu add-on of den-watcher: every 30
// seconds (addons.ProgramInterval) it reads the fan, clocks, video encoder
// and decoder, performance state and power limit of the NVIDIA GPUs through
// nvidia-smi, and every few seconds it writes the last of them to the add-on
// folder (see package addons). Without nvidia-smi it reports nothing. On
// Windows the den-watcher service runs it as its child process.
//
// Settings come from environment variables:
//
//	ADDONS_DIR  the add-on folder den-watcher reads (default
//	            /run/den-watcher-addons, the folder the systemd service
//	            makes; on Windows C:\ProgramData\Usage Control\addons)
package main

import (
	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/addons/gpu"
)

func main() {
	addons.Main("gpu", "UsageControlGPU", func() addons.Read {
		return gpu.NewReader().Read
	})
}
