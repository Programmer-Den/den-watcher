package history

import (
	"context"
	"testing"
	"time"
)

func TestAppUsesAreSplitAtTheStepsAndTheRange(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	hour := time.Date(2026, 11, 2, 10, 0, 0, 0, time.UTC)
	ms := func(t time.Time) int64 { return t.UnixMilli() }
	uses := []AppUse{
		// From 9:50 to 10:20: 10 minutes before the range, 20 in its first hour.
		{App: "chat", Label: "Chat", PhoneStart: 1, Start: ms(hour.Add(-10 * time.Minute)), Millis: 30 * 60 * 1000},
		// From 10:50 to 11:10, over the edge of two hours.
		{App: "maps", Label: "Old name", PhoneStart: 2, Start: ms(hour.Add(50 * time.Minute)), Millis: 20 * 60 * 1000},
		{App: "maps", Label: "Maps", PhoneStart: 3, Start: ms(hour.Add(70 * time.Minute)), Millis: 60 * 1000},
		{PhoneStart: 4, Start: ms(hour.Add(5 * time.Minute))},
		{PhoneStart: 5, Start: ms(hour.Add(-5 * time.Minute))},
	}
	if err := store.AddAppUses(ctx, "pixel", uses); err != nil {
		t.Fatal(err)
	}
	// Sent again, as when the answer was lost.
	if err := store.AddAppUses(ctx, "pixel", uses); err != nil {
		t.Fatal(err)
	}
	usage, err := store.AppUses(ctx, "pixel", hour, hour.Add(2*time.Hour), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if usage.StepSeconds != 3600 || usage.Unlocks != 1 || usage.ScreenSeconds != (20+20+1)*60 {
		t.Errorf("step %d s, unlocks %d, screen time %v s; want 3600 s, 1 and 2460 s", usage.StepSeconds, usage.Unlocks, usage.ScreenSeconds)
	}
	want := []AppTime{
		{App: "maps", Label: "Maps", Seconds: 21 * 60, Opens: 2},
		{App: "chat", Label: "Chat", Seconds: 20 * 60, Opens: 0},
	}
	if len(usage.Apps) != 2 || usage.Apps[0] != want[0] || usage.Apps[1] != want[1] {
		t.Errorf("apps %+v, want %+v", usage.Apps, want)
	}
	steps := []AppUsageStep{
		{Time: hour.Unix(), ScreenSeconds: 30 * 60, Unlocks: 1},
		{Time: hour.Add(time.Hour).Unix(), ScreenSeconds: 11 * 60},
	}
	if len(usage.Steps) != 2 || usage.Steps[0] != steps[0] || usage.Steps[1] != steps[1] {
		t.Errorf("steps %+v, want %+v", usage.Steps, steps)
	}

	if err := store.DeleteDevice(ctx, "pixel"); err != nil {
		t.Fatal(err)
	}
	if usage, err := store.AppUses(ctx, "pixel", hour, hour.Add(2*time.Hour), time.Hour); err != nil || len(usage.Apps) != 0 || usage.Unlocks != 0 {
		t.Errorf("after DeleteDevice: %+v, %v; want nothing", usage, err)
	}
}

func TestOldAppUsesAreDeleted(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	now := time.Now()
	uses := []AppUse{
		{App: "chat", PhoneStart: 1, Start: now.Add(-48 * time.Hour).UnixMilli(), Millis: 1000},
		{App: "chat", PhoneStart: 2, Start: now.Add(-time.Hour).UnixMilli(), Millis: 1000},
	}
	if err := store.AddAppUses(ctx, "pixel", uses); err != nil {
		t.Fatal(err)
	}
	if _, err := store.DeleteBefore(ctx, now.Add(-24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	usage, err := store.AppUses(ctx, "pixel", now.Add(-72*time.Hour), now, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if len(usage.Apps) != 1 || usage.Apps[0].Opens != 1 {
		t.Errorf("apps %+v, want only the use from an hour ago", usage.Apps)
	}
}
