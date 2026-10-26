import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { DecimalPipe, NgTemplateOutlet, formatDate, formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, of, switchMap, tap } from 'rxjs';

import { AlertKind, AlertLevel } from '../alerts/alert';
import { AlertChips } from '../alerts/alert-chips';
import { alertText, throttlingText, worstLevel } from '../alerts/alerts';
import { HubConnection } from '../connection/connection';
import { CardCharts } from '../history/card-charts';
import { CategoryCharts } from '../history/category-charts';
import { Chart, DeviceCharts, valueChartsOf } from '../history/history';
import { HistoryStore } from '../history/history-store';
import { RangePicker } from '../history/range-picker';
import { Timeline } from '../history/timeline';
import {
  Availability,
  DeviceService,
  LOCAL_DEVICE,
  deviceName,
  switchedOff,
  readByHub,
} from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { KioskMode } from '../kiosk/kiosk';
import { EvenColumns } from '../layout/even-columns';
import { ScrollRows } from '../layout/scroll-rows';
import { BytesPipe } from '../metrics/bytes.pipe';
import { Extra, ExtraItem, ExtraUnit, formatExtra, localized } from '../metrics/extras';
import {
  MetricsService,
  NetworkInterface,
  Snapshot,
  Temperature,
  Throttling,
  ThrottlingCondition,
  TimeZone,
} from '../metrics/metrics';
import {
  cpuDetail,
  formatDuration,
  formatUptime,
  loadAverageText,
  usedOfTotal,
} from '../metrics/format';
import { systemFacts } from '../metrics/system';
import { PageVisibility } from '../page-visibility';
import { ArrangeBar } from './arrange-bar';
import { ArrangeControls } from './arrange-controls';
import { Arrangement } from './arrangement';
import { CardAlert } from './card-alert';
import { CardInfo } from './card-info';
import { CardSlot } from './card-slot';
import {
  ALL,
  CATEGORIES,
  Category,
  FoldedCategories,
  PINNED,
  Section,
  extraCategory,
  isDetailGroup,
  unitCard,
  valueCard,
} from './categories';
import { CATEGORY_TITLES, CategoryFold } from './category-fold';
import { Details } from './details';
import { DiskForecast } from './disk-forecast';
import { FitLabels } from './fit-labels';
import { Glance } from './glance';
import { HiddenCard, HiddenCards } from './hidden-cards';
import { PageView, ViewSwitch } from './page-view';
import { RowKey, rowKeys } from './row-keys';
import { CategoryRow } from './category-row';

/** How often the dashboard asks the backend for new values. */
export const REFRESH_INTERVAL_MS = 2000;

/** How often the availability of another device is read again. */
export const AVAILABILITY_REFRESH_MS = 10000;

/** The most core bars in one row; more cores are split evenly over several rows. */
const MAX_CORES_PER_ROW = 8;

/**
 * How many core bars go in one row: up to 8 stay in one row, more are split
 * evenly over as few rows as keep each at 8 or fewer (12 → 2 × 6, 20 → 7 + 7 + 6).
 */
export function coreColumns(cores: number): number {
  const rows = Math.ceil(cores / MAX_CORES_PER_ROW);
  return Math.ceil(cores / rows);
}

/** The groups of extras whose values are shown largest first, such as what each part draws. */
const LARGEST_FIRST = new Set(['power']);

/**
 * A value as the card shows it, to a tenth, so values that look the same compare equal and keep
 * their places by name instead of swapping as they wobble below what is shown.
 */
export function shown(value: number): number {
  return Math.round(value * 10);
}

/** The temperatures, hottest first; equal ones by name, so they keep their places. */
export function hottestFirst(temperatures: readonly Temperature[]): Temperature[] {
  return [...temperatures].sort(
    (a, b) => shown(b.celsius) - shown(a.celsius) || a.sensor.localeCompare(b.sensor),
  );
}

/** One section of the values of an extra: what they belong to, if anything, and the values. */
export interface ExtraSection {
  section?: string;
  items: ExtraItem[];
}

/**
 * The values of an extra as the card shows them: largest first for the groups in LARGEST_FIRST,
 * else in the order the device lists them, and the values of one section together under it, in the
 * order the sections first appear.
 */
