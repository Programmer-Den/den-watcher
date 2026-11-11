package hub

import (
	"cmp"
	"context"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

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
	// WiFi are the scans of the Wi-Fi networks nearby the phone kept, oldest
	// first, at most ScansPerPush of them, also from while it was away, so
	// the hub can tell where it was.
	WiFi []PhoneScan `json:"wifi,omitempty"`
	// Uses are the times apps were in use on the phone and it was unlocked,
	// which the phone kept, at most UsesPerPush of them, also from while it
	// was away. Each is sent once it is over.
	Uses []PhoneUse `json:"uses,omitempty"`
	// Connections are the times the phone was connected to a Wi-Fi, which
	// it kept, at most ConnectionsPerPush of them, also from while it was
	// away. The one that goes on is sent again every few minutes with its
	// new end, and once more when it is over.
	Connections []PhoneConnection `json:"connections,omitempty"`
	// Route are the points of the phone's location route, which it kept,
	// oldest first, at most RoutePerPush of them, also from while it was
	// away.
	Route []PhonePoint `json:"route,omitempty"`
}

// PhonePoint is where a phone was at one time, as its app read it from
// Android with the location permission.
type PhonePoint struct {
	// ID is the phone's number for it, up to which the answer's RouteAfter
	// tells the hub has them.
	ID int64 `json:"id"`
	// Time is when the phone was there, Unix milliseconds on its clock.
	Time int64 `json:"time"`
	// Lat and Lon are degrees north and east.
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
	// Accuracy is how far off the point may be, in meters, as Android
	// tells it.
	Accuracy float64 `json:"accuracy"`
}

// RoutePerPush is how many points of the route one push may have.
const RoutePerPush = 500

// maxAccuracy is the vaguest point of a route kept, in meters: one Android
// made from a far cell tower tells nothing of the way.
const maxAccuracy = 2000

// PhoneConnection is one time a phone was connected to a Wi-Fi. Times are
// Unix milliseconds on the phone's clock.
type PhoneConnection struct {
	// ID is the phone's number for it, up to which the answer's
	// ConnectionsAfter tells the hub has them.
	ID int64 `json:"id"`
	// SSID is the Wi-Fi's name.
	SSID string `json:"ssid"`
	// Start is when the phone was first found on it, End when it was last.
	Start int64 `json:"start"`
	End   int64 `json:"end"`
	// Open is set while the phone is still on it.
	Open bool `json:"open,omitempty"`
}

// ConnectionsPerPush is how many connections to a Wi-Fi one push may have.
const ConnectionsPerPush = 500

// maxSSID is the longest name of a Wi-Fi kept, in bytes: 32 bytes, which
// Android tells as 64 hex digits when they are no text.
const maxSSID = 64

// PhoneUse is one time an app was in use on a phone, or the phone was
// unlocked. Times are Unix milliseconds on the phone's clock.
type PhoneUse struct {
	// ID is the phone's number for it, up to which the answer's UsesAfter
	// tells the hub has them.
	ID int64 `json:"id"`
	// App is the app's package name, such as org.mozilla.firefox; empty for
	// an unlock.
	App string `json:"app,omitempty"`
	// Label is the app's name as the phone shows it.
	Label string `json:"label,omitempty"`
	// Start is when it started.
	Start int64 `json:"start"`
	// Millis is how long the app was in use; 0 for an unlock.
	Millis int64 `json:"millis,omitempty"`
}

// UsesPerPush is how many uses of apps one push may have.
const UsesPerPush = 500

// maxAppName is the longest package name or app name kept, in bytes; a
// longer one is cut.
const maxAppName = 200

// PhoneScan is what a phone's Wi-Fi saw nearby at Time, Unix seconds on the
// phone's clock.
type PhoneScan struct {
	Time         int64                       `json:"time"`
	AccessPoints []metrics.NearbyAccessPoint `json:"accessPoints"`
}

// ScansPerPush is how many scans one push may have.
const ScansPerPush = 30

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
	// WiFiAfter is the phone's time of the newest scan the hub has: the
	// phone may delete it and the ones before.
	WiFiAfter int64 `json:"wifiAfter,omitempty"`
	// UsesAfter is the largest ID of the uses of apps of the push, once the
	// hub has them: the phone may delete them and the ones with smaller IDs.
	UsesAfter int64 `json:"usesAfter,omitempty"`
	// ConnectionsAfter is the largest ID of the connections to a Wi-Fi of
	// the push, once the hub has them: the phone may delete the ones that
	// are over, up to it.
	ConnectionsAfter int64 `json:"connectionsAfter,omitempty"`
	// RouteAfter is the largest ID of the points of the route of the push,
	// once the hub has them: the phone may delete them and the ones with
	// smaller IDs.
	RouteAfter int64 `json:"routeAfter,omitempty"`
}

