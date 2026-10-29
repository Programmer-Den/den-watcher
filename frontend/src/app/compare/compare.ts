import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AlertLevel } from '../alerts/alert';
import { AlertIcon } from '../alerts/alert-icon';
import { worstLevel } from '../alerts/alerts';
import { HubConnection } from '../connection/connection';
import { Device, DeviceService, deviceName, deviceState, notInUse } from '../devices/devices';
import { StatusDot } from '../devices/status-dot';
import { FleetValues } from '../devices/fleet-values';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { EvenColumns } from '../layout/even-columns';
import { BytesPipe } from '../metrics/bytes.pipe';
import { formatUptime } from '../metrics/format';
import { History, MetricsService, Point, Series, nowSeconds } from '../metrics/metrics';
import { Summary } from '../metrics/summary';
import { SYSTEM_FACTS, factValues } from '../metrics/system';
import { PageVisibility } from '../page-visibility';
import { devicePoints } from '../history/history';
import { Range, refreshIntervalMs } from '../history/history-store';
import { ChartLine, ChartUnit, LineChart } from '../history/line-chart';
import { WifiNearby } from './wifi-nearby';

/** A column of the table the rows can be sorted by, largest first. */
export type Column = 'cpu' | 'memory' | 'disk' | 'temperature' | 'network' | 'uptime' | 'alerts';

const COLUMNS: { id: Column; label: MessageKey }[] = [
  { id: 'cpu', label: 'compare.cpu' },
  { id: 'memory', label: 'compare.memory' },
  { id: 'disk', label: 'compare.disk' },
  { id: 'temperature', label: 'compare.temperature' },
  { id: 'network', label: 'compare.network' },
  { id: 'uptime', label: 'compare.uptime' },
  { id: 'alerts', label: 'compare.alerts' },
];

/** A row of the table of what each device is: its facts in the order of SYSTEM_FACTS. */
export interface SystemRow {
  device: Device;
  values: (string | undefined)[];
}

/** The facts of each device that tells them, in the order of the rows. */
export function systemRows(rows: readonly Row[]): SystemRow[] {
  return rows.flatMap(({ device, summary }) => {
    const system = summary?.system;
    return system ? [{ device, values: factValues(system, summary.version) }] : [];
  });
}

/** One row of the table: a device and its values, which are missing while it does not answer. */
export interface Row {
  device: Device;
  summary: Summary | null;
}

const LEVEL_ORDER: Record<AlertLevel, number> = { alert: 2, warning: 1 };

/** What a row is sorted by in a column; missing values sort last. */
export function sortValue(row: Row, column: Column): number | undefined {
  const s = row.summary;
  switch (column) {
    case 'cpu':
      return s?.cpu;
    case 'memory':
      return s?.memory;
    case 'disk':
      return s?.disk?.percent;
    case 'temperature':
      return s?.temperature?.celsius;
    case 'network':
      return s?.network && s.network.receive + s.network.send;
    case 'uptime':
      return s?.uptimeSeconds;
    case 'alerts': {
      const alerts = row.device.alerts ?? [];
      const level = worstLevel(alerts);
      return level ? LEVEL_ORDER[level] * 1000 + alerts.length : undefined;
    }
  }
}

/** The rows largest first in the column, missing values last and equal ones in the given order. */
export function sortRows(rows: readonly Row[], column: Column | null): Row[] {
  if (!column) {
    return [...rows];
  }
  const value = (row: Row) => sortValue(row, column) ?? -Infinity;
  return [...rows].sort((a, b) => value(b) - value(a));
}

/**
 * The time ranges of the charts, fewer than the history has, as they chart every device. Only those
 * within the history the hub keeps are offered.
 */
const RANGES: Range[] = [
  { label: 'history.range1h', seconds: 3600 },
  { label: 'history.range6h', seconds: 6 * 3600 },
  { label: 'history.range1d', seconds: 86400 },
  { label: 'history.range7d', seconds: 7 * 86400 },
  { label: 'history.range30d', seconds: 30 * 86400 },
];