export function extraSections(group: Extra): ExtraSection[] {
  const items = LARGEST_FIRST.has(group.id)
    ? [...group.items].sort(
        (a, b) =>
          (b.value === undefined ? -Infinity : shown(b.value)) -
            (a.value === undefined ? -Infinity : shown(a.value)) || a.id.localeCompare(b.id),
      )
    : group.items;
  const sections = new Map<string | undefined, ExtraItem[]>();
  for (const item of items) {
    const key = item.section || undefined;
    sections.set(key, [...(sections.get(key) ?? []), item]);
  }
  return [...sections].map(([section, items]) => ({ section, items }));
}

/**
 * The cards of a group of extras: one card, or one for each unit of the values it charts where they
 * have several, as values of different units share no chart and a card draws one chart at most.
 * Each unit's card has the id of its unit, so it keeps its place, pin and width whichever units
 * the device tells of now; the values it does not chart stay on a card with the group's id. The
 * groups for experts stay one, as they show in the details.
 */
export function extraCards(group: Extra): Card[] {
  const id = 'extra:' + group.id;
  const category = extraCategory(group.id);
  const charted = (item: ExtraItem) => !!item.history && item.unit !== 'text';
  const units = [...new Set(group.items.filter(charted).map((item) => item.unit))];
  if (units.length <= 1 || isDetailGroup(group.id)) {
    return [{ id, kind: 'extra', category, group, unit: units[0] }];
  }
  const rest = group.items.filter((item) => !charted(item));
  const cards: Card[] = units.map((unit) => ({
    id: unitCard(group.id, unit),
    kind: 'extra',
    category,
    group: { ...group, items: group.items.filter((item) => charted(item) && item.unit === unit) },
    unit,
    split: true,
  }));
  if (rest.length > 0) {
    return [{ id, kind: 'extra', category, group: { ...group, items: rest } }, ...cards];
  }
  // Without values of its own, the group's title and description go to its first unit's card.
  return [{ ...cards[0], split: false } as Card, ...cards.slice(1)];
}

/** The id of the chart a card draws: its own, or the one of the unit an extras card charts. */
function chartId(card: Card): string {
  return card.kind === 'extra' && card.unit ? unitCard(card.group.id, card.unit) : card.id;
}

/**
 * Whether a card draws the chart of id `chart`, or holds its values in the details. The card of a
 * group for experts takes any chart of the group; a card of extras that charts no unit takes none,
 * so the group's charts show below the cards.
 */
function ownsChart(card: Card, chart: string): boolean {
  if (card.kind === 'extra' && isDetailGroup(card.group.id)) {
    return chart.startsWith(`extra:${card.group.id}@`);
  }
  return card.kind === 'extra' && !card.unit ? false : chart === chartId(card);
}

/** Whether any disk tells how fast it is read and written. */
function hasDiskActivity(s: Snapshot): boolean {
  return s.disks.some(
    (d) => d.readBytesPerSecond !== undefined && d.writeBytesPerSecond !== undefined,
  );
}

/**
 * A card of the dashboard: one of the fixed ones, the card of a group of extras, or a value of the
 * details made into a card of its own.
 */
export type Card =
  | {
      id: string;
      kind:
        | 'cpu'
        | 'memory'
        | 'disks'
        | 'diskActivity'
        | 'network'
        | 'gpus'
        | 'temperatures'
        | 'fans'
        | 'battery'
        | 'throttling'
        | 'time'
        | 'uptime'
        | 'facts'
        | 'connection';
      category: Category;
    }
  | {
      id: string;
      kind: 'extra';
      category: Category;
      group: Extra;
      /** The unit of the values the card charts; none when it charts none. */
      unit?: ExtraUnit;
      /** Whether the card holds the values of one unit split off the group's first card. */
      split?: boolean;
    }
  | { id: string; kind: 'value'; category: Category; group: Extra; item: ExtraItem };

/** A section of the dashboard as the page draws it: the pinned cards, or a category. */
interface DashboardSection {
  category: Section;
  cards: Card[];
  /** The hidden cards, shown as chips while arranging; a category's only. */
  hidden: HiddenCard[];
  /** The groups of extras for experts, in the details table below the cards. */
  details: Extra[];
  /** How many values the details hold. */
  values: number;
  /** The charts of cards the page does not show. */
  charts: Chart[];
}

