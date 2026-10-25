package addons

import (
	"context"
	"errors"
	"os/exec"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// ErrProgramStuck is what Program.Output returns while a call of the program
// has not ended.
var ErrProgramStuck = errors.New("the program does not end")

// Program runs a program the add-on starts, such as nvidia-smi, one call at
// a time, and gives up waiting for a call that does not end. Killing a
// program stuck in the kernel, as nvidia-smi on a driver that fell off the
// bus can be, does not end it, so exec.Cmd's WaitDelay alone does not keep
// such a call from holding up the add-on for good. The zero Program is
// ready to use; it is not for use by several goroutines at once.
type Program struct {
	// running is closed when the call given up on ends; nil while there is
	// none.
	running chan struct{}
}

// Output returns what run returns, waiting for it at most giveUp. A call
// that takes longer goes on in the background, and until it ends, Output
// starts no other and returns ErrProgramStuck.
func (p *Program) Output(giveUp time.Duration, run func() (string, error)) (string, error) {
	if p.running != nil {
		select {
		case <-p.running:
			p.running = nil
		default:
			return "", ErrProgramStuck
		}
	}
	type result struct {
		out string
		err error
	}
	results := make(chan result, 1)
	running := make(chan struct{})
	go func() {
		out, err := run()
		results <- result{out, err}
		close(running)
	}()
	timer := time.NewTimer(giveUp)
	defer timer.Stop()
	select {
	case r := <-results:
		return r.out, r.err
	case <-timer.C:
		p.running = running
		return "", ErrProgramStuck
	}
}

// nvidiaTimeout is how long nvidia-smi may take. Without the driver's
// persistence mode, as on many Linux servers, each call starts the driver,
// which can take more than a second.
const nvidiaTimeout = 3 * time.Second

// NvidiaSMI runs nvidia-smi through p as metrics.RunNvidiaSMI does, killing it
// after nvidiaTimeout and waiting 2 seconds more for a kill that may not end
// it, and adds its error output to what it printed when it exits with an
// error, as that may hold the message for a GPU it cannot reach, which the
// add-ons show.
func (p *Program) NvidiaSMI(ctx context.Context, program string, args ...string) (string, error) {
	return p.Output(nvidiaTimeout+2*time.Second, func() (string, error) {
		ctx, cancel := context.WithTimeout(ctx, nvidiaTimeout)
		defer cancel()
		out, err := metrics.RunNvidiaSMI(ctx, program, args...)
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			out += string(exit.Stderr)
		}
		return out, err
	})
}
