import { Component, inject, input } from '@angular/core';

import { AlertLevel } from '../alerts/alert';
import { AlertIcon } from '../alerts/alert-icon';
import { ChartUnit } from '../history/line-chart';
import { I18n } from '../i18n/i18n';
import { Point } from '../metrics/metrics';

/** One tile of the glance row: a main value now and its history. */
export interface Tile {
  id: 'cpu' | 'memory' | 'disk' | 'temperature' | 'network';
  label: string;
  value: string;
  unit: string;
  /** Beside the label, such as the number of cores or the disk's path. */
  detail: string;
  /** Under the value, such as the load or how much of the disk is used. */
  sub: string;
  /** Whether the value is from the moment the pointer is on in a chart, which `sub` tells. */
  at?: boolean;
  alert: AlertLevel | null;
  /** The value over the range the charts show; empty while it loads. */
  points: Point[];
  chartUnit: ChartUnit;
  max?: number;
  /** The color of its chart. */
  series: number;
}

/**
 * One of the main values of a device in large type, with what it is, a detail beside that, a line
 * under it and a small chart of it (put inside) at its foot, from edge to edge. A tile with an alert gets its sign
 * and a border in its color.
 */
@Component({
  selector: 'app-glance-tile',
  imports: [AlertIcon],
  template: `
    <h3>
      {{ tile().label }}
      @if (tile().alert; as level) {
        <app-alert-icon [level]="level" role="img" [attr.aria-label]="i18n.t('alerts.onCard')" />
      }
      @if (tile().detail) {
        <span class="detail">{{ tile().detail }}</span>
      }
    </h3>
    <p class="value">
      {{ tile().value }}<span class="unit">{{ tile().unit }}</span>
    </p>
    @if (tile().sub) {
      <p class="sub" [class.at]="tile().at">{{ tile().sub }}</p>
    }
    <div class="chart"><ng-content /></div>
  `,
  styleUrl: './glance-tile.css',
  host: { '[class]': 'tile().alert' },
})
export class GlanceTile {
  protected readonly i18n = inject(I18n);

  readonly tile = input.required<Tile>();
}