// ErrUnknownPhone is a push with a code no phone added on the hub has.
var ErrUnknownPhone = errors.New("no phone added on the hub has this pairing code")

// ErrPushTooLarge is a push with more minutes or values than one push may
// have.
var ErrPushTooLarge = fmt.Errorf("a push may have at most %d minutes, %d values, %d scans, %d uses of apps, %d connections to a Wi-Fi and %d points of the route; send the rest in another push", MinutesPerAnswer, ValuesPerAnswer, ScansPerPush, UsesPerPush, ConnectionsPerPush, RoutePerPush)

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
	// regive lets the phone's key be given once more while it may change
	// its hub, as when the answer that gave it was lost.
	regive bool

	// pushing makes the pushes of one phone store their minutes one at a
	// time, as each goes on from where the one before stopped.
	pushing sync.Mutex
	minutes *fetcher
	// gone is set, under pushing, once the phone was removed, so a push
	// that found it before stores nothing after its data was deleted.
	gone bool
	// wifiAfter is the phone's time of the newest scan counted, under
	// pushing.
	wifiAfter int64
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
	if len(push.Minutes) > MinutesPerAnswer || values > ValuesPerAnswer && len(push.Minutes) > 1 || len(push.WiFi) > ScansPerPush || len(push.Uses) > UsesPerPush || len(push.Connections) > ConnectionsPerPush || len(push.Route) > RoutePerPush {
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
		if give || remote.phone.takeRegive(time.Now()) {
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
	if err == nil {
		answer.WiFiAfter, err = p.receiveWiFi(ctx, push, now)
	}
	if err == nil {
		answer.UsesAfter, err = p.receiveUses(ctx, push, now)
	}
	if err == nil {
		answer.ConnectionsAfter, err = p.receiveConnections(ctx, push, now)
	}
	if err == nil {
		answer.RouteAfter, err = p.receiveRoute(ctx, push, now)
	}
	if until := p.released(now); !until.IsZero() {
		// Rounded up, so the last moments are not lost to the rounding.
		answer.Release = true
		answer.ReleaseSeconds = int64((until.Sub(now) + time.Second - 1) / time.Second)
		answer.ReleaseProof = releaseProof(key, push.Now, answer.ReleaseSeconds)
	}
	return answer, err
}

// receiveWiFi counts the scans of a push the hub does not have yet into the
// Wi-Fi history, at their time on the hub's clock, as the minutes are moved
// (see fetcher.receive), keeps each of them on its own too, for the points
// of the phone's route, and returns the phone's time of the newest scan it
// has. A scan older than the retention or from the future is left out, but
// counts as had, so the phone deletes it. The caller holds pushing.
func (p *phone) receiveWiFi(ctx context.Context, push Push, now time.Time) (int64, error) {
	f := p.minutes
	if p.wifiAfter > push.Now {
		// The phone's clock went back.
		p.wifiAfter = 0
	}
	scans := slices.Clone(push.WiFi)
	slices.SortStableFunc(scans, func(a, b PhoneScan) int { return cmp.Compare(a.Time, b.Time) })
	for _, scan := range scans {
		if scan.Time <= p.wifiAfter {
			continue
		}
		p.wifiAfter = scan.Time
		at := time.Unix(scan.Time+f.offset, 0)
		if at.After(now.Add(maxClockJitter)) || f.retention > 0 && at.Before(now.Add(-f.retention)) {
			continue
		}
		nearby := metrics.CleanNearbyWiFi(&metrics.NearbyWiFi{AccessPoints: scan.AccessPoints})
		f.store.AddWiFi(f.device, at, nearby)
		if err := f.store.AddPhoneScan(ctx, f.device, at, nearby.AccessPoints); err != nil {
			return 0, err
		}
	}
	return p.wifiAfter, nil
}

// receiveUses stores the uses of apps of a push, at their start on the hub's
// clock, as the minutes are moved (see fetcher.receive), and returns the
// largest ID among them, or 0 when it has none. A use older than the
// retention or from the future is left out, but counts as had, so the phone
// deletes it, and so does one that makes no sense, such as one longer than a
// day. The caller holds pushing.
func (p *phone) receiveUses(ctx context.Context, push Push, now time.Time) (int64, error) {
	f := p.minutes
	var after int64
	uses := make([]history.AppUse, 0, len(push.Uses))
	for _, u := range push.Uses {
		after = max(after, u.ID)
		start := u.Start + f.offset*1000
		if u.Millis < 0 || u.Millis > 24*int64(time.Hour/time.Millisecond) || u.Start <= 0 ||
			start > now.Add(maxClockJitter).UnixMilli() || f.retention > 0 && start < now.Add(-f.retention).UnixMilli() {
			continue
		}
		if u.App == "" && u.Millis > 0 {
			continue
		}
		uses = append(uses, history.AppUse{
			App:        cut(u.App, maxAppName),
			Label:      cut(strings.TrimSpace(u.Label), maxAppName),
			PhoneStart: u.Start,
			Start:      start,
			Millis:     u.Millis,
		})
	}
	if err := f.store.AddAppUses(ctx, f.device, uses); err != nil {
		return 0, err
	}
	return after, nil
}

// receiveConnections stores the connections to a Wi-Fi of a push, at their
// times on the hub's clock, as the minutes are moved (see fetcher.receive),
// and returns the largest ID among them, or 0 when it has none. A connection
// that ended before the retention or starts in the future is left out, but
// counts as had, so the phone deletes it, and so does one that makes no
// sense, such as one without a name or that ends before it starts. One that
// goes on into the future, as by a clock that jumped, ends now. The caller
// holds pushing.
func (p *phone) receiveConnections(ctx context.Context, push Push, now time.Time) (int64, error) {
	f := p.minutes
	var after int64
	latest := now.Add(maxClockJitter).UnixMilli()
	connections := make([]history.WiFiConnection, 0, len(push.Connections))
	for _, c := range push.Connections {
		after = max(after, c.ID)
		ssid := cut(strings.TrimSpace(c.SSID), maxSSID)
		start, end := c.Start+f.offset*1000, c.End+f.offset*1000
		if ssid == "" || c.Start <= 0 || c.End < c.Start || start > latest ||
			f.retention > 0 && end < now.Add(-f.retention).UnixMilli() {
			continue
		}
		connections = append(connections, history.WiFiConnection{
			SSID:       ssid,
			PhoneStart: c.Start,
			Start:      start,
			End:        min(end, latest),
		})
	}
	if err := f.store.AddWiFiConnections(ctx, f.device, connections); err != nil {
		return 0, err
	}
	return after, nil
}

// receiveRoute stores the points of the route of a push, at their times on
// the hub's clock, as the minutes are moved (see fetcher.receive), and
// returns the largest ID among them, or 0 when it has none. A point from
// before the retention or the future is left out, but counts as had, so the
// phone deletes it, and so does one that makes no sense, such as one off the
// globe or vaguer than maxAccuracy. The caller holds pushing.
func (p *phone) receiveRoute(ctx context.Context, push Push, now time.Time) (int64, error) {
	f := p.minutes
	var after int64
	latest := now.Add(maxClockJitter).UnixMilli()
	points := make([]history.RoutePoint, 0, len(push.Route))
	for _, r := range push.Route {
		after = max(after, r.ID)
		at := r.Time + f.offset*1000
		if r.Time <= 0 || at > latest || f.retention > 0 && at < now.Add(-f.retention).UnixMilli() ||
			!(r.Lat >= -90 && r.Lat <= 90) || !(r.Lon >= -180 && r.Lon <= 180) ||
			!(r.Accuracy >= 0 && r.Accuracy <= maxAccuracy) {
			continue
		}
		points = append(points, history.RoutePoint{PhoneTime: r.Time, Time: at, Lat: r.Lat, Lon: r.Lon, Accuracy: r.Accuracy})
	}
	if err := f.store.AddRoutePoints(ctx, f.device, points); err != nil {
		return 0, err
	}
	return after, nil
}

// cut returns s cut to at most n bytes, at the start of a character.
func cut(s string, n int) string {
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n]
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
	now := time.Now()
	remote.phone.mu.Lock()
	remote.phone.releasedUntil = now.Add(ReleaseTime)
	remote.phone.regive = true
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

// takeRegive reports whether the phone's key may be given once more, seen at
// now: once while it may change its hub, never after.
func (p *phone) takeRegive(now time.Time) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.regive || !now.Before(p.releasedUntil) {
		return false
	}
	p.regive = false
	return true
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