/** A chart with one line per device. */
interface CompareChart {
  title: MessageKey;
  unit: ChartUnit;
  max?: number;
  /**
   * The device's line, from its history; `untold` is set for a router or a phone, whose CPU (or
   * memory) at 0 throughout is not told.
   */
  points: (series: Series[], untold: boolean) => Point[];
}

/** The largest value of the series of a kind at each time, such as the fullest disk. */
export function largest(series: Series[], kind: string): Point[] {
  const values = new Map<number, number>();
  for (const s of series.filter((s) => s.metric.startsWith(kind + ':'))) {
    for (const p of s.points) {
      values.set(p.time, Math.max(values.get(p.time) ?? -Infinity, p.value));
    }
  }
  return [...values].map(([time, value]) => ({ time, value })).sort((a, b) => a.time - b.time);
}

/**
 * The points of the steps within the range the charts show. For a device that does not answer, the
 * backend moves its history back to end at its last reading, which can be before the range.
 */
export function within(
  points: Point[],
  range: { from: number; to: number; step: number },
): Point[] {
  return points.filter((p) => p.time > range.from - range.step && p.time < range.to);
}

/** Whether a device tells no CPU or memory when they are 0: a router, or a phone. */
function untold(device: Device): boolean {
  return !!device.router || device.kind === 'phone';
}

const CHARTS: CompareChart[] = [
  {
    title: 'compare.cpu',
    unit: 'percent',
    max: 100,
    points: (s, untold) => devicePoints(s, 'cpu', untold),
  },
  {
    title: 'compare.memory',
    unit: 'percent',
    max: 100,
    points: (s, untold) => devicePoints(s, 'memory', untold),
  },
  { title: 'compare.disk', unit: 'percent', max: 100, points: (s) => largest(s, 'disk') },
  { title: 'compare.temperature', unit: 'celsius', points: (s) => largest(s, 'temperature') },
];

/** The histories of the compared devices over one range. */
interface Histories {
  from: number;
  to: number;
  step: number;
  devices: { device: Device; history: History }[];
}

/**
 * Compares the devices: their main values now side by side in a table that sorts by any column,
 * charts of the CPU, memory, fullest disk and hottest sensor with a line per device, and the Wi-Fi
 * networks the devices see.
 */
