package hub

import (
	"context"
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
	if _, err := remote.phone.receive(ctx, push, time.Now()); !errors.Is(err, ErrUnknownPhone) {
		t.Errorf("receive() after the removal error = %v, want %v", err, ErrUnknownPhone)
	}
	if got := pushedMinutes(t, store, "pixel"); len(got) != 0 {
		t.Errorf("minutes of the removed phone = %v, want none", got)
	}
}
