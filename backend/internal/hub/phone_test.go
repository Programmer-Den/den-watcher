package hub

import (
	"context"
	"encoding/hex"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// pushedMinutes returns the memory values the hub stored of device, by the
// hub's time of their minute.
func pushedMinutes(t *testing.T, store *history.Store, device string) map[int64]float64 {
	t.Helper()
	now := time.Now()
	series, err := store.Range(context.Background(), device, now.Add(-3*time.Hour), now.Add(time.Minute), time.Minute)
	if err != nil {
		t.Fatalf("Range() error = %v", err)
	}
	got := map[int64]float64{}
	for _, s := range series {
		if s.Metric != "memory" {
			continue
		}
		for _, point := range s.Points {
			got[point.Time] = point.Value
		}
	}
	return got
}

func memoryMinute(at time.Time, value float64) history.Minute {
	return history.Minute{Time: at.Unix(), Values: map[string]float64{"memory": value}}
}

func TestAPhoneIsAddedWithItsCodeAndKept(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)

	device, err := h.AddPhone(ctx, "Pixel 8", "7kqm-x2rp")
	if err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	if device.ID != "pixel-8" || device.Address != "" || !device.Phone {
		t.Errorf("AddPhone() = %+v, want pixel-8, a phone without an address", device)
	}
	// Phones have no address, which two of them do not share.
	if _, err := h.AddPhone(ctx, "Galaxy", "AAAA-BBBB"); err != nil {
		t.Fatalf("AddPhone(Galaxy) error = %v", err)
	}
	for name, test := range map[string]struct {
		name, code string
		problem    Problem
	}{
		"no code":         {"Tablet", "", ProblemPairingNeeded},
		"code taken":      {"Tablet", "7KQM X2RP", ProblemPairingTaken},
		"name taken":      {"pixel 8", "CCCC-DDDD", ProblemNameTaken},
		"code not a code": {"Tablet", "7KQM_X2RP", ProblemPairingWrong},
		"code too short":  {"Tablet", "A", ProblemPairingWrong},
		"code with O":     {"Tablet", "7KQM-X2RO", ProblemPairingWrong},
	} {
		if _, err := h.AddPhone(ctx, test.name, test.code); problemOf(err) != test.problem {
			t.Errorf("AddPhone() with %s error = %v, want problem %q", name, err, test.problem)
		}
	}
	if err := h.SetKind(ctx, "pixel-8", KindPC); problemOf(err) != ProblemKind {
		t.Errorf("SetKind(pixel-8) error = %v, want problem %q: a phone stays a phone", err, ProblemKind)
	}

	again := openTestHub(t, store, nil)
	remotes := again.Remotes()
	if got := ids(remotes); len(got) != 2 || !slices.Contains(got, "pixel-8") || !slices.Contains(got, "galaxy") {
		t.Fatalf("devices after a restart = %q, want both phones", got)
	}
	for _, remote := range remotes {
		if !remote.Phone || remote.Kind() != KindPhone || remote.Router() || remote.Pairing() != "" {
			t.Errorf("%s after a restart: phone %v, kind %q, router %v, pairing %q; want a phone, neither router nor waiting for its code",
				remote.ID, remote.Phone, remote.Kind(), remote.Router(), remote.Pairing())
		}
	}
	if _, err := again.Receive(ctx, "7KQMX2RP", Push{Now: time.Now().Unix()}); err != nil {
		t.Errorf("Receive() after a restart error = %v, want the phone known by its code", err)
	}
}

