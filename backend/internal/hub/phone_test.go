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
	// retention of the minutes, sent out of order.
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
	// Each scan is kept on its own too, at the hub's time, with only the valid networks.
	scan, err := store.PhoneScanNear(ctx, "pixel", now.Add(-3*time.Hour), time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if scan == nil || len(scan.Networks) != 1 || scan.Networks[0].SSID != "Office" {
		t.Errorf("scan from three hours ago = %+v, want the one with Office", scan)
	}
	// The one from before the retention of the minutes too, as the phones'
	// scans are kept for good by default, but it is not in the hourly sums.
	if scan, err := store.PhoneScanNear(ctx, "pixel", now.Add(-60*24*time.Hour), time.Minute); err != nil || scan == nil {
		t.Errorf("scan from 60 days ago = %+v, %v; want it kept", scan, err)
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
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Key != "" {
		t.Errorf("a second push asking for the key in the release = %+v, %v; want none", answer, err)
	}
	// A release the phone never asked for the key in gives it only while it lasts.
	if _, err := h.ReleasePhone("pixel"); err != nil {
		t.Fatalf("ReleasePhone() error = %v", err)
	}
	h.mu.Lock()
	phone := h.find("pixel").phone
	h.mu.Unlock()
	phone.mu.Lock()
	phone.releasedUntil = time.Now().Add(-time.Second)
	phone.mu.Unlock()
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Key != "" {
		t.Errorf("a push asking for the key after the release ended = %+v, %v; want none", answer, err)
	}
	if other := phoneKey(h.phoneSecret, "AAAABBBB"); hex.EncodeToString(other) == want {
		t.Error("two phones have the same key")
	}
}

func TestAPhoneAddedAgainIsGivenItsKey(t *testing.T) {
	ctx := context.Background()
	h := openTestHub(t, openTestStore(t), nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	want := hex.EncodeToString(phoneKey(h.phoneSecret, "7KQMX2RP"))
	push := Push{Now: time.Now().Unix(), NeedKey: true}
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Key != want {
		t.Fatalf("the first push asking for the key = %+v, %v; want the key", answer, err)
	}
	if err := h.Remove(ctx, "pixel", false); err != nil {
		t.Fatalf("Remove() error = %v", err)
	}
	if err := h.waitRemoved(ctx, "pixel", time.Minute); err != nil {
		t.Fatalf("waitRemoved() error = %v", err)
	}
	// The app dropped its key meanwhile, as on another hub, and keeps its code.
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() again error = %v", err)
	}
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Key != want {
		t.Errorf("the first push after it was added again = %+v, %v; want the key", answer, err)
	}
	if answer, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil || answer.Key != "" {
		t.Errorf("a second push after it was added again = %+v, %v; want none", answer, err)
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

func TestThePhonesAppUsesAreStoredOnceAtTheHubsTime(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	// The phone's clock is an hour behind. It kept an unlock and two uses of
	// a browser, one of them from while it was away, one use from before the
	// retention and one that makes no sense, sent out of order.
	now := time.Now()
	phoneNow := now.Add(-time.Hour)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	push := Push{Now: phoneNow.Unix(), Uses: []PhoneUse{
		{ID: 7, App: "org.mozilla.firefox", Label: "Firefox", Start: ms(phoneNow.Add(-10 * time.Minute)), Millis: 5 * 60 * 1000},
		{ID: 5, Start: ms(phoneNow.Add(-11 * time.Minute))},
		{ID: 6, App: "org.mozilla.firefox", Label: "Firefox", Start: ms(phoneNow.Add(-3 * time.Hour)), Millis: 60 * 1000},
		{ID: 9, App: "old.app", Start: ms(phoneNow.Add(-60 * 24 * time.Hour)), Millis: 1000},
		{ID: 8, App: "odd.app", Start: ms(phoneNow.Add(-time.Minute)), Millis: -1},
	}}
	answer, err := h.Receive(ctx, "7KQM-X2RP", push)
	if err != nil {
		t.Fatal(err)
	}
	if answer.UsesAfter != 9 {
		t.Errorf("UsesAfter = %d, want the largest ID of the push, 9", answer.UsesAfter)
	}
	// The same push again counts nothing twice.
	if _, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil {
		t.Fatal(err)
	}
	usage, err := store.AppUses(ctx, "pixel", now.Add(-5*time.Hour), now.Add(time.Minute), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if usage.Unlocks != 1 || usage.ScreenSeconds != 6*60 {
		t.Errorf("unlocks %d and screen time %v s, want 1 and 360 s", usage.Unlocks, usage.ScreenSeconds)
	}
	if len(usage.Apps) != 1 || usage.Apps[0] != (history.AppTime{App: "org.mozilla.firefox", Label: "Firefox", Seconds: 6 * 60, Opens: 2}) {
		t.Errorf("apps %+v, want Firefox with 6 minutes and 2 opens", usage.Apps)
	}
	// At the hub's time: the newest use in the hour of now, not an hour before.
	recent := now.Add(-10 * time.Minute).Truncate(time.Hour).Unix()
	found := false
	for _, step := range usage.Steps {
		if step.Time == recent && step.ScreenSeconds > 0 {
			found = true
		}
	}
	if !found {
		t.Errorf("steps %+v, want screen time in the hour starting at %d", usage.Steps, recent)
	}

	if _, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: phoneNow.Unix(), Uses: make([]PhoneUse, UsesPerPush+1)}); !errors.Is(err, ErrPushTooLarge) {
		t.Errorf("Receive() with %d uses error = %v, want %v", UsesPerPush+1, err, ErrPushTooLarge)
	}
}

func TestThePhonesWiFiConnectionsAreStoredAtTheHubsTime(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	// The phone's clock is an hour behind. It was at home in the morning
	// and is at work now, kept one from before the retention and one
	// without a name, sent out of order.
	now := time.Now()
	phoneNow := now.Add(-time.Hour)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	work := PhoneConnection{ID: 4, SSID: "Work", Start: ms(phoneNow.Add(-30 * time.Minute)), End: ms(phoneNow.Add(-5 * time.Minute)), Open: true}
	push := Push{Now: phoneNow.Unix(), Connections: []PhoneConnection{
		work,
		{ID: 3, SSID: " Home ", Start: ms(phoneNow.Add(-3 * time.Hour)), End: ms(phoneNow.Add(-time.Hour))},
		{ID: 1, SSID: "Old", Start: ms(phoneNow.Add(-61 * 24 * time.Hour)), End: ms(phoneNow.Add(-60 * 24 * time.Hour))},
		{ID: 2, SSID: "", Start: ms(phoneNow.Add(-2 * time.Hour)), End: ms(phoneNow.Add(-2 * time.Hour))},
	}}
	answer, err := h.Receive(ctx, "7KQM-X2RP", push)
	if err != nil {
		t.Fatal(err)
	}
	if answer.ConnectionsAfter != 4 {
		t.Errorf("ConnectionsAfter = %d, want the largest ID of the push, 4", answer.ConnectionsAfter)
	}
	// The open one again, as it went on.
	work.End = ms(phoneNow)
	if _, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: phoneNow.Unix(), Connections: []PhoneConnection{work}}); err != nil {
		t.Fatal(err)
	}
	got, err := store.WiFiConnections(ctx, "pixel", now.Add(-5*time.Hour), now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	want := []history.PhoneConnection{
		{SSID: "Home", Start: now.Add(-3 * time.Hour).Unix(), End: now.Add(-time.Hour).Unix()},
		{SSID: "Work", Start: now.Add(-30 * time.Minute).Unix(), End: now.Unix()},
	}
	if len(got) != len(want) {
		t.Fatalf("connections = %+v, want %+v", got, want)
	}
	for i := range want {
		// Moved by the clock offset, which is measured to the second.
		if got[i].SSID != want[i].SSID || abs(got[i].Start-want[i].Start) > 2 || abs(got[i].End-want[i].End) > 2 {
			t.Errorf("connection %d = %+v, want %+v", i, got[i], want[i])
		}
	}

	if _, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: phoneNow.Unix(), Connections: make([]PhoneConnection, ConnectionsPerPush+1)}); !errors.Is(err, ErrPushTooLarge) {
		t.Errorf("Receive() with %d connections error = %v, want %v", ConnectionsPerPush+1, err, ErrPushTooLarge)
	}
}

