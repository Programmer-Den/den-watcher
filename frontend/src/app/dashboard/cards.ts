import { Extra, ExtraItem, ExtraUnit } from '../metrics/extras';
import { Snapshot, Temperature } from '../metrics/metrics';
import { Category, extraCategory, isDetailGroup, unitCard } from './categories';

/**
 * The cards of the dashboard and what they hold: which cards a group of extras makes, the order of
 * their values, and which chart each card draws.
 */

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

/** The group of extras of the power add-on, whose values the energy price turns into costs. */
export const POWER_GROUP = 'power';

/** The groups of extras whose values are shown largest first, such as what each part draws. */
const LARGEST_FIRST = new Set([POWER_GROUP]);

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
export function chartId(card: Card): string {
  return card.kind === 'extra' && card.unit ? unitCard(card.group.id, card.unit) : card.id;
}

/**
 * Whether a card draws the chart of id `chart`, or holds its values in the details. The card of a
 * group for experts takes any chart of the group; a card of extras that charts no unit takes none,
 * so the group's charts show below the cards.
 */
export function ownsChart(card: Card, chart: string): boolean {
  if (card.kind === 'extra' && isDetailGroup(card.group.id)) {
    return chart.startsWith(`extra:${card.group.id}@`);
  }
  return card.kind === 'extra' && !card.unit ? false : chart === chartId(card);
}

/** Whether any disk tells how fast it is read and written. */
export function hasDiskActivity(s: Snapshot): boolean {
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