func TestAPhonesPushIsShownAndItsMinutesStored(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	remote := h.Remotes()[0]
	if _, err := remote.Agent.Collect(ctx); !errors.Is(err, ErrUnreachable) {
		t.Errorf("Collect() before the first push error = %v, want %v", err, ErrUnreachable)
	}

	if _, err := h.Receive(ctx, "AAAABBBB", Push{Now: time.Now().Unix()}); !errors.Is(err, ErrUnknownPhone) {
		t.Errorf("Receive() with a code no phone has error = %v, want %v", err, ErrUnknownPhone)
	}

	// The phone's clock is an hour behind the hub's; its minutes are moved
	// to the hub's time, as fetched ones are.
	now := time.Now()
	phoneNow := now.Add(-time.Hour)
	minute := phoneNow.Truncate(history.SampleInterval)
	usage := 3.5
	push := Push{
		Now:      phoneNow.Unix(),
		Snapshot: &metrics.Snapshot{CPU: metrics.CPU{UsagePercent: usage}},
		Minutes:  []history.Minute{memoryMinute(minute.Add(-2*time.Minute), 40), memoryMinute(minute.Add(-time.Minute), 41)},
	}
	answer, err := h.Receive(ctx, "7kqm-x2rp", push)
	if err != nil {
		t.Fatalf("Receive() error = %v", err)
	}
	if answer.After != minute.Add(-time.Minute).Unix() {
		t.Errorf("After = %d, want the phone's time of its newest minute %d", answer.After, minute.Add(-time.Minute).Unix())
	}
	hubMinute := now.Truncate(history.SampleInterval)
	want := map[int64]float64{hubMinute.Add(-2 * time.Minute).Unix(): 40, hubMinute.Add(-time.Minute).Unix(): 41}
	if got := pushedMinutes(t, store, "pixel"); len(got) != 2 || got[hubMinute.Add(-2*time.Minute).Unix()] != 40 || got[hubMinute.Add(-time.Minute).Unix()] != 41 {
		t.Errorf("stored minutes = %v, want %v", got, want)
	}
	snapshot, err := remote.Agent.Collect(ctx)
	if err != nil || snapshot.CPU.UsagePercent != usage {
		t.Errorf("Collect() = %+v, %v; want the pushed reading", snapshot.CPU, err)
	}

	// The same push again, as when the phone did not get the answer, stores
	// nothing twice, and a minute already there is not replaced.
	push.Snapshot = nil
	push.Minutes = append(push.Minutes[:1], memoryMinute(minute.Add(-time.Minute), 99))
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.After != minute.Add(-time.Minute).Unix() {
		t.Errorf("Receive() again = %+v, %v; want the same newest minute", answer, err)
	}
	if got := pushedMinutes(t, store, "pixel"); len(got) != 2 || got[hubMinute.Add(-time.Minute).Unix()] != 41 {
		t.Errorf("stored minutes after the same push = %v, want them as before", got)
	}
}

func TestAPushWithTooManyMinutesIsRefused(t *testing.T) {
	ctx := context.Background()
	h := openTestHub(t, openTestStore(t), nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	minutes := make([]history.Minute, MinutesPerAnswer+1)
	if _, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: time.Now().Unix(), Minutes: minutes}); !errors.Is(err, ErrPushTooLarge) {
		t.Errorf("Receive() with %d minutes error = %v, want %v", len(minutes), err, ErrPushTooLarge)
	}
}

