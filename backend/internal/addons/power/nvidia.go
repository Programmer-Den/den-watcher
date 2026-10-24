package power

import (
	"context"
	"strconv"
	"strings"

	"github.com/Programmer-Den/den-watcher/backend/internal/addons"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// readNvidia reads the power draw of each NVIDIA GPU through nvidia-smi,
// which comes with the NVIDIA driver, run by calls. program is "" when it is
// not installed. While a call does not end, no GPU is reported.
func readNvidia(ctx context.Context, program string, calls *addons.Program) []Reading {
	if program == "" {
		return nil
	}
	out, _ := calls.NvidiaSMI(ctx, program, "--query-gpu=index,uuid,name,power.draw", "--format=csv,noheader,nounits")
	return parseNvidia(out)
}

// parseNvidia reads lines such as
// "0, GPU-1a2b3c4d-…, NVIDIA GeForce RTX 5060 Ti, 18.42". A GPU that does not
// report its power says "[N/A]" and is left out. Each GPU is named by
// metrics.NvidiaGPUKey, so its history stays with the card.
func parseNvidia(out string) []Reading {
	type gpu struct {
		index, uuid, name string
		watts             float64
		hasWatts          bool
	}
	var gpus []gpu
	// rows counts the GPUs nvidia-smi printed a row for, also one in an
	// error state whose row holds only errors, and those it cannot reach
	// (metrics.IsNvidiaLostGPU), so that the others keep their key while it
	// fails.
	rows := 0
	for line := range strings.Lines(out) {
		if metrics.IsNvidiaLostGPU(line) {
			rows++
			continue
		}
		fields := strings.Split(line, ",")
		if len(fields) < 4 {
			continue
		}
		rows++
		g := gpu{
			index: strings.TrimSpace(fields[0]),
			uuid:  strings.TrimSpace(fields[1]),
			// The name is the only field that could hold a comma.
			name: strings.TrimSpace(strings.Join(fields[2:len(fields)-1], ",")),
		}
		if _, err := strconv.Atoi(g.index); err != nil {
			continue
		}
		watts, err := strconv.ParseFloat(strings.TrimSpace(fields[len(fields)-1]), 64)
		g.watts, g.hasWatts = watts, err == nil
		gpus = append(gpus, g)
	}
	var readings []Reading
	for _, g := range gpus {
		if g.hasWatts {
			readings = append(readings, Reading{
				ID:    idOf("nvidia", metrics.NvidiaGPUKey(g.index, g.uuid, rows)),
				Label: g.name,
				Watts: g.watts,
			})
		}
	}
	return readings
}