func TestThePhonesRouteIsStoredAtTheHubsTime(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	h.phoneRetention = 60 * 24 * time.Hour
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	// The phone's clock is an hour behind. It kept two points of its way,
	// one from before the retention, one off the globe and one too vague.
	now := time.Now()
	phoneNow := now.Add(-time.Hour)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	push := Push{Now: phoneNow.Unix(), Route: []PhonePoint{
		{ID: 5, Time: ms(phoneNow.Add(-10 * time.Minute)), Lat: 53.56, Lon: 10.01, Accuracy: 25},
		{ID: 4, Time: ms(phoneNow.Add(-40 * time.Minute)), Lat: 53.55, Lon: 9.99, Accuracy: 12},
		{ID: 1, Time: ms(phoneNow.Add(-61 * 24 * time.Hour)), Lat: 53.5, Lon: 9.9, Accuracy: 10},
		{ID: 2, Time: ms(phoneNow.Add(-30 * time.Minute)), Lat: 91, Lon: 9.9, Accuracy: 10},
		{ID: 3, Time: ms(phoneNow.Add(-20 * time.Minute)), Lat: 53.5, Lon: 9.9, Accuracy: 5000},
	}}
	answer, err := h.Receive(ctx, "7KQM-X2RP", push)
	if err != nil {
		t.Fatal(err)
	}
	if answer.RouteAfter != 5 {
		t.Errorf("RouteAfter = %d, want the largest ID of the push, 5", answer.RouteAfter)
	}
	got, _, err := store.RoutePoints(ctx, "pixel", now.Add(-90*24*time.Hour), now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	want := []history.PhonePoint{
		{Time: now.Add(-40 * time.Minute).Unix(), Lat: 53.55, Lon: 9.99, Accuracy: 12},
		{Time: now.Add(-10 * time.Minute).Unix(), Lat: 53.56, Lon: 10.01, Accuracy: 25},
	}
	if len(got) != len(want) {
		t.Fatalf("points = %+v, want %+v", got, want)
	}
	for i := range want {
		// Moved by the clock offset, which is measured to the second.
		if got[i].Lat != want[i].Lat || got[i].Lon != want[i].Lon || abs(got[i].Time-want[i].Time) > 2 {
			t.Errorf("point %d = %+v, want %+v", i, got[i], want[i])
		}
	}

	if _, err := h.Receive(ctx, "7KQM-X2RP", Push{Now: phoneNow.Unix(), Route: make([]PhonePoint, RoutePerPush+1)}); !errors.Is(err, ErrPushTooLarge) {
		t.Errorf("Receive() with %d points error = %v, want %v", RoutePerPush+1, err, ErrPushTooLarge)
	}
}

func TestThePhonesRouteHasNoRetentionByDefault(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	// Kept on the phone for longer than the history's 30 days, as while it
	// was away.
	now := time.Now()
	old := now.Add(-61 * 24 * time.Hour)
	push := Push{
		Now:         now.Unix(),
		Route:       []PhonePoint{{ID: 1, Time: old.UnixMilli(), Lat: 53.5, Lon: 9.9, Accuracy: 10}},
		Connections: []PhoneConnection{{ID: 1, SSID: "Home", Start: old.UnixMilli(), End: old.Add(time.Hour).UnixMilli()}},
	}
	if _, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil {
		t.Fatal(err)
	}
	points, _, err := store.RoutePoints(ctx, "pixel", now.Add(-90*24*time.Hour), now)
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 1 {
		t.Errorf("points = %+v, want the one from 61 days ago", points)
	}
	connections, err := store.WiFiConnections(ctx, "pixel", now.Add(-90*24*time.Hour), now)
	if err != nil {
		t.Fatal(err)
	}
	if len(connections) != 1 {
		t.Errorf("connections = %+v, want the one from 61 days ago", connections)
	}
}

func abs(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

func TestAScanThatWasNotStoredComesAgain(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	now := time.Now()
	ap := metrics.NearbyAccessPoint{ID: "0000000000aa", Box: "0000000000bb", SSID: "Office", SignalPercent: 60}
	push := Push{Now: now.Unix(), WiFi: []PhoneScan{{Time: now.Unix(), AccessPoints: []metrics.NearbyAccessPoint{ap}}}}
	// The scans cannot be stored, as when the database is busy.
	if _, err := store.DB().ExecContext(ctx, `ALTER TABLE phone_scans RENAME TO phone_scans_away`); err != nil {
		t.Fatal(err)
	}
	if _, err := h.Receive(ctx, "7KQM-X2RP", push); err == nil {
		t.Fatal("Receive() error = nil, want the failed insert")
	}
	if _, err := store.DB().ExecContext(ctx, `ALTER TABLE phone_scans_away RENAME TO phone_scans`); err != nil {
		t.Fatal(err)
	}
	answer, err := h.Receive(ctx, "7KQM-X2RP", push)
	if err != nil {
		t.Fatal(err)
	}
	if answer.WiFiAfter != now.Unix() {
		t.Errorf("WiFiAfter = %d, want %d", answer.WiFiAfter, now.Unix())
	}
	if scan, err := store.PhoneScanNear(ctx, "pixel", now, time.Minute); err != nil || scan == nil {
		t.Errorf("PhoneScanNear() = %+v, %v; want the scan sent again", scan, err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	seen, err := store.WiFi(ctx, now.Add(-time.Hour), now.Add(time.Minute), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if len(seen.AccessPoints) != 1 || seen.AccessPoints[0].SeenBy[0].Points[0].Seen != 1 {
		t.Errorf("access points %+v, want the scan counted once", seen.AccessPoints)
	}
}

func TestThePhonesScansAreKeptAndCountedEachByItsOwnRetention(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	h.phoneRetention = 24 * time.Hour
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	now := time.Now()
	// The user deleted the route of a stretch two hours ago.
	if _, err := h.DeleteRoute(ctx, "pixel", now.Add(-130*time.Minute), now.Add(-110*time.Minute)); err != nil {
		t.Fatal(err)
	}
	ap := metrics.NearbyAccessPoint{ID: "0000000000aa", Box: "0000000000bb", SSID: "Office", SignalPercent: 60}
	old, deleted := now.Add(-3*24*time.Hour), now.Add(-2*time.Hour)
	push := Push{Now: now.Unix(), WiFi: []PhoneScan{
		{Time: old.Unix(), AccessPoints: []metrics.NearbyAccessPoint{ap}},
		{Time: deleted.Unix(), AccessPoints: []metrics.NearbyAccessPoint{ap}},
	}}
	if _, err := h.Receive(ctx, "7KQM-X2RP", push); err != nil {
		t.Fatal(err)
	}
	if err := store.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	// Older than the phone's retention: not kept on its own, but in the sums.
	if scan, err := store.PhoneScanNear(ctx, "pixel", old, time.Minute); err != nil || scan != nil {
		t.Errorf("scan from 3 days ago = %+v, %v; want none kept", scan, err)
	}
	// Of the deleted stretch: in neither.
	if scan, err := store.PhoneScanNear(ctx, "pixel", deleted, time.Minute); err != nil || scan != nil {
		t.Errorf("scan of the deleted stretch = %+v, %v; want none kept", scan, err)
	}
	seen, err := store.WiFi(ctx, now.Add(-4*24*time.Hour), now.Add(time.Minute), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if len(seen.AccessPoints) != 1 {
		t.Fatalf("access points %+v, want the one the phone saw", seen.AccessPoints)
	}
	var hours []int64
	for _, point := range seen.AccessPoints[0].SeenBy[0].Points {
		if point.Seen > 0 {
			hours = append(hours, point.Time)
		}
	}
	if len(hours) != 1 || hours[0] != old.Truncate(time.Hour).Unix() {
		t.Errorf("hours seen %v, want only the one of 3 days ago, %d", hours, old.Truncate(time.Hour).Unix())
	}
}

func TestTheRouteOfARemovedPhoneIsNotDeleted(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	h := openTestHub(t, store, nil)
	if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
		t.Fatalf("AddPhone() error = %v", err)
	}
	now := time.Now()
	if _, err := h.DeleteRoute(ctx, "pixel", now.Add(-time.Hour), now); err != nil {
		t.Fatalf("DeleteRoute() of a kept phone error = %v", err)
	}
	if err := h.Remove(ctx, "pixel", true); err != nil {
		t.Fatal(err)
	}
	if _, err := h.DeleteRoute(ctx, "pixel", now.Add(-time.Hour), now); !errors.Is(err, history.ErrDeviceGone) {
		t.Errorf("DeleteRoute() of a removed phone error = %v, want history.ErrDeviceGone", err)
	}
}

func TestARemovedPhonesRouteAndWiFiAreKeptButNoLongerItsOwn(t *testing.T) {
	ctx := context.Background()
	for _, keepHistory := range []bool{false, true} {
		store := openTestStore(t)
		h := openTestHub(t, store, nil)
		if _, err := h.AddPhone(ctx, "Pixel", "7KQM-X2RP"); err != nil {
			t.Fatalf("AddPhone() error = %v", err)
		}
		now := time.Now()
		if err := store.AddRoutePoints(ctx, "pixel", []history.RoutePoint{{PhoneTime: 1, Time: now.Add(-2 * time.Hour).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
			t.Fatal(err)
		}
		if _, err := h.DeleteRoute(ctx, "pixel", now.Add(-time.Hour), now); err != nil {
			t.Fatal(err)
		}
		if err := h.Remove(ctx, "pixel", keepHistory); err != nil {
			t.Fatal(err)
		}
		if err := h.waitRemoved(ctx, "pixel", time.Minute); err != nil {
			t.Fatal(err)
		}
		count := func(where string) int {
			var n int
			if err := store.DB().QueryRow(`SELECT (SELECT COUNT(*) FROM route_points WHERE ` + where + `) + (SELECT COUNT(*) FROM route_deleted WHERE ` + where + `)`).Scan(&n); err != nil {
				t.Fatal(err)
			}
			return n
		}
		if keepHistory {
			// Kept as the phone's while its history is kept.
			if got := count(`device = 'pixel'`); got != 2 {
				t.Fatalf("kept with the history: %d rows of the phone, want its point and stretch", got)
			}
			if _, err := store.DB().Exec(`UPDATE hub_kept SET removed = removed - 31*86400 WHERE device = 'pixel'`); err != nil {
				t.Fatal(err)
			}
			if err := h.forgetExpired(ctx, time.Now()); err != nil {
				t.Fatal(err)
			}
		}
		if got := count(`device = 'pixel'`); got != 0 {
			t.Errorf("keepHistory %t: %d rows left under the phone's id, want none", keepHistory, got)
		}
		if got := count(`device LIKE 'removed:%'`); got != 1 {
			t.Errorf("keepHistory %t: %d rows kept unlinked, want the point", keepHistory, got)
		}
	}
}

func TestAPhoneWhoseDataIsUnlinkedAtTheStartWaitsToBeAddedAgain(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	now := time.Now()
	// A hub that stopped while it moved a removed phone's route.
	if err := store.AddRoutePoints(ctx, "pixel", []history.RoutePoint{{PhoneTime: 1, Time: now.Add(-time.Hour).UnixMilli(), Lat: 1, Lon: 1, Accuracy: 5}}); err != nil {
		t.Fatal(err)
	}
	if err := store.NoteUnlink(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	h := openTestHub(t, store, nil)
	// Finished in the background.
	deadline := time.Now().Add(10 * time.Second)
	for {
		unlinking, err := store.Unlinking(ctx, "pixel")
		if err != nil {
			t.Fatal(err)
		}
		if !unlinking {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the unlink noted before the start was not finished")
		}
		time.Sleep(10 * time.Millisecond)
	}
	var left int
	if err := store.DB().QueryRow(`SELECT COUNT(*) FROM route_points WHERE device = 'pixel'`).Scan(&left); err != nil {
		t.Fatal(err)
	}
	if left != 0 {
		t.Errorf("%d points left under the phone's id, want none", left)
	}

	// While one is still noted, a phone is not added under its id.
	if err := store.NoteUnlink(ctx, "galaxy"); err != nil {
		t.Fatal(err)
	}
	if _, err := h.AddPhone(ctx, "Galaxy", "7KQM-X2RP"); !errors.Is(err, errRemoving) {
		t.Errorf("AddPhone() while its id is unlinked error = %v, want errRemoving", err)
	}
}
