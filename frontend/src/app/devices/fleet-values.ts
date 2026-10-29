import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, map, of, share, tap } from 'rxjs';

import { MetricsService } from '../metrics/metrics';
import { Summary, summarize } from '../metrics/summary';
import { PageVisibility } from '../page-visibility';
import { DeviceService, readByHub } from './devices';

/** How often the current values of all devices are read again, as often as the hub reads them. */
export const FLEET_REFRESH_MS = 5000;

/**
 * The main values of every device now, for the list of devices and the comparison. They are read
 * only while something watches them, and once for all watchers.
 */
@Injectable({ providedIn: 'root' })
export class FleetValues {
  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);

  /** The values of each device read; null for one whose values could not be read. */
  readonly summaries = signal<ReadonlyMap<string, Summary | null>>(new Map());

  /** Reads the values while it is subscribed to; any number of watchers share one read. */
  readonly watch: Observable<unknown> = inject(PageVisibility)
    .poll(FLEET_REFRESH_MS, () => this.read())
    .pipe(
      tap((summaries) => this.summaries.set(summaries)),
      share(),
    );

  /**
   * The values of every device that answers, in one request for all of them; the hub does not ask
   * for those of one that does not. When the request fails, the values read before stay.
   */
  private read(): Observable<Map<string, Summary | null>> {
    if (!this.devices.devices().some((d) => !d.unreachable)) {
      return of(new Map());
    }
    return this.metrics.fleet().pipe(
      map(
        (usage) =>
          new Map(
            this.devices
              .devices()
              .filter((d) => !d.unreachable)
              .map((d): [string, Summary | null] => [
                d.id,
                usage[d.id] ? summarize(usage[d.id], readByHub(d)) : null,
              ]),
          ),
      ),
      catchError(() => EMPTY),
    );
  }
}
