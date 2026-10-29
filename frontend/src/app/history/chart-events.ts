import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, filter, of, share, switchMap, tap } from 'rxjs';

import { AlertLevel } from '../alerts/alert';
import { alertText } from '../alerts/alerts';
import { DeviceService, switchedOff } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { DeviceEvent, MetricsService } from '../metrics/metrics';
import { HistoryStore } from './history-store';

/** How often the events of the shown range are read again at most, while the range stays. */
export const EVENTS_REFRESH_MS = 30_000;

/**
 * Something the charts mark: a thin line at a moment, or a faint band from `time` to `end` for a
 * time the device did not answer or was switched off, with what happened in words.
 */
export interface ChartMarker {
  kind: 'alert' | 'alertEnded' | 'outage' | 'reboot' | 'update';
  time: number;
  /** The end of a band. */
  end?: number;
  /** How serious an alert was. */
  level?: AlertLevel;
  text: string;
}

/**
 * The marks of a device's events: an alert where it started and where it ended, a band for each
 * time the device did not answer (for a PC, was switched off), a line for each reboot and each
 * update of Den-Watcher. An alert that the device does not answer is left out, as its band shows
 * that already, and so are kinds this page does not know.
 */
export function markersOf(events: DeviceEvent[], i18n: I18n, pc: boolean): ChartMarker[] {
  return events.flatMap((e): ChartMarker[] => {
    switch (e.kind) {
      case 'alert': {
        if (!e.alert || e.alert.kind === 'offline') {
          return [];
        }
        const text = alertText(e.alert, i18n);
        const level = e.alert.level;
        const started: ChartMarker = { kind: 'alert', time: e.time, level, text };
        return e.end === undefined
          ? [started]
          : [
              started,
              { kind: 'alertEnded', time: e.end, level, text: i18n.t('events.ended', { text }) },
            ];
      }
      case 'outage':
        return [
          {
            kind: 'outage',
            time: e.time,
            end: e.end ?? e.time,
            text: i18n.t(pc ? 'events.off' : 'events.outage'),
          },
        ];
      case 'reboot':
        return [{ kind: 'reboot', time: e.time, text: i18n.t('events.reboot') }];
      case 'update':
        return [
          {
            kind: 'update',
            time: e.time,
            text: i18n.t('events.update', { version: e.detail ?? '' }),
          },
        ];
      default:
        return [];
    }
  });
}

/**
 * The marks of what happened to the picked device over the range the charts show. They are read
 * while something watches, when the range or the device changes, and as the range moves on at
 * most every 30 seconds, as events are rare.
 */
@Injectable({ providedIn: 'root' })
export class ChartEvents {
  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);
  private readonly store = inject(HistoryStore);
  private readonly i18n = inject(I18n);

  private readonly events = signal<{ device: string; events: DeviceEvent[] } | null>(null);
  /** Whether the picked device is a PC or phone; kept apart, as the list of devices is read every 5 s. */
  private readonly pc = computed(() => switchedOff(this.devices.selected().kind));

  /** The marks of the picked device, in the page's language. */
  readonly markers = computed((): ChartMarker[] => {
    const read = this.events();
    if (!read || read.device !== this.devices.selectedId()) {
      return [];
    }
    return markersOf(read.events, this.i18n, this.pc());
  });

  /** Reads the events of the shown range while subscribed to. */
  readonly watch: Observable<unknown> = this.reads().pipe(share());

  private reads(): Observable<unknown> {
    let last: { key: string; at: number } | null = null;
    const range = computed(() => {
      const history = this.store.history();
      return history
        ? { from: history.from, to: history.to, device: this.devices.selectedId() }
        : null;
    });
    return toObservable(range).pipe(
      filter((r) => {
        if (!r) {
          return false;
        }
        // The same device and length of range only moved on with time.
        const key = `${r.device}\n${r.to - r.from}`;
        const due = last?.key !== key || Date.now() - last.at >= EVENTS_REFRESH_MS;
        if (due) {
          last = { key, at: Date.now() };
        }
        return due;
      }),
      switchMap((r) =>
        this.metrics.events(r!.from, r!.to, r!.device).pipe(
          tap((answer) => this.events.set({ device: r!.device, events: answer.events })),
          // Without events the charts are still drawn, unmarked, and the next range reads them again.
          catchError(() => {
            last = null;
            return of(null);
          }),
        ),
      ),
    );
  }
}

/** A mark placed on a time axis, in percent of its width. */
export interface PlacedMarker extends ChartMarker {
  left: number;
  /** The width of a band. */
  width?: number;
}

/** The marks within `from` to `to` (Unix seconds), placed on that axis; a band is cut to it. */
export function placeMarkers(markers: ChartMarker[], from: number, to: number): PlacedMarker[] {
  const span = to - from;
  if (span <= 0) {
    return [];
  }
  const at = (time: number) => ((time - from) / span) * 100;
  return markers.flatMap((m): PlacedMarker[] => {
    if (m.end !== undefined) {
      const start = Math.max(m.time, from);
      const end = Math.min(m.end, to);
      return end < start ? [] : [{ ...m, left: at(start), width: at(end) - at(start) }];
    }
    return m.time < from || m.time > to ? [] : [{ ...m, left: at(m.time) }];
  });
}

/**
 * The marks in the step that starts at `time` and lasts `step` seconds, or a band over it, and
 * those up to `slack` seconds beside it, as a line a pixel wide is hard to point at exactly.
 */
export function markersIn(
  markers: ChartMarker[],
  time: number,
  step: number,
  slack = 0,
): ChartMarker[] {
  const start = time - slack;
  const end = time + step + slack;
  return markers.filter((m) =>
    m.end !== undefined ? m.time < end && m.end >= start : m.time >= start && m.time < end,
  );
}

/** How far beside the pointer a mark is still told, as a share of the time axis. */
export const POINTER_SLACK = 0.01;
