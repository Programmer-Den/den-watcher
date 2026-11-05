package history

import (
	"cmp"
	"context"
	"slices"
	"time"
)

// appUseSchema keeps when each app was in use on a phone, and when the phone
// was unlocked, one row each: the phone sends each use once it is over. The
// phone's own start of it is in the key, so a use sent again, as when the
// answer to a push was lost, is kept once.
const appUseSchema = `
CREATE TABLE IF NOT EXISTS app_uses (
	device TEXT    NOT NULL,
	app    TEXT    NOT NULL, -- the app's package name; empty for an unlock
	start  INTEGER NOT NULL, -- Unix milliseconds on the phone's clock
	time   INTEGER NOT NULL, -- the start in Unix milliseconds on the hub's clock
	millis INTEGER NOT NULL, -- how long it was in use; 0 for an unlock
	label  TEXT    NOT NULL, -- the app's name as the phone shows it
	PRIMARY KEY (device, app, start)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS app_uses_by_time ON app_uses (time);
`

// AppUse is one time an app was in use on a phone, or the phone was
// unlocked. Times are Unix milliseconds.
type AppUse struct {
	// App is the app's package name, such as org.mozilla.firefox; empty for
	// an unlock.
	App string
	// Label is the app's name as the phone shows it.
	Label string
	// PhoneStart is when it started on the phone's clock, which tells the
	// same use sent again.
	PhoneStart int64
	// Start is when it started on the hub's clock.
	Start int64
	// Millis is how long it was in use.
	Millis int64
}

// AddAppUses stores what a phone's apps were used for, leaving out the uses
// stored already.
func (s *Store) AddAppUses(ctx context.Context, device string, uses []AppUse) error {
	if len(uses) == 0 {
		return nil
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	insert, err := tx.PrepareContext(ctx, `
		INSERT INTO app_uses (device, app, start, time, millis, label) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (device, app, start) DO NOTHING`)
	if err != nil {
		return err
	}
	defer func() { _ = insert.Close() }()
	for _, u := range uses {
		if _, err := insert.ExecContext(ctx, device, u.App, u.PhoneStart, u.Start, u.Millis, u.Label); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// AppUsage is how a phone was used over a range: how long its apps were in
// use and how often it was unlocked, in all, per step and per app.
type AppUsage struct {
	StepSeconds int64 `json:"stepSeconds"`
	// ScreenSeconds is how long apps were in use in the range in all, its
	// screen time.
	ScreenSeconds float64 `json:"screenSeconds"`
	// Unlocks is how often the phone was unlocked in the range.
	Unlocks int64 `json:"unlocks"`
	// Steps are the steps anything happened in, by time.
	Steps []AppUsageStep `json:"steps"`
	// Apps are the apps used in the range, the longest used first.
	Apps []AppTime `json:"apps"`
}

// AppUsageStep is the screen time and the unlocks in the step that starts at
// Time, in Unix seconds.
type AppUsageStep struct {
	Time          int64   `json:"time"`
	ScreenSeconds float64 `json:"screenSeconds"`
	Unlocks       int64   `json:"unlocks,omitempty"`
}

// AppTime is how long one app was in use in a range and how often it was
// opened, which counts the uses that started in the range.
type AppTime struct {
	App     string  `json:"app"`
	Label   string  `json:"label,omitempty"`
	Seconds float64 `json:"seconds"`
	Opens   int64   `json:"opens"`
}

// maxAppUseMillis is the longest one use of an app is kept as: a day. It
// bounds how far before a range a use that reaches into it is looked for.
const maxAppUseMillis = 24 * 60 * 60 * 1000

// AppUses returns how the phone stored as device was used from from up to
// (not including) to, in steps of step rounded up to whole hours, starting
// at the hour from falls in. Only the time from from on counts, so the first
// step holds just its part in the range. A use that reaches over the edge of
// a step or the range counts in each with the part in it.
func (s *Store) AppUses(ctx context.Context, device string, from, to time.Time, step time.Duration) (AppUsage, error) {
	stepSeconds := max(1, int64((step+time.Hour-1)/time.Hour)) * int64(time.Hour/time.Second)
	first, last := from.UnixMilli(), to.UnixMilli()
	result := AppUsage{StepSeconds: stepSeconds, Steps: []AppUsageStep{}, Apps: []AppTime{}}
	rows, err := s.db.QueryContext(ctx, `
		SELECT app, label, time, millis FROM app_uses
		WHERE device = ? AND time >= ? AND time < ? ORDER BY time`, device, first-maxAppUseMillis, last)
	if err != nil {
		return AppUsage{}, err
	}
	steps := map[int64]*AppUsageStep{}
	stepAt := func(ms int64) *AppUsageStep {
		t := ms / 1000 / stepSeconds * stepSeconds
		if steps[t] == nil {
			steps[t] = &AppUsageStep{Time: t}
		}
		return steps[t]
	}
	apps := map[string]*AppTime{}
	err = scanRows(rows, func() error {
		var app, label string
		var start, millis int64
		if err := rows.Scan(&app, &label, &start, &millis); err != nil {
			return err
		}
		if app == "" {
			if start >= first {
				result.Unlocks++
				stepAt(start).Unlocks++
			}
			return nil
		}
		begin, end := max(start, first), min(start+millis, last)
		if end <= begin && start < first {
			return nil
		}
		a := apps[app]
		if a == nil {
			a = &AppTime{App: app}
			apps[app] = a
		}
		// The newest name, as the uses come by time.
		if label != "" {
			a.Label = label
		}
		if start >= first {
			a.Opens++
		}
		// Split at the steps' edges.
		for begin < end {
			edge := min(end, (begin/1000/stepSeconds+1)*stepSeconds*1000)
			seconds := float64(edge-begin) / 1000
			stepAt(begin).ScreenSeconds += seconds
			a.Seconds += seconds
			result.ScreenSeconds += seconds
			begin = edge
		}
		return nil
	})
	if err != nil {
		return AppUsage{}, err
	}
	for _, st := range steps {
		result.Steps = append(result.Steps, *st)
	}
	slices.SortFunc(result.Steps, func(a, b AppUsageStep) int { return cmp.Compare(a.Time, b.Time) })
	for _, a := range apps {
		result.Apps = append(result.Apps, *a)
	}
	slices.SortFunc(result.Apps, func(a, b AppTime) int {
		return cmp.Or(cmp.Compare(b.Seconds, a.Seconds), cmp.Compare(b.Opens, a.Opens), cmp.Compare(a.App, b.App))
	})
	return result, nil
}
