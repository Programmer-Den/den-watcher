import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  defer,
  finalize,
  map,
  merge,
  of,
  share,
  switchMap,
  tap,
} from 'rxjs';

import { readStored, store } from '../browser';

import { DeviceService } from '../devices/devices';
import { MessageKey } from '../i18n/messages/en';
import { History, MetricsService, nowSeconds } from '../metrics/metrics';
import { PageVisibility } from '../page-visibility';
import { LiveHistory, SHORT_SPAN } from './live-history';

/** A time range a chart can show, always ending now. */
export interface Range {
  label: MessageKey;
  seconds: number;
}

/** A group of ranges picked in the first row; its ranges are picked in the second. */
export interface RangeUnit {
  id: 'minutes' | 'hours' | 'days' | 'years';
  label: MessageKey;
  ranges: Range[];
}

/**
 * The ranges, grouped by unit. Ranges that reach back past the backend's retention are read in whole
 * days from its daily averages, which it keeps for good, so every range is offered on every hub.
 */
export const UNITS: RangeUnit[] = [
  {
    id: 'minutes',
    label: 'history.unitMinutes',
    ranges: [
      { label: 'history.range1m', seconds: 60 },
      { label: 'history.range5m', seconds: 5 * 60 },
      { label: 'history.range10m', seconds: 10 * 60 },
      { label: 'history.range30m', seconds: 30 * 60 },
    ],
  },
  {
    id: 'hours',
    label: 'history.unitHours',
    ranges: [
      { label: 'history.range1h', seconds: 3600 },
      { label: 'history.range3h', seconds: 3 * 3600 },
      { label: 'history.range6h', seconds: 6 * 3600 },
      { label: 'history.range12h', seconds: 12 * 3600 },
    ],
  },
  {
    id: 'days',
    label: 'history.unitDays',
    ranges: [
      { label: 'history.range1d', seconds: 86400 },
      { label: 'history.range7d', seconds: 7 * 86400 },
      { label: 'history.range14d', seconds: 14 * 86400 },
      { label: 'history.range30d', seconds: 30 * 86400 },
    ],
  },
  {
    id: 'years',
    label: 'history.unitYears',
    ranges: [
      { label: 'history.range90d', seconds: 90 * 86400 },
      { label: 'history.range1y', seconds: 365 * 86400 },
      { label: 'history.range2y', seconds: 2 * 365 * 86400 },
      { label: 'history.range5y', seconds: 5 * 365 * 86400 },
    ],
  },
];

/** A week, in seconds. */
export const WEEK = 7 * 86400;

/** Where the choice to show the week before is kept between visits, in localStorage. */
export const WEEK_BEFORE_STORAGE_KEY = 'weekBefore';

/**
 * Whether the charts can show the same time a week before for a range: from an hour, which the
 * backend reads in minute averages now as a week ago, so the steps line up, up to a week. The week
 * before must also be within the retention (retentionDays, 0 for keeping everything), as the
 * backend answers older ranges in whole days, whose steps would not line up.
 */
export function weekBeforeOffered(spanSeconds: number, retentionDays = 0): boolean {
  return (
    spanSeconds >= 3600 &&
    spanSeconds <= WEEK &&
    (retentionDays <= 0 || WEEK + spanSeconds <= retentionDays * 86400)
  );
}

/**
 * How often a short range is read whole again instead of only its newest steps, in reads: once a
 * minute at a read every 5 seconds. It picks up the steps the backend filled in later, such as
 * those of a gap a hub could not reach the device in.
 */
const FULL_READ_EVERY = 12;

/**
 * How often a range is read again: every 5 seconds for ranges of up to 30
 * minutes, which the backend has readings every 5 seconds for; every minute
 * up to a day, when the backend stores a new average; and every 5 minutes
 * above that, where a step is hours long and a minute changes nothing visible.
 */
export function refreshIntervalMs(spanSeconds: number): number {
  if (spanSeconds <= SHORT_SPAN) {
    return 5_000;
  }
  return spanSeconds <= 86400 ? 60_000 : 300_000;
}

/**
 * The history of the picked device over the latest stretch of time, for everything on the page
 * that draws it. A unit (minutes, hours, days or years) and then a range of that unit pick how long
 * that stretch is. It is read only while something watches it,
 * and once for all watchers.
 */
