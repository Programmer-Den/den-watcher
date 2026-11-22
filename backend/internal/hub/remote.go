package hub

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// Remote is another device the hub collects from.
type Remote struct {
	Device
	// Fixed is set for a device from HUB_DEVICES, HUB_ROUTERS or
	// HUB_CHECKS, which the page cannot remove.
	Fixed  bool
	Agent  *Agent
	Reader history.Reader

	db *sql.DB
	// watched is the recorder's view of the device, which knows an outage
	// that lasts.
	watched  *watchedAgent
	stop     context.CancelFunc
	recorded chan struct{}

	// mu guards kind and name, which the page can change. Device.Name
	// stays the name the device was started with; name is the one shown.
	mu   sync.Mutex
	kind Kind
	name string

	// phone keeps what a phone pushed; nil for any other device.
	phone *phone
}

// Usage reads the usage of the machine the hub runs on.
type Usage interface {
	Collect(ctx context.Context) (metrics.Snapshot, error)
}

// Unreachable reports whether the device has not answered recently, and since
// when it does not; since is zero when that is not known yet.
func (r *Remote) Unreachable() (since time.Time, unreachable bool) {
	if r.Agent.answers() {
		return time.Time{}, false
	}
	if outage, _, ok := r.watched.ongoing(); ok {
		return outage.Start, true
	}
	return time.Time{}, true
}

// Refused reports whether the hub did not connect to the device the last
// time it tried, as its address is the hub's own (see watchedAgent.Collect),
// and only while the device does not answer (see Unreachable): a reading
// refused right after one that was answered does not count yet.
func (r *Remote) Refused() bool {
	return !r.Agent.answers() && r.watched.isRefused()
}

// Router reports whether the device is a router, which the hub reads in a
// language it speaks.
func (r *Remote) Router() bool {
	return r.ReadByHub() && !r.Checked && !r.Phone
}

// Kind tells what the device is used as.
func (r *Remote) Kind() Kind {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.kind
}

// ShownName returns the device's name, as it was last renamed to.
func (r *Remote) ShownName() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.name
}

// Availability tells how long the device did not answer since it was added.
func (r *Remote) Availability(ctx context.Context) (Availability, error) {
	availability, err := readAvailability(ctx, r.db, r.ID)
	if err != nil {
		return Availability{}, err
	}
	availability.Kind = r.Kind()
	// An outage that lasts is in the database only up to its last write; its
	// current end is known in memory.
	if outage, unwritten, ok := r.watched.ongoing(); ok {
		availability.LastOutage = &outage
		availability.OfflineSeconds += int64(unwritten / time.Second)
	}
	return availability, nil
}

// OutagesBetween returns the times the device did not answer from from to to,
// oldest first, the one that lasts included.
func (r *Remote) OutagesBetween(ctx context.Context, from, to time.Time) ([]Outage, error) {
	outages, err := readOutages(ctx, r.db, r.ID, from, to)
	if err != nil {
		return nil, err
	}
	// An outage that lasts is in the database only up to its last write.
	if outage, _, ok := r.watched.ongoing(); ok && !outage.Start.After(to) && !outage.End.Before(from) {
		if n := len(outages); n > 0 && outages[n-1].Start.Equal(outage.Start) {
			outages[n-1] = outage
		} else {
			outages = append(outages, outage)
		}
	}
	return outages, nil
}