/** The message of the title of each fixed card. */
const CARD_TITLES = {
  cpu: 'dashboard.cpu',
  memory: 'dashboard.memory',
  disks: 'dashboard.disks',
  diskActivity: 'dashboard.diskActivity',
  network: 'dashboard.network',
  gpus: 'dashboard.gpu',
  temperatures: 'dashboard.temperature',
  fans: 'dashboard.fans',
  battery: 'dashboard.battery',
  throttling: 'dashboard.power',
  time: 'dashboard.time',
  uptime: 'dashboard.uptime',
  facts: 'dashboard.system',
  connection: 'dashboard.connection',
} as const satisfies Record<Exclude<Card['kind'], 'extra' | 'value'>, string>;

/** The name of the kind of value of each unit, for the card of the values of one unit. */
const UNIT_PARTS = {
  percent: 'dashboard.unit.percent',
  celsius: 'dashboard.unit.celsius',
  bytes: 'dashboard.unit.bytes',
  bytesPerSecond: 'dashboard.unit.bytesPerSecond',
  watts: 'dashboard.unit.watts',
  milliseconds: 'dashboard.unit.milliseconds',
  perSecond: 'dashboard.unit.perSecond',
  number: 'dashboard.unit.number',
} as const satisfies Record<Exclude<ExtraUnit, 'text'>, string>;

/** What the alerts of each kind are shown on, besides the strip above the cards. */
const ALERT_CARDS: Partial<Record<AlertKind, string>> = {
  cpu: 'cpu',
  memory: 'memory',
  disk: 'disks',
  temperature: 'temperatures',
  throttling: 'throttling',
  smart: 'extra:smart-checks',
  'wifi-lookalike': 'extra:wifi-networks',
};

/** The kind of the alerts shown on the card of an add-on's group, by the card's id. */
const EXTRA_ALERTS = new Map(
  Object.entries(ALERT_CARDS)
    .filter(([, card]) => card.startsWith('extra:'))
    .map(([kind, card]) => [card, kind as AlertKind]),
);

/** Why no new values arrived: the backend did not answer, or the device it collects from did not. */
type Problem = 'backend' | 'device';

