import { Component, computed, inject, input, output, signal } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { WiFiPosition } from '../metrics/metrics';
import { MapFrame } from '../map/map-frame';
import { MapViewport } from '../map/map-view';
import { MapZoom } from '../map/map-zoom';
import { Cluster, clusters } from './places';

/** The size of the map, in its units, which it is drawn at and scaled from to fit the page. */
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 520;

/** How many zoom levels a click on a numbered circle zooms in, so its places come apart. */
const CLUSTER_ZOOM = 2;

/**
 * The places on an OpenStreetMap map: the named ones with their names, the others as circles, the
 * places close together on the screen as one numbered circle until the map is zoomed in, and lines
 * from the picked one to the places that heard some of the same access points.
 */
@Component({
  selector: 'app-places-map',
  imports: [MapFrame, MapZoom],
  templateUrl: './places-map.html',
  styleUrl: './places-map.css',
})
export class PlacesMap {
  readonly map = input.required<MapViewport>();
  readonly places = input.required<WiFiPosition[]>();
  readonly labels = input.required<string[]>();
  /** The index of the picked place, or -1. */
  readonly selected = input.required<number>();
  /** The index of a place the user picked on the map. */
  readonly pick = output<number>();

  protected readonly i18n = inject(I18n);
  protected readonly failedTiles = signal<ReadonlySet<string>>(new Set());

  /** Where each place is drawn, in map units; empty while the map has no view. */
  protected readonly spots = computed(() => {
    const map = this.map();
    return map.view() ? this.places().map((p) => map.at(p)) : [];
  });

  /**
   * What the map draws, in the order it is drawn, the last on top: the numbered circles and the
   * other places, then the named ones, then the picked one.
   */
  protected readonly drawn = computed(() => {
    const places = this.places();
    const picked = this.selected();
    const alone = new Set(places.flatMap((p, i) => (p.name || i === picked ? [i] : [])));
    // The places with the most scans first, which the numbered circles are drawn at.
    const order = places.map((_, i) => i);
    return clusters(this.spots(), order, alone).sort(
      (a, b) => this.layer(a, alone, picked) - this.layer(b, alone, picked),
    );
  });

  private layer(c: Cluster, alone: ReadonlySet<number>, picked: number): number {
    const first = c.places[0];
    return first === picked ? 2 : alone.has(first) ? 1 : 0;
  }

  /** A click on a numbered circle zooms in on it; on a place, picks it. */
  protected open(c: Cluster): void {
    const map = this.map();
    if (c.places.length > 1 && map.canZoomIn()) {
      map.zoom(CLUSTER_ZOOM, c);
    } else {
      this.pick.emit(c.places[0]);
    }
  }

  protected tileFailed(href: string): void {
    this.failedTiles.update((failed) => new Set([...failed, href]));
  }
}
