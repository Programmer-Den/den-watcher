import { Component, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EvenColumns } from '../layout/even-columns';
import { ChartEvents } from './chart-events';
import { HistoryStore } from './history-store';
import { Chart } from './history';
import { LineChart } from './line-chart';

/**
 * Charts of one category of the dashboard that have no card to be drawn in, over the range picked
 * at the top of the page, such as the charts of a device that has not answered yet.
 */
@Component({
  selector: 'app-category-charts',
  imports: [EvenColumns, LineChart],
  template: `
    @if (store.history(); as h) {
      @if (charts().length > 0) {
        <div class="charts" appEvenColumns keepCardWidth>
          @for (chart of charts(); track $index) {
            <div class="card">
              <h3>{{ chart.title }}</h3>
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
        </div>
      }
    }
  `,
  styleUrl: './category-charts.css',
})
export class CategoryCharts {
  readonly charts = input.required<Chart[]>();

  protected readonly store = inject(HistoryStore);
  /** What happened to the device, marked on the charts. */
  protected readonly events = inject(ChartEvents);

  constructor() {
    this.store.watch.pipe(takeUntilDestroyed()).subscribe();
    this.events.watch.pipe(takeUntilDestroyed()).subscribe();
  }
}
