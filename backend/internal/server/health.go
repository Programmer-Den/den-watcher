package server

import (
	"math"
	"net/http"

	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/update"
	"github.com/Programmer-Den/den-watcher/backend/internal/version"
)

// clockOffLimit is how far, in seconds, a device's clock may be from the
// hub's before the health list names it; the measured offset includes the
// time the answer took and the device's reading kept for a few seconds.
const clockOffLimit = 60

// The kinds of healthProblem.
const (
	// problemPairing: the device waits for its pairing code; Detail is
	// "needed" or "wrong", as Device.Pairing.
	problemPairing = "pairing"
	// problemVersion: the device runs an older release than the hub; Detail
	// is its version.
	problemVersion = "version"
	// problemAddOn: an add-on on the device stopped; Detail is its name.
	problemAddOn = "addOn"
	// problemClock: the device's clock is off from the hub's; Seconds is
	// how far ahead it is, behind when negative.
	problemClock = "clock"
)

// healthProblem is one thing about how a device is set up that needs a look.
type healthProblem struct {
	Device  string  `json:"device"`
	Kind    string  `json:"kind"`
	Detail  string  `json:"detail,omitempty"`
	Seconds float64 `json:"seconds,omitempty"`
}

// healthResponse is the answer to GET /api/devices/health.
type healthResponse struct {
	// Version is the hub's own, which the versions of the devices are
	// compared with.
	Version  string          `json:"version"`
	Problems []healthProblem `json:"problems"`
}

// healthHandler serves GET /api/devices/health: what needs a look in how the
// devices are set up, all of them in one list: a pairing code missing, an
// older version than the hub's, an add-on that stopped and a clock that is
// off. It reads the devices' usage as GET /api/devices/metrics does.
func healthHandler(devices Devices) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		list := devices.List()
		writeJSON(w, http.StatusOK, healthResponse{
			Version:  version.Version,
			Problems: healthProblems(list, readAll(r.Context(), list), version.Version),
		})
	}
}

// healthProblems lists the problems of each device in list, in its order,
// from its usage in usage, by its id; hubVersion is the hub's own version.
func healthProblems(list []Device, usage map[string]metrics.Snapshot, hubVersion string) []healthProblem {
	problems := []healthProblem{}
	for _, d := range list {
		if d.Pairing != "" {
			problems = append(problems, healthProblem{Device: d.ID, Kind: problemPairing, Detail: d.Pairing})
		}
		s, ok := usage[d.ID]
		if !ok {
			continue
		}
		if d.ID != hub.LocalID && update.Newer(hubVersion, s.Version) {
			problems = append(problems, healthProblem{Device: d.ID, Kind: problemVersion, Detail: s.Version})
		}
		for _, name := range s.AddOnsStopped {
			problems = append(problems, healthProblem{Device: d.ID, Kind: problemAddOn, Detail: name})
		}
		if c := s.ClockOffsetSeconds; c != nil && math.Abs(*c) >= clockOffLimit {
			problems = append(problems, healthProblem{Device: d.ID, Kind: problemClock, Seconds: *c})
		}
	}
	return problems
}
