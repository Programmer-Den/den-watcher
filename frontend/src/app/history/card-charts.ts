import { Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CardSlot } from '../dashboard/card-slot';
import { WidthIcon } from '../dashboard/width-icon';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { ChartEvents } from './chart-events';
import { HistoryStore } from './history-store';
import { Chart } from './history';
import { LineChart } from './line-chart';

/**
 * The chart of one dashboard card, over the range picked at the top of the page, at the bottom of
 * the card, taller as the card is wider. Outside the arrange mode, a button in the card's corner
 * steps the card to 2 and 4 cards wide, as far as they fit, and back, until the page loads again;
 * where no wider card fits, as on a phone, it opens the card to show all its values instead.
 */
@Component({
  selector: 'app-card-charts',
  imports: [LineChart, WidthIcon],
  template: `
    @if (store.history(); as h) {
      @if (chart(); as chart) {
        <div class="chart">
          <app-line-chart
            [chart]="chart"
            [from]="h.from"
            [to]="h.to"
            [step]="h.stepSeconds"
            [markers]="events.markers()"
            [shared]="true"
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

  /** What the corner button does next: make the card wider or narrow, or open or close it. */
  protected buttonLabel(slot: CardSlot): MessageKey {
    if (!slot.widens()) {
      return slot.full() ? 'history.fewerValues' : 'history.allValues';
    }
    return slot.next() > 1 ? 'history.wider' : 'history.narrower';
  }

  constructor() {
    this.events.watch.pipe(takeUntilDestroyed()).subscribe();
  }
}
