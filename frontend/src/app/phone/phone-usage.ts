import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import { HubConnection } from '../connection/connection';
import { DeviceService } from '../devices/devices';
import { HistoryStore } from '../history/history-store';
import { I18n } from '../i18n/i18n';
import { formatDuration } from '../metrics/format';
import { MetricsService, PhoneUsage, nowSeconds } from '../metrics/metrics';
import { PageVisibility } from '../page-visibility';

/** How often a phone's app usage is read again. */
export const USAGE_REFRESH_MS = 60_000;

/** How many apps the card lists until all are asked for. */
export const FIRST_APPS = 8;

/** The fewest steps the chart is drawn for: fewer tell no more than the screen time in all. */
export const MIN_BARS = 3;

/** One bar of the chart: the screen time of a step, as a share of the longest step's. */
export interface UsageBar {
  time: number;
  seconds: number;
  unlocks: number;
  share: number;
}

/**
 * The bars of the chart, one per step of the range, also for the steps nothing happened in, each
 * as a share of the longest.
 */
export function usageBars(usage: PhoneUsage): UsageBar[] {
  const step = Math.max(usage.stepSeconds, 1);
  const byTime = new Map(usage.steps.map((s) => [s.time, s]));
  const longest = Math.max(1, ...usage.steps.map((s) => s.screenSeconds));
  const bars: UsageBar[] = [];
  for (let time = Math.floor(usage.from / step) * step; time < usage.to; time += step) {
    const s = byTime.get(time);
    const seconds = s?.screenSeconds ?? 0;
    bars.push({ time, seconds, unlocks: s?.unlocks ?? 0, share: seconds / longest });
  }
  return bars;
}

/**
 * A phone's screen time over the picked range, from what its app reads with usage access: how
 * long its apps were in use and how often it was unlocked, in all and over time, and the time in
 * each app with how often it was opened, the longest used first.
 */
@Component({
  selector: 'app-phone-usage',
  imports: [DatePipe],
  templateUrl: './phone-usage.html',
  styleUrl: './phone-usage.css',
})
export class PhoneUsageCard {
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);
  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);
  private readonly store = inject(HistoryStore);
  private readonly page = inject(PageVisibility);

  protected readonly MIN_BARS = MIN_BARS;
  protected readonly usage = signal<PhoneUsage | null>(null);
  protected readonly showAll = signal(false);

  protected readonly bars = computed(() => {
    const usage = this.usage();
    return usage ? usageBars(usage) : [];
  });

  protected readonly apps = computed(() => {
    const apps = this.usage()?.apps ?? [];
    return this.showAll() ? apps : apps.slice(0, FIRST_APPS);
  });

  /** The longest time of an app, which the apps' bars are a share of. */
  protected readonly longestApp = computed(() =>
    Math.max(1, ...(this.usage()?.apps ?? []).map((a) => a.seconds)),
  );

  protected readonly duration = (seconds: number) => formatDuration(seconds, this.i18n);

  /** How many days the range covers, for the average a day, or 0 for a range under two days. */
  protected readonly days = (usage: PhoneUsage) => {
    const days = (usage.to - usage.from) / 86400;
    return days >= 2 ? days : 0;
  };

  /** Short steps show the time of day, steps of a day or longer the day. */
  protected readonly stepFormat = computed(() =>
    this.i18n.t(
      (this.usage()?.stepSeconds ?? 0) >= 86400 ? 'format.dayMonth' : 'format.weekdayTime',
    ),
  );

  constructor() {
    const asked = computed(() => ({ device: this.devices.selected().id, span: this.store.span() }));
    toObservable(asked)
      .pipe(
        switchMap(({ device, span }) => {
          this.usage.set(null);
          this.showAll.set(false);
          return this.page.poll(USAGE_REFRESH_MS, () => {
            const to = nowSeconds();
            return this.metrics.phoneUsage(to - span, to, device).pipe(catchError(() => of(null)));
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((usage) => {
        if (usage) {
          this.usage.set(usage);
        }
      });
  }
}
