import { Injectable, computed, inject, signal } from '@angular/core';

import { CardWidths } from './card-widths';
import { PageLayout } from './page-layout';

/**
 * How the cards are arranged: their order within each category, which are hidden, which are pinned
 * above the categories, which values of the details are made into cards of their own and whether
 * the cards are grouped by category at all, kept on the host with the rest of the page's layout.
 * While arranging, the page shows how to move, pin, hide and make cards; otherwise it only shows
 * them as arranged.
 */
@Injectable({ providedIn: 'root' })
export class Arrangement {
  private readonly layout = inject(PageLayout);
  private readonly widths = inject(CardWidths);
  /** Whether the page is being arranged, which shows the controls to move and hide cards. */
  readonly arranging = signal(false);
  readonly hidden = computed(() => new Set(this.layout.layout().hidden));
  /** The pinned cards by id, in their order above the categories. */
  readonly pinned = computed(() => this.layout.layout().pinned);
  /** The values of the details made into cards, by the card's id. */
  readonly made = computed(() => new Set(this.layout.layout().made));
  /** Whether the cards are grouped by their category, or show in one section. */
  readonly grouped = computed(() => !this.layout.layout().ungrouped);
  /** Whether the page has been arranged at all, so Reset has something to undo. */
  readonly arranged = computed(() => {
    const { order, hidden, pinned, made, widths } = this.layout.layout();
    return (
      order.length > 0 ||
      hidden.length > 0 ||
      pinned.length > 0 ||
      made.length > 0 ||
      Object.keys(widths).length > 0
    );
  });
  private readonly position = computed(
    () => new Map(this.layout.layout().order.map((id, index) => [id, index])),
  );

  /** The cards in the order they were arranged in; the ones never moved after, as they came. */
  sort<T extends { id: string }>(cards: readonly T[]): T[] {
    const position = this.position();
    const at = (card: T) => position.get(card.id) ?? position.size;
    // The sort is stable, so the cards never moved keep their order.
    return [...cards].sort((a, b) => at(a) - at(b));
  }

  /**
   * The cards of several categories as one list, as they show when the cards are not grouped: each
   * category sorted on its own, in turn, then every arranged card in its order across them, each
   * card never moved right after the card it came after in its category.
   */
  sortAcross<T extends { id: string }>(categories: readonly (readonly T[])[]): T[] {
    const position = this.position();
    const listed = categories.flatMap((cards) => this.sort(cards));
    let before = -1;
    const at = new Map(
      listed.map((card) => {
        before = position.get(card.id) ?? before;
        return [card, position.has(card.id) ? before : before + 0.5];
      }),
    );
    // The sort is stable, so the cards never moved after the same card keep their order.
    return listed.sort((a, b) => at.get(a)! - at.get(b)!);
  }

  /**
   * Moves the card at `from` among the shown cards of a category, or of every category when the
   * cards are not grouped, by id in their order, to `to`.
   * The whole category's order is kept, so it stays as it is shown when other cards come or go.
   */
  move(ids: readonly string[], from: number, to: number): void {
    const moved = reordered(ids, from, to);
    if (!moved) {
      return;
    }
    this.layout.change((layout) => ({
      ...layout,
      order: [...layout.order.filter((id) => !moved.includes(id)), ...moved],
    }));
  }

  /**
   * Moves the pinned card at `from` among the shown pinned cards, by id in their order, to `to`. The
   * pinned cards the device does not have keep their places after them.
   */
  movePinned(ids: readonly string[], from: number, to: number): void {
    const moved = reordered(ids, from, to);
    if (!moved) {
      return;
    }
    this.layout.change((layout) => ({
      ...layout,
      pinned: [...moved, ...layout.pinned.filter((id) => !moved.includes(id))],
    }));
  }

  /** Pins a card above the categories, after the cards pinned before; unpins a pinned one. */
  togglePin(id: string): void {
    // Whether to pin is decided by what the page shows now, so the change made again over a layout
    // that already has it, as after an answer that was lost, does not undo it.
    const pin = !this.layout.layout().pinned.includes(id);
    this.layout.change((layout) => {
      const others = layout.pinned.filter((p) => p !== id);
      return { ...layout, pinned: pin ? [...others, id] : others };
    });
  }

  /** Makes a value of the details a card of its own, after the other cards of its category. */
  make(id: string): void {
    this.layout.change((layout) =>
      layout.made.includes(id) ? layout : { ...layout, made: [...layout.made, id] },
    );
  }

  /**
   * Puts a value made into a card back in the details. Its pin, its place and its width go too, so
   * made again it comes one card wide after the other cards of its category.
   */
  unmake(id: string): void {
    const drop = (ids: string[]) => ids.filter((other) => other !== id);
    this.layout.change((layout) => ({
      ...layout,
      made: drop(layout.made),
      pinned: drop(layout.pinned),
      order: drop(layout.order),
      widths: Object.fromEntries(Object.entries(layout.widths).filter(([card]) => card !== id)),
    }));
  }

  /** Groups the cards by their category, or shows them in one section. */
  group(grouped: boolean): void {
    this.layout.change((layout) => ({ ...layout, ungrouped: !grouped }));
  }

  hide(id: string): void {
    this.layout.change((layout) =>
      layout.hidden.includes(id) ? layout : { ...layout, hidden: [...layout.hidden, id] },
    );
  }

  show(id: string): void {
    this.layout.change((layout) => ({ ...layout, hidden: layout.hidden.filter((h) => h !== id) }));
  }

  /**
   * Shows every card again in its category, one card wide and in the order the page puts them in,
   * and every value in the details; folded categories stay folded, and the cards stay grouped or
   * not.
   */
  reset(): void {
    this.widths.forgetPassing();
    this.layout.change((layout) => ({
      ...layout,
      order: [],
      hidden: [],
      pinned: [],
      made: [],
      widths: {},
    }));
  }
}

/** The ids with the one at `from` moved to `to`; null when it does not move or `to` is outside. */
function reordered(ids: readonly string[], from: number, to: number): string[] | null {
  if (from === to || to < 0 || to >= ids.length) {
    return null;
  }
  const moved = [...ids];
  moved.splice(to, 0, ...moved.splice(from, 1));
  return moved;
}
