import { Injectable, computed, inject } from '@angular/core';

import { DeviceService, readByHub } from '../devices/devices';
import { I18n, LanguageCode, TextParams } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { ExtraInfo, localized } from '../metrics/extras';
import { History, Point, Series } from '../metrics/metrics';
import { Category, byCategory, extraCategory, unitCard, valueCard } from '../dashboard/categories';
import { HistoryStore } from './history-store';
import { ChartData, ChartLine } from './line-chart';

export interface Chart extends ChartData {
  category: Category;
  /** The id of the chart, which its dashboard card draws, such as "cpu" or "extra:pressure@percent". */
  card: string;
}

/**
 * The charts of the picked device's history over the range picked at the top of the page, by the
 * category of the cards they go with.
 */
@Injectable({ providedIn: 'root' })
export class DeviceCharts {
  private readonly devices = inject(DeviceService);
  private readonly store = inject(HistoryStore);
  private readonly i18n = inject(I18n);

  /**
   * Whether the hub reads the picked device. The list of devices is read every 5 s, which gives a
   * new device each time, so the charts depend on only this, not to be drawn again each time.
   */
  private readonly readByHub = computed(() => readByHub(this.devices.selected()));

  /** Whether a CPU or memory at 0 throughout is not told: by a device the hub reads, or a phone. */
  private readonly untold = computed(
    () => this.readByHub() || this.devices.selected()?.kind === 'phone',
  );

  private readonly charts = computed(() => this.chartsOf(this.store.history()));

  /** The charts of each card that has any, by the card's id. */
  readonly byCard = computed(() => {
    const charts = new Map<string, Chart[]>();
    for (const chart of this.charts()) {
      charts.set(chart.card, [...(charts.get(chart.card) ?? []), chart]);
    }
    return charts;
  });

  /** The charts of each category that has any, in the order the dashboard shows its cards. */
  readonly byCategory = computed(() => groupByCategory(this.charts()));

  /**
   * The charts of another history of the picked device, such as a zoomed-in part of the range,
   * by category as `byCategory` has them.
   */
  categoriesOf(history: History | null): Map<Category, Chart[]> {
    return groupByCategory(this.chartsOf(history));
  }

  private chartsOf(history: History | null): Chart[] {
    if (!history) {
      return [];
    }
    return [
      ...chartsOf(
        history.series,
        (key, params) => this.i18n.t(key, params),
        this.readByHub(),
        this.untold(),
      ),
      ...extraChartsOf(history.series, history.extras ?? {}, this.i18n.language()),
    ];
  }
}

/** The lines, each labelled label(its label). */
function relabeled(lines: ChartLine[], label: (old: string) => string): ChartLine[] {
  return lines.map((line) => ({ ...line, label: label(line.label) }));
}

function groupByCategory(charts: Chart[]): Map<Category, Chart[]> {
  return new Map(byCategory(charts, (chart) => chart.category).map((g) => [g.category, g.items]));
}

/**
 * The lines of the network chart: what all interfaces received and sent
 * together. A router passes each byte it forwards through two of its
 * interfaces, so for a router only its internet connection (WAN) is added up,
 * or, where it does not tell which interface that is, each interface gets
 * lines of its own.
 */
function networkLines(
  received: ChartLine[],
  sent: ChartLine[],
  t: (key: MessageKey, params?: TextParams) => string,
  router: boolean,
): ChartLine[] {
  if (router) {
    const wan = (lines: ChartLine[]) => lines.filter((line) => isWan(line.label));
    if (wan(received).length === 0 && wan(sent).length === 0) {
      return [
        ...relabeled(received, (name) => t('history.interfaceReceived', { name })),
        ...relabeled(sent, (name) => t('history.interfaceSent', { name })),
      ];
    }
    received = wan(received);
    sent = wan(sent);
  }
  return [
    { label: t('history.received'), points: sum(received) },
    { label: t('history.sent'), points: sum(sent) },
  ];
}

/**
 * Groups the stored metrics into charts: CPU, memory and swap, battery, GPUs,
 * temperatures, network speed, the time another device took to answer the hub,
 * disk usage and disk activity, with titles and
 * labels in the language of t. Charts without values are left out. A router
 * read without a login tells no CPU or memory, and a phone no CPU (nor its
 * memory when its user chose not to collect it), which are kept as 0, so with
 * untold those lines are left out while they hold nothing but 0. A router's
 * network is its internet connection where it tells which one that is, as
 * its other interfaces carry the same traffic again.
 */
