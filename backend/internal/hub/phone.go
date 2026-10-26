package hub

import (
	"context"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

// PhoneMinutesPath is where a phone sends the hub the minutes it kept of its
// own usage, with its newest reading: POST /api/phone/minutes, with the
// phone's pairing code in pairing.CodeHeader and a Push as the body,
// answered with a PushAnswer. A phone is often away from the hub and asleep,
// so it comes to the hub when it is back, instead of the hub asking it.
const PhoneMinutesPath = "/api/phone/minutes"

// MaxPushBytes is the largest body of a push that is read: as much as the
// hub reads of an answer to GET /api/minutes.
const MaxPushBytes = maxMinutesBytes

// phoneFresh is how long a phone counts as within reach after its last push.
// A phone sends one every half minute or so while it reaches the hub; one
// that sent none for longer is away or asleep, which is time it was not in
// use, as for a PC that is switched off.
const phoneFresh = 90 * time.Second

// Push is the body of POST /api/phone/minutes. Times are Unix seconds on the
// phone's clock.
type Push struct {
	// Now is the phone's time when it sent the push.
	Now int64 `json:"now"`
	// Snapshot is the phone's newest reading, shown on the page while the
	// phone is within reach; nil sends none.
	Snapshot *metrics.Snapshot `json:"snapshot,omitempty"`
	// Minutes are the averages the phone kept, oldest first, at most
	// MinutesPerAnswer of them and ValuesPerAnswer values in all; a phone
	// with more sends them in several pushes.
	Minutes []history.Minute `json:"minutes"`
	// Extras describes the extras among the minutes, as in a MinutesAnswer.
	Extras map[string]history.ExtraInfo `json:"extras,omitempty"`
	// NeedKey is set by an app that has no key of the hub yet, which the
	// answer then gives it.
	NeedKey bool `json:"needKey,omitempty"`
}

// ReleaseTime is how long a phone may change its hub once the hub's owner
// allowed it (see ReleasePhone).
const ReleaseTime = 10 * time.Minute

// PushAnswer is the answer to a push.
type PushAnswer struct {
	// After is the phone's time of the newest minute the hub has: the phone
	// may delete it and the ones before.
	After int64 `json:"after"`
	// Release is set while the phone may change its hub. Its app keeps the
	// hub's address and recording locked once the hub took a push, until a
	// push is answered with it and a ReleaseProof it checks with its key.
	Release bool `json:"release,omitempty"`
	// ReleaseSeconds is how much longer the phone may change its hub, which
	// the app counts on its own clock.
	ReleaseSeconds int64 `json:"releaseSeconds,omitempty"`
	// ReleaseProof proves the release with the phone's key, for the push's
	// Now and ReleaseSeconds (see releaseProof).
	ReleaseProof string `json:"releaseProof,omitempty"`
	// Key is the phone's key in hex, given when the push asked for it (see
	// Push.NeedKey). The app takes it only while it has none.
	Key string `json:"key,omitempty"`
}

// ErrUnknownPhone is a push with a code no phone added on the hub has.
var ErrUnknownPhone = errors.New("no phone added on the hub has this pairing code")

// ErrPushTooLarge is a push with more minutes or values than one push may
// have.
var ErrPushTooLarge = fmt.Errorf("a push may have at most %d minutes and %d values; send the rest in another push", MinutesPerAnswer, ValuesPerAnswer)

// phone keeps what a phone pushed: its newest reading, which the hub's
// recorder of it reads as it reads a router, and up to which minute it has
// the phone's minutes.
type phone struct {
	mu       sync.Mutex
	latest   metrics.Snapshot
	latestAt time.Time
	// releasedUntil is until when the phone may change its hub; zero when
	// it was never allowed.
	releasedUntil time.Time

	// pushing makes the pushes of one phone store their minutes one at a
	// time, as each goes on from where the one before stopped.
	pushing sync.Mutex
	minutes *fetcher
	// gone is set, under pushing, once the phone was removed, so a push
	// that found it before stores nothing after its data was deleted.
	gone bool
}

// Collect returns the phone's newest reading, or ErrUnreachable when it has
// sent none for phoneFresh.
func (p *phone) Collect(context.Context) (metrics.Snapshot, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.latestAt.IsZero() || time.Since(p.latestAt) > phoneFresh {
		return metrics.Snapshot{}, ErrUnreachable
	}
	return p.latest, nil
}

// AddPhone keeps a phone in the database, with the pairing code it shows,
// which it sends with every push. A phone has no address: it comes to the
// hub. Problems with the phone are InputErrors.
func (h *Hub) AddPhone(ctx context.Context, name, code string) (Device, error) {
	name = strings.TrimSpace(name)
	id, err := checkName(name)
	if err != nil {
		return Device{}, err
	}
	code, err = checkCode(code)
	if err != nil {
		return Device{}, err
	}
	if code == "" {
		return Device{}, &InputError{Problem: ProblemPairingNeeded, Message: "give the pairing code the phone shows, such as 7KQM-X2RP"}
	}
	if err := checkPhoneCode(code); err != nil {
		return Device{}, err
	}
	device := Device{ID: id, Name: name, Phone: true}
	if err := h.waitRemoved(ctx, device.ID, removingWait); err != nil {
		return Device{}, err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.stopping(); err != nil {
		return Device{}, err
	}
	if err := h.taken(device); err != nil {
		return Device{}, err
	}
	if h.phoneWith(code) != nil {
		return Device{}, &InputError{Problem: ProblemPairingTaken, Message: "another phone has this pairing code; give the code this phone shows"}
	}
	if err := h.save(context.WithoutCancel(ctx), device, KindPhone, code); err != nil {
		return Device{}, err
	}
	h.start(device, false, nil)
	return device, nil
}

// phoneWith returns the phone with the pairing code, or nil. Every phone's
// code is compared in full, so how long that takes does not tell how much
// of a code was right. No code is no phone's, also not one whose code could
// not be read at the start. The caller holds mu.
func (h *Hub) phoneWith(code string) *Remote {
	if code == "" {
		return nil
	}
	var found *Remote
	for _, r := range h.remotes {
		if r.phone != nil && subtle.ConstantTimeCompare([]byte(r.Agent.pairingCode()), []byte(code)) == 1 {
			found = r
		}
	}
	return found
}

// Receive takes a push from the phone with the pairing code, in capitals or
// small letters and with or without the dash and spaces: it keeps its
// reading and stores its minutes the hub does not have yet, as it stores the
// minutes it fetches from a device. It returns the phone's time of the
// newest minute the hub has.
func (h *Hub) Receive(ctx context.Context, code string, push Push) (PushAnswer, error) {
	values := 0
	for _, minute := range push.Minutes {
		values += len(minute.Values)
	}
	if len(push.Minutes) > MinutesPerAnswer || values > ValuesPerAnswer && len(push.Minutes) > 1 {
		return PushAnswer{}, ErrPushTooLarge
	}
	h.mu.Lock()
	remote := h.phoneWith(pairing.Normalize(code))
	h.mu.Unlock()
	if remote == nil {
		return PushAnswer{}, ErrUnknownPhone
	}
	key := phoneKey(h.phoneSecret, pairing.Normalize(code))
	answer, err := remote.phone.receive(ctx, push, time.Now(), key)
	if err == nil && push.NeedKey {
		give, err := giveKey(context.WithoutCancel(ctx), h.store.DB(), key)
		if err != nil {
			return PushAnswer{}, err
		}
		if give {
			answer.Key = hex.EncodeToString(key)
		}
	}
	return answer, err
}

// receive keeps the reading of a push, received at now, and stores its
// minutes, unless the phone was removed since it was found. key is the
// phone's key, which proves a release.
func (p *phone) receive(ctx context.Context, push Push, now time.Time, key []byte) (PushAnswer, error) {
	p.pushing.Lock()
	defer p.pushing.Unlock()
	// Its minutes would outlast its deleted history.
	if p.gone {
		return PushAnswer{}, ErrUnknownPhone
	}
	if push.Snapshot != nil {
		snapshot := *push.Snapshot
		// The newest reading shows when the hub received it, as for a
		// device whose clock is off.
		snapshot.Time = now.UTC()
		p.mu.Lock()
		p.latest, p.latestAt = snapshot, now
		p.mu.Unlock()
	}
	after, err := p.minutes.receive(ctx, MinutesAnswer{Now: push.Now, Minutes: push.Minutes, Extras: push.Extras}, now)
	answer := PushAnswer{After: after}
	if until := p.released(now); !until.IsZero() {
		// Rounded up, so the last moments are not lost to the rounding.
		answer.Release = true
		answer.ReleaseSeconds = int64((until.Sub(now) + time.Second - 1) / time.Second)
		answer.ReleaseProof = releaseProof(key, push.Now, answer.ReleaseSeconds)
	}
	return answer, err
}

// ReleasePhone lets the phone with the id change its hub for ReleaseTime,
// which its app is told in the answers to its pushes, and returns until when.
// Problems with the device are InputErrors.
func (h *Hub) ReleasePhone(id string) (time.Time, error) {
	h.mu.Lock()
	remote := h.find(id)
	h.mu.Unlock()
	if remote == nil {
		return time.Time{}, &InputError{Problem: ProblemNotFound, Message: "there is no device with this id"}
	}
	if remote.phone == nil {
		return time.Time{}, &InputError{Problem: ProblemKind, Message: "only a phone keeps its hub locked; other devices are added to another hub there"}
	}
	if err := regiveKey(h.ctx, h.store.DB(), phoneKey(h.phoneSecret, remote.Agent.pairingCode())); err != nil {
		return time.Time{}, err
	}
	now := time.Now()
	remote.phone.mu.Lock()
	remote.phone.releasedUntil = now.Add(ReleaseTime)
	remote.phone.mu.Unlock()
	slog.Info("let a phone change its hub", "name", remote.Name, "for", ReleaseTime)
	return remote.phone.released(now), nil
}

// ReleasedUntil is until when the phone may change its hub; zero for any
// other device and once that time is over.
func (r *Remote) ReleasedUntil() time.Time {
	if r.phone == nil {
		return time.Time{}
	}
	return r.phone.released(time.Now())
}

// released is until when the phone may change its hub, seen at now; zero
// once that is over.
func (p *phone) released(now time.Time) time.Time {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !now.Before(p.releasedUntil) {
		return time.Time{}
	}
	return p.releasedUntil
}

// receive stores the minutes a phone pushed, as fetch stores the ones it
// fetches, with the phone's clock measured from answer.Now, sent at now on
// the hub's clock. It returns the phone's time of the newest minute stored.
func (f *fetcher) receive(ctx context.Context, answer MinutesAnswer, now time.Time) (int64, error) {
	measured := now.Sub(time.Unix(answer.Now, 0)).Round(time.Second)
	if moved := measured - time.Duration(f.offset)*time.Second; moved > maxClockJitter || moved < -maxClockJitter {
		f.offset = int64(measured / time.Second)
	}
	if f.after > answer.Now {
		slog.Info("the clock of the phone went back; taking its minutes again from shortly before the newest one the hub has, at the phone's new time", "device", f.device)
		f.after = 0
	}
	if f.after == 0 {
		newest, ok, err := f.store.Newest(ctx, f.device)
		if err != nil {
			return 0, err
		}
		if !ok {
			newest = time.Unix(0, 0)
		}
		// As in fetch: a few minutes before the hub's newest, and not later
		// than the phone's time.
		f.after = max(1, min(newest.Add(-keptWithin).Unix()-f.offset, answer.Now-int64(maxClockJitter/time.Second)))
	}
	if f.retention > 0 {
		f.after = max(f.after, now.Add(-f.retention).Unix()-f.offset)
	}
	minutes, after := f.clean(answer)
	if err := f.describe(ctx, answer.Extras, minutes); err != nil {
		return 0, err
	}
	if err := f.store.AddMinutes(ctx, f.device, minutes); err != nil {
		return 0, err
	}
	f.after = after
	return after, nil
}

// phoneFetch is the Fetch of the recorder of a phone: the phone pushes its
// minutes itself, so the recorder never stores the average of the readings
// it was pushed, which would only repeat them.
func phoneFetch(context.Context, time.Time) bool {
	return true
}
