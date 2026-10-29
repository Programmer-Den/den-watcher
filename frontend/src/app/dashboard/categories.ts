import { Injectable, computed, inject } from '@angular/core';

import { PageLayout } from './page-layout';

/** What the cards of the dashboard are grouped by, in the order the page shows them. */
export const CATEGORIES = [
  'system',
  'storage',
  'network',
  'temperature',
  'programs',
  'other',
  'device',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** The section of the pinned cards, above the categories. */
export const PINNED = 'pinned';

/** The section of every card that is not pinned, when the cards are not grouped by category. */
export const ALL = 'all';

/** A section of the page: the pinned cards, a category, or every other card. */
export type Section = typeof PINNED | Category | typeof ALL;

/** The sections of the page, in the order it shows them. */
export const SECTIONS: readonly Section[] = [PINNED, ...CATEGORIES, ALL];

/** Where the cards of the extras the page knows go; the others go to `other`. */
const EXTRA_CATEGORIES: Record<string, Category> = {
  gpu: 'system',
  pressure: 'system',
  memory: 'system',
  'memory-committed': 'system',
  'memory-writeback': 'system',
  'memory-faults': 'system',
  'memory-disk': 'system',
  kernel: 'system',
  'kernel-processes': 'system',
  'kernel-in-use': 'system',
  'kernel-tcp': 'system',
  inodes: 'storage',
  smart: 'storage',
  'smart-checks': 'storage',
  wifi: 'network',
  'wifi-networks': 'network',
  bluetooth: 'network',
  ports: 'network',
  clients: 'network',
  connected: 'network',
  internet: 'network',
  reachability: 'network',
  power: 'temperature',
  'processes-cpu': 'programs',
  'processes-memory': 'programs',
  'containers-cpu': 'programs',
  'containers-memory': 'programs',
  'den-watcher': 'programs',
};

/**
 * The extras groups for experts, such as the kernel's counters: they show as rows of their
 * category's details table instead of as cards, so the cards stay few.
 */
const DETAIL_GROUPS: ReadonlySet<string> = new Set([
  'pressure',
  'memory',
  'memory-committed',
  'memory-writeback',
  'memory-faults',
  'memory-disk',
  'kernel',
  'kernel-processes',
  'kernel-in-use',
  'kernel-tcp',
  'inodes',
]);

/** Whether the extras group `id` shows in its category's details table instead of as a card. */
export function isDetailGroup(id: string): boolean {
  return DETAIL_GROUPS.has(id);
}

/** The id of the card a value of the details is made into, such as "value:kernel/forks". */
export function valueCard(group: string, item: string): string {
  return `value:${group}/${item}`;
}

/**
 * The id of the chart of the values of one unit of the extras group `group`, such as
 * "extra:smart@celsius", which the group's card of that unit draws.
 */
export function unitCard(group: string, unit: string): string {
  return `extra:${group}@${unit}`;
}

/** The category of the card of the extras group `id`. */
export function extraCategory(id: string): Category {
  return Object.hasOwn(EXTRA_CATEGORIES, id) ? EXTRA_CATEGORIES[id] : 'other';
}

/** The items by category, in the order of CATEGORIES, each in the order given; empty ones left out. */
export function byCategory<T>(
  items: readonly T[],
  category: (item: T) => Category,
): { category: Category; items: T[] }[] {
  return CATEGORIES.map((c) => ({
    category: c,
    items: items.filter((i) => category(i) === c),
  })).filter((group) => group.items.length > 0);
}

/** Which sections of cards are folded, so only their title shows; kept on the host. */
@Injectable({ providedIn: 'root' })
export class FoldedCategories {
  private readonly layout = inject(PageLayout);
  readonly folded = computed<ReadonlySet<Section>>(
    () =>
      new Set(
        this.layout.layout().folded.filter((c): c is Section => SECTIONS.includes(c as Section)),
      ),
  );

  /** Folds the section, or unfolds it when it is folded. */
  toggle(category: Section): void {
    // Whether to fold is decided by what the page shows now, so the change made again over a layout
    // that already has it, as after an answer that was lost, does not undo it.
    const fold = !this.layout.layout().folded.includes(category);
    this.layout.change((layout) => {
      const others = layout.folded.filter((c) => c !== category);
      return { ...layout, folded: fold ? [...others, category] : others };
    });
  }
}