export function chartsOf(
  series: Series[],
  t: (key: MessageKey, params?: TextParams) => string,
  router = false,
  untold = router,
): Chart[] {
  const named = (kind: string) => linesOf(series, kind);
  const metric = (name: string) => devicePoints(series, name, untold);

  const charts: Chart[] = [
    {
      title: t('history.cpu'),
      category: 'system',
      card: 'cpu',
      unit: 'percent',
      max: 100,
      lines: [{ label: t('history.cpu'), points: metric('cpu') }],
    },
    {
      title: t('history.memory'),
      category: 'system',
      card: 'memory',
      unit: 'percent',
      max: 100,
      lines: [
        { label: t('history.memory'), points: metric('memory') },
        // Machines without swap space have no swap line.
        ...(metric('swap').length > 0
          ? [{ label: t('history.swap'), points: metric('swap') }]
          : []),
      ],
    },
    {
      title: t('history.battery'),
      category: 'temperature',
      card: 'battery',
      unit: 'percent',
      max: 100,
      lines: [{ label: t('history.charge'), points: metric('battery') }],
    },
    {
      title: t('history.gpu'),
      category: 'system',
      card: 'gpus',
      unit: 'percent',
      max: 100,
      lines: [
        ...named('gpu'),
        ...relabeled(named('gpu.memory'), (name) => t('history.gpuMemory', { name })),
      ],
    },
    {
      title: t('history.temperature'),
      category: 'temperature',
      card: 'temperatures',
      unit: 'celsius',
      lines: named('temperature'),
    },
    {
      title: t('history.network'),
      category: 'network',
      card: 'network',
      unit: 'bytesPerSecond',
      lines: networkLines(named('network.receive'), named('network.send'), t, router),
    },
    {
      title: t('history.responseTime'),
      category: 'network',
      card: 'connection',
      unit: 'milliseconds',
      lines: [{ label: t('history.responseTime'), points: metric('response') }],
    },
    {
      title: t('history.disks'),
      category: 'storage',
      card: 'disks',
      unit: 'percent',
      max: 100,
      lines: named('disk'),
    },
    {
      title: t('history.diskActivity'),
      category: 'storage',
      card: 'diskActivity',
      unit: 'bytesPerSecond',
      lines: [
        ...relabeled(named('disk.read'), (path) => t('history.diskRead', { path })),
        ...relabeled(named('disk.write'), (path) => t('history.diskWritten', { path })),
      ],
    },
  ];
  return charts.filter((chart) => chart.lines.some((line) => line.points.length > 0));
}

/**
 * Draws the extras: one chart per group and unit, for the card of that unit,
 * titled and labelled as the device describes them, in the page's language.
 * Series without a description are left out.
 */
export function extraChartsOf(
  series: Series[],
  extras: Record<string, ExtraInfo>,
  language: LanguageCode,
): Chart[] {
  const charts = new Map<string, Chart>();
  for (const s of series) {
    const info = extras[s.metric];
    if (!info || info.unit === 'text' || s.points.length === 0) {
      continue;
    }
    const group = s.metric.slice(0, s.metric.indexOf('/'));
    const key = `${group} ${info.unit}`;
    let chart = charts.get(key);
    if (!chart) {
      chart = {
        title: localized(info.title, info.titles, language),
        category: extraCategory(group.slice('extra:'.length)),
        card: unitCard(group.slice('extra:'.length), info.unit),
        unit: info.unit,
        max: info.unit === 'percent' ? 100 : undefined,
        lines: [],
      };
      charts.set(key, chart);
    }
    chart.lines.push({ label: localized(info.label, info.labels, language), points: s.points });
  }
  // A chart of one line has no legend, so its title names the value.
  return [...charts.values()].map((chart) =>
    chart.lines.length === 1
      ? { ...chart, title: `${chart.title} · ${chart.lines[0].label}` }
      : chart,
  );
}

/**
 * One chart for each value of the extras made into a card, by the cards' ids, titled by its group
 * and its label. Series without a description are left out.
 */
export function valueChartsOf(
  series: Series[],
  extras: Record<string, ExtraInfo>,
  made: ReadonlySet<string>,
  language: LanguageCode,
): Chart[] {
  return series.flatMap((s): Chart[] => {
    const info = extras[s.metric];
    const name = s.metric.slice('extra:'.length);
    const group = name.slice(0, name.indexOf('/'));
    const card = valueCard(group, name.slice(group.length + 1));
    if (!info || info.unit === 'text' || s.points.length === 0 || !made.has(card)) {
      return [];
    }
    const label = localized(info.label, info.labels, language);
    return [
      {
        title: `${localized(info.title, info.titles, language)} · ${label}`,
        category: extraCategory(group),
        card,
        unit: info.unit,
        max: info.unit === 'percent' ? 100 : undefined,
        lines: [{ label, points: s.points }],
      },
    ];
  });
}

/** Whether a router's interface is its internet connection: "WAN", or "WAN 2" for a second one. */
export function isWan(name: string): boolean {
  return name === 'WAN' || name.startsWith('WAN ');
}

/**
 * The points of one metric of a device, such as "cpu"; none when it is not stored, and with untold
 * none for the CPU and memory while they hold nothing but 0, as a router read without a login tells
 * neither, and a phone no CPU.
 */
export function devicePoints(series: Series[], name: string, untold: boolean): Point[] {
  const points = pointsOf(series, name);
  const none =
    untold && (name === 'cpu' || name === 'memory') && points.every((p) => p.value === 0);
  return none ? [] : points;
}

/** The points of one metric, such as "cpu"; none when it is not stored. */
export function pointsOf(series: Series[], name: string): Point[] {
  return series.find((s) => s.metric === name)?.points ?? [];
}

/** The lines of a kind of metric, such as every network card's received bytes, labelled by name. */
export function linesOf(series: Series[], kind: string): ChartLine[] {
  return series
    .filter((s) => s.metric.startsWith(kind + ':'))
    .map((s) => ({ label: s.metric.slice(kind.length + 1), points: s.points }));
}

/** Adds up the values of several lines at each time, such as the traffic of all network cards. */
export function sum(lines: ChartLine[]): Point[] {
  const totals = new Map<number, number>();
  for (const line of lines) {
    for (const point of line.points) {
      totals.set(point.time, (totals.get(point.time) ?? 0) + point.value);
    }
  }
  return [...totals].map(([time, value]) => ({ time, value })).sort((a, b) => a.time - b.time);
}