func TestThePhonesScansCountAtTheirOwnTime(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	// The phone's clock is an hour behind; it kept a scan from three hours
	// ago, while it was away, one from now and one from before the
	// retention, sent out of order.
	now := time.Now()
	phoneNow := now.Add(-time.Hour)
	ap := metrics.NearbyAccessPoint{ID: "0000000000aa", Box: "0000000000bb", SSID: "Office", SignalPercent: 60}
	push := Push{Now: phoneNow.Unix(), WiFi: []PhoneScan{
		{Time: phoneNow.Unix(), AccessPoints: []metrics.NearbyAccessPoint{ap}},
		{Time: phoneNow.Add(-3 * time.Hour).Unix(), AccessPoints: []metrics.NearbyAccessPoint{ap, {ID: "bad"}}},
		{Time: phoneNow.Add(-60 * 24 * time.Hour).Unix(), AccessPoints: []metrics.NearbyAccessPoint{ap}},
	}}
	answer, err := h.Receive(ctx, "7KQM-X2RP", push)
	if err != nil {
		t.Fatal(err)
	}
	if answer.WiFiAfter != phoneNow.Unix() {
		t.Errorf("WiFiAfter = %d, want the phone's time of its newest scan %d", answer.WiFiAfter, phoneNow.Unix())
	}
	// The same push again counts nothing twice.
	if _, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil {
		t.Fatal(err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	seen, err := store.WiFi(ctx, now.Add(-5*time.Hour), now.Add(time.Minute), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if len(seen.AccessPoints) != 1 || len(seen.AccessPoints[0].SeenBy) != 1 || seen.AccessPoints[0].SeenBy[0].Device != "pixel" {
		t.Fatalf("access points %+v, want the one the phone saw", seen.AccessPoints)
	}
	hours := map[int64]int64{}
	for _, point := range seen.AccessPoints[0].SeenBy[0].Points {
		hours[point.Time] += point.Seen
	}
	want := map[int64]int64{now.Add(-3 * time.Hour).Truncate(time.Hour).Unix(): 1, now.Truncate(time.Hour).Unix(): 1}
	if len(hours) != 2 || hours[now.Add(-3*time.Hour).Truncate(time.Hour).Unix()] != 1 || hours[now.Truncate(time.Hour).Unix()] != 1 {
		t.Errorf("seen by hour %v, want %v: each scan once, at the hub's time", hours, want)
	}

	if _, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: phoneNow.Unix(), WiFi: make([]PhoneScan, ScansPerPush+1)}); !errors.Is(err, ErrPushTooLarge) {
		t.Errorf("Receive() with %d scans error = %v, want %v", ScansPerPush+1, err, ErrPushTooLarge)
	}
}

func TestAReleasedPhoneIsToldItMayChangeItsHub(t *testing.T) {
	ctx := context.Background()
	h := openTestHub(t, openTestStore(t), []Device{{ID: "nas", Name: "NAS", Address: "192.0.2.7:9393"}})
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	var remote *Remote
	for _, r := range h.Remotes() {
		if r.ID == "pixel" {
			remote = r
		}
	}
	push := Push{Now: time.Now().Unix()}
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Release {
		t.Errorf("Receive() before the release = %+v, %v; want no release", answer, err)
	}
	if until := remote.ReleasedUntil(); !until.IsZero() {
		t.Errorf("ReleasedUntil() before the release = %v, want zero", until)
	}

	before := time.Now()
	until, err := h.ReleasePhone("pixel")
	if err != nil {
		t.Fatalf("ReleasePhone() error = %v", err)
	}
	if until.Before(before.Add(ReleaseTime)) || until.After(time.Now().Add(ReleaseTime)) {
		t.Errorf("ReleasePhone() = %v, want %v from now", until, ReleaseTime)
	}
	if got := remote.ReleasedUntil(); !got.Equal(until) {
		t.Errorf("ReleasedUntil() = %v, want %v", got, until)
	}
	// Every push in the time is told, as the phone may miss an answer.
	for range 2 {
		if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || !answer.Release {
			t.Errorf("Receive() after the release = %+v, %v; want the release", answer, err)
		}
	}
	// Once the time is over, the phone is told no more.
	if answer, err := remote.phone.receive(ctx, push, until, nil); err != nil || answer.Release {
		t.Errorf("receive() at the end of the release = %+v, %v; want none", answer, err)
	}

	// The release comes with the seconds left and a proof of the phone's
	// key for this push.
	answer, err := h.Receive(ctx, "7KQM-X2RP", push)
	key := phoneKey(h.phoneSecret, "7KQMX2RP")
	if err != nil || answer.ReleaseSeconds <= 0 || answer.ReleaseSeconds > int64(ReleaseTime/time.Second) ||
		answer.ReleaseProof != releaseProof(key, push.Now, answer.ReleaseSeconds) {
		t.Errorf("Receive() after the release = %+v, %v; want the seconds left and their proof", answer, err)
	}
	if answer.ReleaseProof == releaseProof(key, push.Now+1, answer.ReleaseSeconds) {
		t.Error("the proof is the same for another push")
	}

	if _, err := h.ReleasePhone("nas"); problemOf(err) != ProblemKind {
		t.Errorf("ReleasePhone(nas) error = %v, want problem %q: only a phone keeps its hub locked", err, ProblemKind)
	}
	if _, err := h.ReleasePhone("tablet"); problemOf(err) != ProblemNotFound {
		t.Errorf("ReleasePhone(tablet) error = %v, want problem %q", err, ProblemNotFound)
	}
}

func TestAPhonesCodeCanBeChanged(t *testing.T) {
	ctx := context.Background()
	h := openTestHub(t, openTestStore(t), nil)
	for name, code := range map[string]string{"Pixel": "7KQM-X2RP", "Galaxy": "AAAA-BBBB"} {
		if _, err := h.AddPhone(ctx, name, code); err != nil {
			t.Fatalf("AddPhone(%s) error = %v", name, err)
		}
	}
	if err := h.SetCode(ctx, "pixel", "AAAA-BBBB"); problemOf(err) != ProblemPairingTaken {
		t.Errorf("SetCode() with the other phone's code error = %v, want problem %q", err, ProblemPairingTaken)
	}
	if err := h.SetCode(ctx, "pixel", "AB"); problemOf(err) != ProblemPairingWrong {
		t.Errorf("SetCode() with a code of 2 characters error = %v, want problem %q", err, ProblemPairingWrong)
	}
	if err := h.SetCode(ctx, "pixel", "CCCC-DDDD"); err != nil {
		t.Fatalf("SetCode() error = %v", err)
	}
	if _, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: time.Now().Unix()}); !errors.Is(err, ErrUnknownPhone) {
		t.Errorf("Receive() with the old code error = %v, want %v", err, ErrUnknownPhone)
	}
	if _, err := h.Receive(ctx, "CCCCDDDD", Push{Now: time.Now().Unix()}); err != nil {
		t.Errorf("Receive() with the new code error = %v", err)
	}
}

