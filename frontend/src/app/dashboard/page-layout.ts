import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, finalize, startWith, switchMap, timer } from 'rxjs';

import { PageVisibility } from '../page-visibility';

/** How the page is arranged, as GET and PUT /api/layout carry it. */
export interface Layout {
  /** The categories of cards that show only their title. */
  folded: string[];
  /** The cards by id in the order they were arranged in, each before the others of its category. */
  order: string[];
  /** The cards the page does not show, by id. */
  hidden: string[];
  /** The cards shown above the categories, by id, in their order there. */
  pinned: string[];
  /** The values of the details made into cards of their own, by the card's id. */
  made: string[];
  /** The cards set wider than one card, by id, in cards: 2 or 4. */
  widths: Record<string, number>;
  /** Whether the cards show in one section instead of grouped by their category. */
  ungrouped: boolean;
  /** The group each device is put in, such as a room, by the device's id. */
  groups: Record<string, string>;
}

/** How many entries the host keeps in each list of the layout at most. */
export const MAX_LAYOUT_ENTRIES = 200;

/** The layout of a page that has not been arranged. */
export const EMPTY_LAYOUT: Layout = {
  folded: [],
  order: [],
  hidden: [],
  pinned: [],
  made: [],
  widths: {},
  ungrouped: false,
  groups: {},
};

/** The layout as the host answered it, with an empty list for each list it does not have. */
function fromHost(answer: Partial<Layout> | null): Layout {
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  return {
    folded: list(answer?.folded),
    order: list(answer?.order),
    hidden: list(answer?.hidden),
    pinned: list(answer?.pinned),
    made: list(answer?.made),
    widths: widths(answer?.widths),
    ungrouped: answer?.ungrouped === true,
    groups: groups(answer?.groups),
  };
}

/** The groups as the host answered them, without any that are not text. */
function groups(value: unknown): Record<string, string> {
  return value && typeof value === 'object'
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};
}

/** The widths as the host answered them, without any that are not 2 or 4 cards. */
function widths(value: unknown): Record<string, number> {
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([, width]) => width === 2 || width === 4))
    : {};
}

/**
 * The layout within what the host keeps: of a list longer than that, the entries added longest ago,
 * which may be of cards that are gone, make room for the newest.
 */
export function withinLimits(layout: Layout): Layout {
  const newest = <T>(list: T[]) => list.slice(-MAX_LAYOUT_ENTRIES);
  return {
    ...layout,
    folded: newest(layout.folded),
    order: newest(layout.order),
    hidden: newest(layout.hidden),
    pinned: newest(layout.pinned),
    made: newest(layout.made),
    widths: Object.fromEntries(newest(Object.entries(layout.widths))),
    groups: Object.fromEntries(newest(Object.entries(layout.groups))),
  };
}

/** How long after the host did not answer the layout is read again while the page is shown. */
export const LAYOUT_RETRY_MS = 30_000;

type Change = (layout: Layout) => Layout;

/**
 * How the page is arranged, kept on the host so every browser that opens the page shows the same
 * arrangement. It is read again each time the page is shown, so a tab left open takes the changes
 * made in another browser before it sends its own. A change shows at once; it is sent to the host
 * over the newest layout read from it, so it never undoes a change made elsewhere.
 */
@Injectable({ providedIn: 'root' })
export class PageLayout {
  private readonly http = inject(HttpClient);
  private readonly current = signal<Layout>(EMPTY_LAYOUT);
  readonly layout = this.current.asReadonly();

  /**
   * The changes the host has not kept yet, oldest first. They are made again over each layout read
   * from the host until it keeps them.
   */
  private pending: Change[] = [];
  /** Whether the layout was read from the host since the host last failed to answer. */
  private read = false;
  /** Emits when the host did not answer, so the layout is read again after a while. */
  private readonly failed = new Subject<void>();
  private reading = false;
  private sending = false;
  /** Whether the layout changed while it was being sent, so it is sent again after. */
  private changedWhileSending = false;

  constructor() {
    // Read each time the page is shown and, while it stays shown, again a while after the host did
    // not answer, so a wall display that is never hidden still gets the layout and sends its
    // changes once the host is back.
    inject(PageVisibility)
      .visible.pipe(
        switchMap((visible) =>
          visible
            ? this.failed.pipe(
                switchMap(() => timer(LAYOUT_RETRY_MS)),
                startWith(0),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.load());
  }

  /** Changes the layout and keeps it on the host. */
  change(change: Change): void {
    this.current.update((layout) => withinLimits(change(layout)));
    this.pending.push(change);
    if (this.read && !this.reading) {
      this.send();
    }
  }

  private load(): void {
    // While a change is being sent, the page's layout is newer than the host's.
    if (this.reading || this.sending) {
      return;
    }
    this.reading = true;
    this.http
      .get<Partial<Layout> | null>('/api/layout')
      .pipe(finalize(() => (this.reading = false)))
      .subscribe({
        next: (layout) => {
          this.read = true;
          this.current.set(
            withinLimits(this.pending.reduce((l, change) => change(l), fromHost(layout))),
          );
          if (this.pending.length > 0) {
            this.send();
          }
        },
        // The changes wait for the host to answer when it is read again; until then they last for
        // this visit.
        error: () => this.failed.next(),
      });
  }

  /** Sends the layout to the host, one at a time, so an older one never lands after a newer one. */
  private send(): void {
    if (this.sending) {
      this.changedWhileSending = true;
      return;
    }
    this.sending = true;
    const sent = this.pending.length;
    this.http
      .put('/api/layout', this.current())
      .pipe(
        finalize(() => {
          this.sending = false;
          if (this.changedWhileSending) {
            this.changedWhileSending = false;
            this.send();
          }
        }),
      )
      .subscribe({
        next: () => (this.pending = this.pending.slice(sent)),
        // A change the host did not keep lasts for this visit: the layout is read again, the
        // change made over it and sent again.
        error: () => {
          this.read = false;
          this.changedWhileSending = false;
          this.failed.next();
        },
      });
  }
}
