import { Component, computed, input } from '@angular/core';

import { Point } from '../metrics/metrics';
import { CanvasLine, ChartCanvas } from './chart-canvas';
import { ChartUnit, chartTop, lineSegments, stepCenter } from './line-chart';

/**
 * A small chart of one value over time, without axes or labels, from `from` to `to` (Unix seconds)
 * with one point per `step` seconds; the value next to it says what it is. Its color is a place in
 * the charts' palette (`series`).
 */
@Component({
  selector: 'app-sparkline',
  imports: [ChartCanvas],
  // The area keeps the canvas inside the padding a page may give the sparkline.
  template: `<div class="area">
    <canvas [appChartCanvas]="lines()" aria-hidden="true"></canvas>
    @if (mark() !== null) {
      <div class="mark" [style.left.%]="mark()"></div>
    }
  </div>`,
  styles: `
    :host {
      display: block;
      height: 3rem;
    }

    .area {
      position: relative;
      height: 100%;
    }

    .mark {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--mat-sys-outline);
      pointer-events: none;
    }
  `,
})
export class Sparkline {
  readonly points = input.required<Point[]>();
  readonly from = input.required<number>();
  readonly to = input.required<number>();
  readonly step = input.required<number>();
  readonly unit = input.required<ChartUnit>();
  /** The top of the chart; when not set, it fits the highest value. */
  readonly max = input<number>();
  /** The color of the line, by its place in the palette. */
  readonly series = input(0);
  /** A moment to mark with a line across, such as the one the pointer is on in a chart. */
  readonly time = input<number | null>(null);

  /** Where the marked moment is, in percent of the width, or null when none is in range. */
  protected readonly mark = computed(() => {
    const time = this.time();
    if (time === null || time < this.from() || time >= this.to()) {
      return null;
    }
    return stepCenter(time, this.from(), this.to(), this.step());
  });

  protected readonly lines = computed((): CanvasLine[] => {
    const points = this.points();
    const top = chartTop([{ label: '', points }], this.unit(), this.max());
    return [
      {
        segments: lineSegments(points, this.from(), this.to(), this.step(), top),
        series: this.series(),
        dashed: false,
      },
    ];
  });
}