@Component({
  selector: 'app-compare',
  imports: [AlertIcon, BytesPipe, DecimalPipe, EvenColumns, LineChart, StatusDot, WifiNearby],
  templateUrl: './compare.html',
  styleUrl: './compare.css',
})
export class Compare {
  private readonly metrics = inject(MetricsService);
  private readonly page = inject(PageVisibility);
  protected readonly devices = inject(DeviceService);
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);

  protected readonly columns = COLUMNS;
  protected readonly factLabels = SYSTEM_FACTS;
  /** How many days of history the hub keeps, as its answers tell; until then every range is offered. */
  private readonly retentionDays = signal<number | null>(null);
  protected readonly ranges = computed(() => {
    const days = this.retentionDays();
    const ranges = days ? RANGES.filter((r) => r.seconds <= days * 86400) : RANGES;
    return ranges.length > 0 ? ranges : RANGES.slice(0, 1);
  });
  protected readonly deviceName = deviceName;
  protected readonly state = deviceState;
  protected readonly worstLevel = worstLevel;
  protected readonly formatUptime = formatUptime;
  protected readonly sortedBy = signal<Column | null>(null);
  protected readonly range = signal(RANGES[2]);

  private readonly fleet = inject(FleetValues);
  private readonly summaries = this.fleet.summaries;
  protected readonly rows = computed(() =>
    sortRows(
      this.devices.devices().map((device) => ({
        device,
        summary: this.summaries().get(device.id) ?? null,
      })),
      this.sortedBy(),
    ),
  );

  /** What each device is, in the order of the table above; one that does not answer is left out. */
  protected readonly systems = computed(() => systemRows(this.rows()));

  /** The devices with a history to chart: all but checks, which keep only their response time. */
  private readonly charted = computed(
    () => this.devices.devices().filter((d) => !d.checked),
    // The list is read again every few seconds; the charts load again only when it changes.
    { equal: (a, b) => a.map((d) => d.id).join('\n') === b.map((d) => d.id).join('\n') },
  );
  /**
   * Each device's name and whether its CPU or memory at 0 is untold, as of a router or a phone, by
   * its id, from the list. The list is read every few seconds, so they are kept apart and the
   * charts are drawn again only when they change.
   */
  private readonly named = computed(
    () =>
      new Map(
        this.devices
          .devices()
          .map((d) => [d.id, { label: deviceName(d, this.i18n), untold: untold(d) }]),
      ),
    { equal: (a, b) => JSON.stringify([...a]) === JSON.stringify([...b]) },
  );
  protected readonly histories = signal<Histories | null>(null);
  protected readonly charts = computed(() => {
    const h = this.histories();
    if (!h) {
      return [];
    }
    // Each device's line takes its color by the device's place, so it keeps it in every chart.
    const places = new Map(this.charted().map((device, place) => [device.id, place]));
    // The histories are read again only when the devices change, so a device's name and kind
    // come from the list.
    const named = this.named();
    return CHARTS.map((chart) => ({
      title: this.i18n.t(chart.title),
      unit: chart.unit,
      max: chart.max,
      lines: h.devices
        .map(({ device: read, history }): ChartLine => {
          const { label, untold: untoldZero } = named.get(read.id) ?? {
            label: deviceName(read, this.i18n),
            untold: untold(read),
          };
          return {
            label,
            points: within(chart.points(history.series, untoldZero), h),
            place: places.get(read.id),
          };
        })
        .filter((line) => line.points.length > 0),
    })).filter((chart) => chart.lines.length > 0);
  });

  constructor() {
    this.fleet.watch.pipe(takeUntilDestroyed()).subscribe();

    toObservable(computed(() => ({ range: this.range(), devices: this.charted() })))
      .pipe(
        switchMap(({ range, devices }) =>
          this.page.poll(refreshIntervalMs(range.seconds), () =>
            this.readHistories(range.seconds, devices),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((histories) => this.received(histories));
  }

  private received(histories: Histories): void {
    this.histories.set(histories);
    const days = histories.devices[0]?.history.retentionDays;
    if (days) {
      this.retentionDays.set(days);
      // A range picked before the hub said how long it keeps history may be longer than that; the
      // longest range offered stands in for it.
      const ranges = this.ranges();
      if (!ranges.includes(this.range())) {
        this.range.set(ranges[ranges.length - 1]);
      }
    }
  }

  private readHistories(seconds: number, devices: Device[]): Observable<Histories> {
    const to = nowSeconds();
    const from = to - seconds;
    if (devices.length === 0) {
      return of({ from, to, step: 60, devices: [] });
    }
    return forkJoin(
      devices.map((device) =>
        this.metrics.history(from, to, device.id).pipe(
          map((history) => ({ device, history })),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(
      map((answers) => {
        const read = answers.filter((a) => a !== null);
        // The backend ends the range at its own time, so a clock behind the hub's does not cut
        // off the newest steps. A device that does not answer has its history moved back, which
        // does not move the range.
        const end = Math.max(to, ...read.map((a) => a.history.to));
        return {
          from: end - seconds,
          to: end,
          step: read[0]?.history.stepSeconds ?? 60,
          devices: read,
        };
      }),
    );
  }

  /** Sorts by the column, largest first, or back to the order of the devices when it is sorted by it. */
  protected sort(column: Column): void {
    this.sortedBy.update((c) => (c === column ? null : column));
  }

  /**
   * Why a row has no values: the device waits for its pairing code, does not answer, its values did
   * not come in time for the last read, or they are on their way.
   */
  protected noValues(row: Row): string {
    // Waiting for its pairing code, the device answers but sends no values.
    if (row.device.pairing) {
      return this.i18n.t(
        row.device.pairing === 'wrong'
          ? 'devicesDialog.pairingWrong'
          : 'devicesDialog.pairingNeeded',
      );
    }
    if (row.device.unreachable) {
      return this.i18n.t(notInUse(row.device) ? 'devices.notInUse' : 'devices.unreachable');
    }
    if (this.summaries().has(row.device.id)) {
      return this.i18n.t('compare.noValues');
    }
    return this.i18n.t('history.loading');
  }
}