func TestNoPushIsTakenWithoutACodeOrAfterTheRemoval(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	device, err := h.AddPhone(ctx, "  Pixel  ", "7KQM-X2RP")
	if err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	if device.Name != "Pixel" {
		t.Errorf("name = %q, want it without the spaces around it", device.Name)
	}
	remote := h.Remotes()[0]

	// As for a phone whose code could not be read at the start.
	remote.Agent.setPairingCode("")
	if _, err := h.Receive(ctx, "", Push{Now: time.Now().Unix()}); !errors.Is(err, ErrUnknownPhone) {
		t.Errorf("Receive() without a code error = %v, want %v", err, ErrUnknownPhone)
	}
	remote.Agent.setPairingCode("7KQMX2RP")

	// A push that found the phone before it was removed stores nothing once
	// its data is deleted.
	remote.phone.pushing.Lock()
	if err := h.Remove(ctx, "pixel", false); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	remote.phone.pushing.Unlock()
	if err := h.waitRemoved(ctx, "pixel", time.Minute); err != nil {
		t.Fatalf("waitRemoved() error = %v", err)
	}
	push := Push{Now: time.Now().Unix(), Minutes: []history.Minute{memoryMinute(time.Now().Add(-time.Minute), 40)}}
	if _, err := remote.phone.receive(ctx, push, time.Now(), nil); !errors.Is(err, ErrUnknownPhone) {
		t.Errorf("receive() after the removal error = %v, want %v", err, ErrUnknownPhone)
	}
	if got := pushedMinutes(t, store, "pixel"); len(got) != 0 {
		t.Errorf("minutes of the removed phone = %v, want none", got)
	}
}

func TestAPhoneIsGivenItsKeyOnce(t *testing.T) {
	ctx := context.Background()
	h := openTestHub(t, openTestStore(t), nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	want := hex.EncodeToString(phoneKey(h.phoneSecret, "7KQMX2RP"))
	push := Push{Now: time.Now().Unix(), NeedKey: true}
	if answer, err := h.Receive(ctx, "7kqm x2rp", push); err != nil || answer.Key != want {
		t.Fatalf("the first push asking for the key = %+v, %v; want the key", answer, err)
	}
	// Whoever has the phone sees its code, and could ask with it.
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Key != "" {
		t.Errorf("a second push asking for the key = %+v, %v; want none", answer, err)
	}
	if answer, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: time.Now().Unix()}); err != nil || answer.Key != "" {
		t.Errorf("a push not asking for the key = %+v, %v; want none", answer, err)
	}
	// Once its owner allows a change, the phone may get it again, as when the
	// answer that gave it was lost.
	if _, err := h.ReleasePhone("pixel"); err != nil {
		t.Fatalf("ReleasePhone() error = %v", err)
	}
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Key != want {
		t.Errorf("a push asking for the key after the release = %+v, %v; want the key", answer, err)
	}
	if other := phoneKey(h.phoneSecret, "AAAABBBB"); hex.EncodeToString(other) == want {
		t.Error("two phones have the same key")
	}
}

func TestReleaseProofMatchesTheApp(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	// The same as in the app's ReleaseTest.
	if got, want := releaseProof(key, 1_700_000_000, 600), "8631e5128a994884b4c4b87819685519a205cbe96828ac878a5662eb799b1660"; got != want {
		t.Errorf("releaseProof() = %s, want %s", got, want)
	}
}
