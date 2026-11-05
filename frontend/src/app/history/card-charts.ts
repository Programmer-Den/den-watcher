import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CardSlot } from '../dashboard/card-slot';
import { WidthIcon } from '../dashboard/width-icon';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { ChartEvents } from './chart-events';
import { HistoryStore } from './history-store';
import { Chart } from './history';
import { LineChart } from './line-chart';
import { SHORT_SPAN } from './live-history';

/**
 * The chart of one dashboard card, over the range picked at the top of the page, at the bottom of
 * the card, taller as the card is wider. Outside the arrange mode, a button in the card's corner
 * steps the card to 2 and 4 cards wide, as far as they fit, and back, until the page loads again;
 * where no wider card fits, as on a phone, it opens the card to show all its values instead. A card
 * showing all its values zooms its chart into a stretch dragged across it.
 */
@Component({
  selector: 'app-card-charts',
  imports: [DatePipe, LineChart, WidthIcon],
  template: `
    @if (store.history(); as h) {
      @if (chart(); as chart) {
        <div class="chart">
          @if (zoom(); as z) {
            <p class="zoom">
              <span
                >{{ z.from * 1000 | date: zoomFormat() : undefined : i18n.language() }} –
                {{ z.to * 1000 | date: zoomFormat() : undefined : i18n.language() }}</span
              >
              <button type="button" (click)="zoom.set(null)">
                {{ i18n.t('history.zoomBack') }}
              </button>
            </p>
          }
          <app-line-chart
            [chart]="chart"
            [from]="zoom()?.from ?? h.from"
            [to]="zoom()?.to ?? h.to"
            [step]="h.stepSeconds"
            [markers]="events.markers()"
            [shared]="true"
            [zoomable]="!!slot?.full()"
            (zoomed)="zoom.set($event)"
            (unzoomed)="zoom.set(null)"
          />
        </div>
      }
      @if (slot; as slot) {
        @if (chart() && !slot.arranging()) {
          @let label = i18n.t(buttonLabel(slot));
          <button
            type="button"
            class="widen"
            [attr.aria-pressed]="slot.full()"
            [title]="label"
            (click)="slot.toggle()"
          >
            <app-width-icon [narrower]="slot.full()" />
            <span class="visually-hidden">{{ label }}</span>
          </button>
        }
      }
    }
  `,
  styleUrl: './card-charts.css',
  host: { '[attr.data-width]': 'width()' },
})
export class CardCharts {
  /** The card's one chart, which merges the values it can or leaves the others to cards of their own. */
  readonly chart = input<Chart>();

  protected readonly store = inject(HistoryStore);
  /** What happened to the device, marked on the charts. */
  protected readonly events = inject(ChartEvents);
  protected readonly i18n = inject(I18n);
  /** The card's place in its grid, which sets how wide it is; none outside a grid of cards. */
  protected readonly slot = inject(CardSlot, { optional: true });
  /** How many cards wide the card shows, which sets how tall its chart is. */
  protected readonly width = computed(() => this.slot?.shown() ?? 1);

  /**
   * The stretch of the range a card showing all its values is zoomed into by a drag across its
   * chart; null for the whole range, and again when the card shows fewer values or the range changes.
   * It is the slot's, so the card's values follow it.
   */
  protected readonly zoom = this.slot?.zoom ?? signal<{ from: number; to: number } | null>(null);

  /** The time format of the zoomed stretch, with seconds for a short one. */
  protected readonly zoomFormat = computed(() => {
    const z = this.zoom();
    return this.i18n.t(z && z.to - z.from <= SHORT_SPAN ? 'format.timeSeconds' : 'format.time');
  });

  /** What the corner button does next: make the card wider or narrow, or open or close it. */
  protected buttonLabel(slot: CardSlot): MessageKey {
    if (!slot.widens()) {
      return slot.full() ? 'history.fewerValues' : 'history.allValues';
    }
    return slot.next() > 1 ? 'history.wider' : 'history.narrower';
  }

  constructor() {
    // The zoom is let go when the card shows fewer values, or another range is picked.
    let span: number | undefined;
    effect(() => {
      const picked = this.store.span();
      if (!this.slot?.full() || (span !== undefined && span !== picked)) {
        this.zoom.set(null);
      }
      span = picked;
    });
    this.events.watch.pipe(takeUntilDestroyed()).subscribe();
  }
}