@Injectable({ providedIn: 'root' })
export class HistoryStore {
  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);
  private readonly page = inject(PageVisibility);
  private readonly window = inject(DOCUMENT).defaultView;

  /** The length of the shown time, in seconds; opens on the last 30 minutes. */
  readonly span = signal(30 * 60);

  readonly history = signal<History | null>(null);
  readonly unreachable = signal(false);

  /** Whether the charts show the same time a week before as faint lines; kept for the next visit. */
  readonly weekBefore = signal(readStored(this.window, WEEK_BEFORE_STORAGE_KEY) !== 'false');
  /** Whether the shown range can show the week before. */
  readonly weekBeforeOffered = computed(() =>
    weekBeforeOffered(this.span(), this.history()?.retentionDays),
  );
  /**
   * The history of the same range a week before, as the backend answers it (not moved on), or null
   * while it is not shown or not read yet.
   */
  readonly weekBeforeHistory = signal<History | null>(null);

  /**
   * The range and device the shown history was read for, so the week before is read only once the
   * picked device's answer for the picked range is in: a not answering device's range ends at its
   * last reading, which only that answer says.
   */
  private readonly answered = signal<{ span: number; device: string } | null>(null);

  /** The units and their ranges. */
  readonly units = signal<readonly RangeUnit[]>(UNITS).asReadonly();

  /** The unit the shown range belongs to. */
  readonly unit = computed(
    () =>
      this.units().find((unit) => unit.ranges.some((range) => range.seconds === this.span())) ??
      null,
  );

  /**
   * Reads the history while it is subscribed to and again as often as the range needs. For a
   * device that is not answering, the backend moves the stretch back to end at its last reading.
   */
  readonly watch: Observable<unknown> = merge(this.reads(), this.weekBeforeReads()).pipe(share());

  /** Shows the week before, or stops showing it. */
  toggleWeekBefore(): void {
    const on = !this.weekBefore();
    this.weekBefore.set(on);
    store(this.window, WEEK_BEFORE_STORAGE_KEY, String(on));
  }

  /** Shows the longest range of a unit, so switching units zooms in or out. */
  selectUnit(id: RangeUnit['id']): void {
    const unit = this.units().find((u) => u.id === id);
    if (unit) {
      this.span.set(unit.ranges[unit.ranges.length - 1].seconds);
    }
  }

  private reads(): Observable<History | null> {
    let shownDevice = this.devices.selectedId();
    return toObservable(
      computed(() => ({ span: this.span(), device: this.devices.selectedId() })),
    ).pipe(
      // Another device's history is not shown while the picked one's loads.
      tap(({ device }) => {
        // The week before waits for the answer of the new range or device.
        this.answered.set(null);
        if (device !== shownDevice) {
          shownDevice = device;
          this.history.set(null);
          this.unreachable.set(false);
        }
      }),
      // A tick while the previous answer is still on its way is skipped; long
      // ranges take the backend a moment.
      switchMap(({ span, device }) => {
        // A short range is kept in ring buffers, so most reads ask only for its newest steps.
        let live: LiveHistory | null = null;
        let reads = 0;
        const readAll = (to: number) =>
          this.metrics.history(to - span, to, device).pipe(
            map((history) => {
              if (!LiveHistory.canKeep(history, span)) {
                live = null;
                return history;
              }
              live = new LiveHistory(history, span);
              // The backend ends the range at its own time. As in the small reads, it starts a span
              // before that, so a clock ahead of the hub's does not make the range shorter.
              return { ...history, from: history.to - span };
            }),
          );
        return this.page.poll(refreshIntervalMs(span), () =>
          defer(() => {
            const to = nowSeconds();
            const kept = live;
            const since = kept?.since() ?? null;
            const whole = reads++ % FULL_READ_EVERY === 0;
            if (!kept || since === null || whole) {
              return readAll(to);
            }
            // The backend needs a range of at least a second.
            const until = Math.max(to, since + 1);
            return this.metrics.history(since, until, device).pipe(
              switchMap((update) => {
                const history = kept.add(update);
                return history ? of(history) : readAll(to);
              }),
            );
          }).pipe(
            catchError(() => {
              live = null;
              return of(null);
            }),
            tap((history) => {
              if (history) {
                this.answered.set({ span, device });
              }
            }),
          ),
        );
      }),
      tap((history) => this.received(history)),
      // Read again from the start when watched again, so the week before waits for that answer.
      finalize(() => this.answered.set(null)),
    );
  }

  /**
   * Reads the same range a week before while it is shown, as often as the range itself. A week
   * before that cannot be read is left out, without a notice. For a device that is not answering,
   * whose range ends at its last reading, it ends a week before that too, so it is read only once
   * the history of the picked device and range is in.
   */
  private weekBeforeReads(): Observable<History | null> {
    return toObservable(
      computed(
        () => {
          const span = this.span();
          const device = this.devices.selectedId();
          const answered = this.answered();
          const ready = answered?.span === span && answered.device === device;
          return { span, device, on: ready && this.weekBefore() && this.weekBeforeOffered() };
        },
        // A new answer for the same range and device does not start the reads over.
        { equal: (a, b) => a.span === b.span && a.device === b.device && a.on === b.on },
      ),
    ).pipe(
      tap(() => this.weekBeforeHistory.set(null)),
      switchMap(({ span, device, on }) =>
        on
          ? this.page.poll(refreshIntervalMs(span), () =>
              defer(() => {
                const shown = this.history();
                const end = shown?.lastReading !== undefined ? shown.to : nowSeconds();
                const to = end - WEEK;
                return this.metrics.history(to - span, to, device).pipe(catchError(() => of(null)));
              }),
            )
          : of(null),
      ),
      tap((history) => this.weekBeforeHistory.set(history)),
    );
  }

  private received(history: History | null): void {
    this.unreachable.set(history === null);
    if (history) {
      this.history.set(history);
    }
  }
}