/** Shows the current usage of the picked device and refreshes it every few seconds. */
@Component({
  selector: 'app-dashboard',
  imports: [
    AlertChips,
    ArrangeBar,
    ArrangeControls,
    BytesPipe,
    CardAlert,
    CardInfo,
    CardSlot,
    CdkDrag,
    CdkDropList,
    CardCharts,
    CategoryCharts,
    CategoryFold,
    CategoryRow,
    Details,
    DecimalPipe,
    DiskForecast,
    EvenColumns,
    FitLabels,
    Glance,
    HiddenCards,
    NgTemplateOutlet,
    RangePicker,
    ScrollRows,
    Timeline,
    ViewSwitch,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);
  private readonly page = inject(PageVisibility);
  /** While the hub does not answer, the banner across the page says so instead of a warning here, and the cards fade. */
  protected readonly connection = inject(HubConnection);

  protected readonly snapshot = signal<Snapshot | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly i18n = inject(I18n);
  protected readonly deviceName = computed(() => deviceName(this.devices.selected(), this.i18n));
  /** Whether the picked device is a PC or laptop, which is just not in use while it does not answer. */
  /** Whether the times a device of a kind does not answer are times it was not in use. */
  protected readonly switchedOff = switchedOff;
  protected readonly isPC = computed(() => switchedOff(this.devices.selected().kind));
  /** Whether the picked device is a router, which tells only some of what a device does. */
  protected readonly isRouter = computed(() => !!this.devices.selected().router);
  /** Whether the picked device is only checked for whether it answers, such as a printer. */
  protected readonly isChecked = computed(() => !!this.devices.selected().checked);
  /** Whether the picked device runs no Den-Watcher, so it tells only some of what a device does. */
  protected readonly readsLess = computed(() => this.isRouter() || this.isChecked());
  /** Whether the picked device is a phone, whose app cannot read the processor's usage. */
  private readonly isPhone = computed(() => this.devices.selected().kind === 'phone');
  /**
   * The message above the page while the backend or the picked device does not answer; none while
   * the banner across the page tells that the hub does not answer.
   */
  protected readonly problemNotice = computed((): { key: MessageKey; quiet?: boolean } | null => {
    switch (this.problem()) {
      case 'backend':
        return this.connection.lost() ? null : { key: 'dashboard.unreachable' };
      case 'device':
        if (this.refused()) {
          return { key: 'dashboard.deviceRefused' };
        }
        switch (this.devices.selected().pairing) {
          case 'needed':
            return { key: 'dashboard.devicePairingNeeded' };
          case 'wrong':
            return { key: 'dashboard.devicePairingWrong' };
        }
        if (this.isPC()) {
          return { key: 'dashboard.deviceNotInUse', quiet: true };
        }
        if (this.isRouter()) {
          return { key: 'dashboard.routerUnreachable' };
        }
        return {
          key: this.isChecked() ? 'dashboard.checkUnreachable' : 'dashboard.deviceUnreachable',
        };
      default:
        return null;
    }
  });
  /** The values of the picked device that need attention now, most serious first. */
  protected readonly deviceAlerts = computed(() => this.devices.selected().alerts ?? []);
  /** Whether the backend does not connect to the picked device, as its address is the hub's own. */
  protected readonly refused = computed(() => !!this.devices.selected().refused);
  /** How long the picked device did not answer since it was added; null for this device. */
  protected readonly availability = signal<Availability | null>(null);
  /**
   * The availability the page shows: none while the device is refused, whose time without an
   * answer is not counted, so the card would claim it always answered.
   */
  protected readonly shownAvailability = computed(() =>
    this.refused() ? null : this.availability(),
  );
  private readonly deviceCharts = inject(DeviceCharts);
  /** The charts drawn in the cards, by the id of the chart. */
  private readonly cardCharts = this.deviceCharts.byCard;
  private readonly history = inject(HistoryStore);
  /** The chart of each value of the details made into a card, by the card's id. */
  protected readonly valueCharts = computed(() => {
    const history = this.history.history();
    const made = this.arrangement.made();
    const charts =
      history && made.size > 0
        ? valueChartsOf(history.series, history.extras ?? {}, made, this.i18n.language())
        : [];
    return new Map(charts.map((chart) => [chart.card, [chart]]));
  });
  /** The card the SMART alerts show on: the one with the group's values, not the ones split off it. */
  protected readonly extraAlerts = EXTRA_ALERTS;
  /** Whether the values show as cards in the categories or on one timeline; the switch above them picks it. */
  protected readonly pageView = inject(PageView);
  /** The category open in the rows view; one at a time, so the page stays short. */
  protected readonly openRow = signal<Section | null>(null);
  /** The main values of each category, for the heads of the rows. */
  private readonly keys = computed(() => {
    const s = this.snapshot();
    return s
      ? rowKeys(
          s,
          this.history.history()?.series ?? [],
          readByHub(this.devices.selected()),
          this.i18n,
        )
      : {};
  });
  protected readonly kiosk = inject(KioskMode);
  /**
   * The sections of the page: the pinned cards, then the categories, or one section of every other
   * card when the cards are not grouped by category, each with its cards and then the details for
   * experts, in the order the page shows them. Each chart is drawn in its card; the
   * charts of cards the page does not show come after the cards, as a device that has not answered
   * since the page opened has no cards, but it can have charts up to its last reading.
   */
  protected readonly sections = computed(() => {
    const s = this.snapshot();
    const cards = s ? this.cards(s) : [];
    const charts = this.deviceCharts.byCategory();
    const hidden = this.arrangement.hidden();
    const arranging = this.arrangement.arranging();
    const isCard = (card: Card) => card.kind !== 'extra' || !isDetailGroup(card.group.id);
    const made = this.arrangement.made();
    // The rows view shows every card in its category, so it has no pinned cards and is always grouped.
    const rows = this.pageView.view() === 'rows' && !this.kiosk.on;
    const pinned = (rows ? [] : this.arrangement.pinned()).flatMap((id) =>
      cards.filter((card) => card.id === id && isCard(card) && !hidden.has(id)),
    );
    const pinnedIds = new Set(pinned.map((card) => card.id));
    const pinnedSection: DashboardSection = {
      category: PINNED,
      cards: pinned,
      hidden: [],
      details: [],
      values: 0,
      charts: [],
    };
    const inCategory = (category: Category) => cards.filter((card) => card.category === category);
    // Not grouped, every card that is not pinned shows in one section, in the order of the
    // categories until it is moved.
    const groups: { section: Section; cards: Card[]; arranged: Card[]; charts: Chart[] }[] =
      this.arrangement.grouped() || rows
        ? CATEGORIES.map((category) => ({
            section: category,
            cards: inCategory(category),
            arranged: this.arrangement.sort(inCategory(category).filter(isCard)),
            charts: charts.get(category) ?? [],
          }))
        : [
            {
              section: ALL,
              cards: CATEGORIES.flatMap(inCategory),
              arranged: this.arrangement.sortAcross(
                CATEGORIES.map((category) => inCategory(category).filter(isCard)),
              ),
              charts: CATEGORIES.flatMap((category) => charts.get(category) ?? []),
            },
          ];
    const categories = groups.map(
      ({ section, cards: all, arranged, charts: drawn }): DashboardSection => {
        // The values made into cards leave the details.
        const details = all.flatMap((card) => {
          if (card.kind !== 'extra' || !isDetailGroup(card.group.id)) {
            return [];
          }
          const group = card.group;
          const items = group.items.filter((item) => !made.has(valueCard(group.id, item.id)));
          return items.length > 0 ? [{ ...group, items }] : [];
        });
        // The details draw their values' history in their rows, and hidden cards draw none.
        const owned = (chart: Chart) => all.some((card) => ownsChart(card, chart.card));
        return {
          category: section,
          cards: arranged.filter((card) => !hidden.has(card.id) && !pinnedIds.has(card.id)),
          hidden: arranged
            .filter((card) => hidden.has(card.id))
            .map((card): HiddenCard => ({ id: card.id, title: this.cardTitle(card) })),
          details,
          values: details.reduce((sum, group) => sum + group.items.length, 0),
          charts: drawn.filter((chart) => !owned(chart)),
        };
      },
    );
    return [pinnedSection, ...categories].filter(
      (section) =>
        section.cards.length > 0 ||
        // Only while arranging do the hidden cards show, as chips that show them again.
        (arranging && section.hidden.length > 0) ||
        section.details.length > 0 ||
        section.charts.length > 0,
    );
  });
  protected readonly foldedCategories = inject(FoldedCategories);
  protected readonly arrangement = inject(Arrangement);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  protected readonly categoryTitles = CATEGORY_TITLES;
  protected readonly coreColumns = coreColumns;
  protected readonly hottestFirst = hottestFirst;
  protected readonly extraSections = extraSections;
  protected readonly formatDuration = formatDuration;
  protected readonly formatUptime = formatUptime;
  protected readonly usedOfTotal = usedOfTotal;
  protected readonly cpuDetail = cpuDetail;
  protected readonly loadAverageText = loadAverageText;

  constructor() {
    // Cards are arranged only where they show as cards.
    effect(() => {
      if (this.pageView.view() !== 'cards' && this.arrangement.arranging()) {
        this.arrangement.arranging.set(false);
      }
    });
    toObservable(this.devices.selectedId)
      .pipe(
        // Another device's values are not shown while the picked one's load.
        tap(() => {
          this.snapshot.set(null);
          this.problem.set(null);
        }),
        switchMap((device) =>
          this.page.poll(REFRESH_INTERVAL_MS, () =>
            this.metrics
              .current(device)
              .pipe(catchError((error: unknown) => of(problemOf(error, device)))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (typeof result === 'string') {
          this.problem.set(result);
        } else {
          this.problem.set(null);
          this.snapshot.set(result);
        }
      });

    toObservable(this.devices.selectedId)
      .pipe(
        tap(() => this.availability.set(null)),
        switchMap((device) =>
          device === LOCAL_DEVICE.id
            ? EMPTY
            : this.page.poll(AVAILABILITY_REFRESH_MS, () =>
                this.devices.availability(device).pipe(catchError(() => EMPTY)),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((availability) => this.availability.set(availability));

    // A device that does not answer has no cards, but charts up to its last reading. On a wall
    // display, without the range picker, nothing else on the page reads the history for them.
    this.history.watch.pipe(takeUntilDestroyed()).subscribe();
  }

  /** The cards the device's values fill, in the order the page shows them within a category. */
  private cards(s: Snapshot): Card[] {
    const readsLess = this.readsLess();
    const fixed = (kind: keyof typeof CARD_TITLES, category: Category, shows: unknown) =>
      shows ? [{ id: kind, kind, category }] : [];
    return [
      ...fixed('cpu', 'system', (!readsLess && !this.isPhone()) || s.cpu.cores > 0),
      ...fixed('memory', 'system', !readsLess || s.memory.totalBytes > 0),
      ...fixed('disks', 'storage', !readsLess || s.disks.length > 0),
      ...fixed('diskActivity', 'storage', hasDiskActivity(s)),
      ...fixed('network', 'network', !this.isChecked() || s.network.length > 0),
      ...fixed('connection', 'network', s.responseMilliseconds !== undefined),
      ...fixed('gpus', 'system', s.gpus?.length),
      ...fixed('temperatures', 'temperature', !readsLess || s.temperatures.length > 0),
      ...fixed('fans', 'temperature', s.fans?.length),
      ...fixed('battery', 'temperature', s.battery),
      ...fixed('throttling', 'temperature', s.throttling),
      ...(s.extras ?? []).flatMap(extraCards),
      ...this.madeCards(s.extras ?? []),
      ...fixed('time', 'device', s.timeZone),
      ...fixed('uptime', 'device', this.showsUptime(s) || this.shownAvailability()),
      ...fixed('facts', 'device', s.system),
    ];
  }

  /** The cards of the values of the details made into cards, after the cards of the extras. */
  private madeCards(extras: readonly Extra[]): Card[] {
    const made = this.arrangement.made();
    return extras
      .filter((group) => isDetailGroup(group.id))
      .flatMap((group) =>
        group.items.flatMap((item): Card[] => {
          const id = valueCard(group.id, item.id);
          return made.has(id)
            ? [{ id, kind: 'value', category: extraCategory(group.id), group, item }]
            : [];
        }),
      );
  }

  /** The title of a card, as its heading shows it. */
  protected cardTitle(card: Card): string {
    switch (card.kind) {
      case 'extra': {
        const title = this.extraText(card.group.title, card.group.titles);
        return card.split ? `${title} · ${this.unitPart(card.group, card.unit)}` : title;
      }
      case 'value':
        return `${this.extraText(card.group.title, card.group.titles)} · ${this.extraText(card.item.label, card.item.labels)}`;
      default:
        return this.i18n.t(CARD_TITLES[card.kind]);
    }
  }

  /**
   * Moves a card among the shown cards of its category, by their places in it. Moved with an arrow,
   * the focus stays on that arrow, or on the card's other one at the end of its category, as the
   * page draws the card in its new place.
   */
  protected moveCard(
    section: DashboardSection,
    from: number,
    to: number,
    arrow?: 'earlier' | 'later',
  ): void {
    const ids = section.cards.map((card) => card.id);
    if (section.category === PINNED) {
      this.arrangement.movePinned(ids, from, to);
    } else {
      this.arrangement.move(ids, from, to);
    }
    const id = ids[from];
    if (arrow) {
      this.focusAfterRender(() => {
        const controls = this.slot(id)?.querySelector('app-arrange-controls');
        return (
          controls?.querySelector<HTMLButtonElement>(`.${arrow}:not(:disabled)`) ??
          controls?.querySelector<HTMLButtonElement>(
            '.earlier:not(:disabled), .later:not(:disabled)',
          )
        );
      });
    }
  }

  /** The one chart a card draws, if any. */
  protected chartOf(card: Card): Chart | undefined {
    const charts = card.kind === 'value' ? this.valueCharts() : this.cardCharts();
    if (card.kind === 'extra' && isDetailGroup(card.group.id)) {
      return [...charts.values()].flat().find((chart) => ownsChart(card, chart.card));
    }
    return ownsChart(card, chartId(card)) ? charts.get(chartId(card))?.[0] : undefined;
  }

  /**
   * What the card of one unit of a group of extras holds, after the group's title: the label its
   * values share, such as "Temperature" for that of each disk, or else the kind of value.
   */
  private unitPart(group: Extra, unit: ExtraUnit | undefined): string {
    const labels = new Set(group.items.map((item) => this.extraLabel(item)));
    return labels.size === 1 || !unit || unit === 'text'
      ? [...labels][0]
      : this.i18n.t(UNIT_PARTS[unit]);
  }

  /** Pins a card above the categories, or unpins it; the focus stays on the button in its new place. */
  protected pinCard(id: string): void {
    this.arrangement.togglePin(id);
    this.focusAfterRender(() =>
      this.slot(id)?.querySelector<HTMLButtonElement>('app-arrange-controls .pin'),
    );
  }

  /**
   * Makes a value of the details a card of its own; the focus goes to the card's button that puts
   * it back.
   */
  protected makeCard(id: string): void {
    this.arrangement.make(id);
    this.focusAfterRender(() =>
      this.slot(id)?.querySelector<HTMLButtonElement>('app-arrange-controls .hide'),
    );
  }

  /**
   * Hides a card; the focus goes to the chip that shows it again. A value made into a card goes
   * back in its details instead, opened at its row.
   */
  protected hideCard(card: Card): void {
    const id = card.id;
    if (card.kind === 'value') {
      this.arrangement.unmake(id);
      this.focusAfterRender(() => {
        const make = [
          ...this.host.querySelectorAll<HTMLButtonElement>('app-details button.make'),
        ].find((button) => button.dataset['card'] === id);
        const details = make?.closest('details');
        if (details) {
          details.open = true;
        }
        return make;
      });
      return;
    }
    this.arrangement.hide(id);
    this.focusAfterRender(() =>
      [...this.host.querySelectorAll<HTMLButtonElement>('app-hidden-cards button')].find(
        (chip) => chip.dataset['card'] === id,
      ),
    );
  }

  private slot(id: string): HTMLElement | undefined {
    return [...this.host.querySelectorAll<HTMLElement>('.slot')].find(
      (slot) => slot.dataset['card'] === id,
    );
  }

  /** Focuses an element the page draws next, as the one that had the focus went away or moved. */
  private focusAfterRender(target: () => HTMLElement | null | undefined): void {
    afterNextRender(() => target()?.focus(), { injector: this.injector });
  }

  /** How many cards, charts and detail values a folded category holds, for its title. */
  /** Opens a row of the rows view, closing the one open before, or closes it when it is open. */
  protected toggleRow(category: Section): void {
    this.openRow.update((open) => (open === category ? null : category));
  }

  protected keysOf(category: Section): RowKey[] {
    return (this.keys() as Partial<Record<Section, RowKey[]>>)[category] ?? [];
  }

  protected sectionCount(cards: number, charts: number, values: number): string {
    return [
      cards > 0 ? this.i18n.plural(cards, 'categories.cards.one', 'categories.cards.other') : '',
      charts > 0
        ? this.i18n.plural(charts, 'categories.charts.one', 'categories.charts.other')
        : '',
      values > 0 ? this.i18n.plural(values, 'details.values.one', 'details.values.other') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /** The level of the alerts on the cards of a folded category, for the sign at its title. */
  protected categoryAlert(cards: readonly Card[]): AlertLevel | null {
    const ids = new Set(cards.map((card) => card.id));
    return worstLevel(this.deviceAlerts().filter((a) => ids.has(ALERT_CARDS[a.kind] ?? '')));
  }

  /** The level of the picked device's alerts of a kind, for the sign on its card; null for none. */
  protected alertOn(kind: AlertKind): AlertLevel | null {
    return worstLevel(this.deviceAlerts().filter((a) => a.kind === kind));
  }

  /** The level of the picked device's alerts shown on the card of an add-on's group, if any. */
  protected extraAlert(cardId: string): AlertLevel | null {
    const kind = EXTRA_ALERTS.get(cardId);
    return kind ? this.alertOn(kind) : null;
  }

  /** What the alerts of a kind are about, as the tooltip of the sign on its card. */
  protected cardAlertText(kind: AlertKind): string {
    return this.deviceAlerts()
      .filter((a) => a.kind === kind)
      .map((a) => alertText(a, this.i18n))
      .join('\n');
  }

  /** Whether the device tells its uptime: a router read over UPnP may not, a check never does. */
  protected showsUptime(s: Snapshot): boolean {
    return !this.readsLess() || s.uptimeSeconds > 0;
  }

  /**
   * The share of the time the device was watched that it answered, rounded down: its
   * availability for a server, how much of the time it was in use for a PC or laptop.
   */
  protected availablePercent(a: Availability): number {
    const seconds = Math.max(1, (Date.now() - Date.parse(a.countedSince)) / 1000);
    const percent = 100 * (1 - Math.min(a.offlineSeconds, seconds) / seconds);
    return Math.floor(percent * 100) / 100;
  }

  /** The length of an outage, from its start and end as ISO times. */
  protected outageLength(outage: { start: string; end: string }): string {
    return formatDuration((Date.parse(outage.end) - Date.parse(outage.start)) / 1000, this.i18n);
  }

  /** A date and time in the page's language, from an ISO time. */
  protected when(time: string): string {
    return formatDate(time, 'short', this.i18n.language());
  }

  /**
   * The interfaces that carried traffic since the machine started, busiest first, and how many
   * others are left out. Machines such as Windows PCs list many adapters that are never used.
   */
  protected activeInterfaces(s: Snapshot): { shown: NetworkInterface[]; idle: number } {
    const total = (n: NetworkInterface) => n.receivedBytes + n.sentBytes;
    const shown = s.network
      .filter((n) => total(n) > 0)
      .sort((a, b) => total(b) - total(a) || a.name.localeCompare(b.name));
    return { shown, idle: s.network.length - shown.length };
  }

  /** What the uptime card shows: the uptime, and how much the device answered or was in use if it tells. */
  protected uptimeInfo(a: Availability | null): string {
    const info = this.i18n.t('dashboard.info.uptime');
    return a
      ? `${info} ${this.i18n.t(switchedOff(a.kind) ? 'dashboard.info.usage' : 'dashboard.info.availability')}`
      : info;
  }

  /** A title or label of an extra in the page's language. */
  protected extraText(text: string, texts?: Record<string, string>): string {
    return localized(text, texts, this.i18n.language());
  }

  /** The label of an extra in the page's language, without its section, which shows above it. */
  protected extraLabel(item: ExtraItem): string {
    const label = this.extraText(item.label, item.labels);
    const prefix = `${item.section}: `;
    return item.section && label.startsWith(prefix) ? label.slice(prefix.length) : label;
  }

  /** The value of an extra with its unit, in the page's language. */
  protected extraValue(item: ExtraItem): string {
    return item.unit === 'text' || item.value === undefined
      ? localized(item.text ?? '', item.texts, this.i18n.language())
      : formatExtra(item.value, item.unit, this.i18n.language());
  }

  /** A number in the page's language, for text parameters (the number pipe may return null). */
  protected formatMilliseconds(ms: number): string {
    return formatExtra(ms, 'milliseconds', this.i18n.language());
  }

  protected decimal(value: number, digits: string): string {
    return formatNumber(value, this.i18n.language(), digits);
  }

  /** The addresses of an interface and the speed it is connected at, as one line. */
  protected linkDetails(n: NetworkInterface): string {
    const parts = [...(n.addresses ?? [])];
    if (n.linkMbps) {
      parts.push(
        n.linkMbps >= 1000
          ? this.i18n.t('dashboard.linkGbps', { speed: this.decimal(n.linkMbps / 1000, '1.0-1') })
          : this.i18n.t('dashboard.linkMbps', { speed: n.linkMbps }),
      );
    }
    return parts.join(' · ');
  }

  /** Describes each core's usage for screen readers, which cannot see the bars. */
  protected coresLabel(usage: number[]): string {
    const cores = usage.map((u, i) =>
      this.i18n.t('dashboard.coreUsage', { core: i + 1, usage: this.decimal(u, '1.0-0') }),
    );
    return `${this.i18n.t('dashboard.coresUsage')}: ${cores.join(', ')}`;
  }

  /** The conditions that held since the start but do not hold now. */
  protected earlierConditions(t: Throttling): ThrottlingCondition[] {
    return t.sinceBoot.filter((condition) => !t.now.includes(condition));
  }

  protected conditionList(conditions: ThrottlingCondition[]): string {
    return conditions.map((c) => throttlingText(c, this.i18n)).join(', ');
  }

  /** The time of a reading as the device's own clock shows it, in the device's time zone. */
  protected deviceTime(time: string, zone: TimeZone, format: string): string {
    return formatDate(time, format, this.i18n.language(), offsetParts(zone.offsetSeconds).join(''));
  }

  /** The zone's name with its distance from UTC, such as "CEST (UTC+2)" or "IST (UTC+5:30)". */
  protected zoneLabel(zone: TimeZone): string {
    if (zone.offsetSeconds === 0) {
      return 'UTC';
    }
    const [sign, hours, minutes] = offsetParts(zone.offsetSeconds);
    const offset = `UTC${sign}${Number(hours)}${minutes === '00' ? '' : `:${minutes}`}`;
    // Zones without a short name are named by their offset, such as "+03".
    return /^[+-]/.test(zone.name) ? offset : `${zone.name} (${offset})`;
  }

  protected readonly systemFacts = systemFacts;
}

/** The sign, hours and minutes of an offset from UTC, such as ["+", "02", "00"]. */
function offsetParts(seconds: number): [string, string, string] {
  const minutes = Math.abs(Math.round(seconds / 60));
  const pad = (n: number) => String(n).padStart(2, '0');
  return [seconds < 0 ? '-' : '+', pad(Math.floor(minutes / 60)), pad(minutes % 60)];
}

/** The backend answers 503 when a device it collects from has not answered recently. */
function problemOf(error: unknown, device: string): Problem {
  const deviceDown =
    device !== LOCAL_DEVICE.id && error instanceof HttpErrorResponse && error.status === 503;
  return deviceDown ? 'device' : 'backend';
}
