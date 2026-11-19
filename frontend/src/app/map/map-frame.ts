import { formatNumber } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { MapViewport, ZOOM_STEP, scaleBar } from './map-view';

/** The longest the scale bar is drawn, in map units. */
const SCALE_UNITS = 96;

/**
 * A map that zooms, drawn by the SVG put inside, with its controls over it: zoom in and out, back to
 * the whole, a scale bar and, a moment after a scroll without Ctrl, how to zoom.
 */
@Component({
  selector: 'app-map-frame',
  templateUrl: './map-frame.html',
  styleUrl: './map-frame.css',
})
export class MapFrame {
  readonly map = input.required<MapViewport>();
  protected readonly i18n = inject(I18n);
  protected readonly ZOOM_STEP = ZOOM_STEP;

  /** The scale bar: its length as a share of the map's width, and the distance it stands for. */
  protected readonly scale = computed(() => {
    const map = this.map();
    const view = map.view();
    if (!view) {
      return null;
    }
    const bar = scaleBar(view, SCALE_UNITS);
    const language = this.i18n.language();
    return {
      percent: (bar.length / map.width) * 100,
      text:
        bar.meters >= 1000
          ? this.i18n.t('map.km', { km: formatNumber(bar.meters / 1000, language, '1.0-0') })
          : this.i18n.t('map.m', { m: formatNumber(bar.meters, language, '1.0-0') }),
    };
  });
}
