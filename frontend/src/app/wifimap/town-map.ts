import { Component, computed, inject, input, output, signal } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { TownAccessPoint } from '../metrics/metrics';
import { MapFrame } from '../map/map-frame';
import { LatLon, MapViewport, Spot } from '../map/map-view';
import { MapZoom } from '../map/map-zoom';
import { Placed } from './town';

/** How long a degree of latitude is, in meters, near enough for a circle on the map. */
const METERS_PER_DEGREE = 111_320;

/** A point of a line as drawn: where, and its circle's radius in map units. */
type Drawn = Spot & { r: number };

/**
 * The Wi-Fi around town on an OpenStreetMap map: either the access points the hub placed, as
 * diamonds, the picked one with a circle as far around as it was heard; or a phone's way placed by
 * Wi-Fi alone, with a circle for how sure each point is, next to its GPS drawn dashed.
 */
@Component({
  selector: 'app-town-map',
  imports: [MapFrame, MapZoom],
  templateUrl: './town-map.html',
  styleUrl: './town-map.css',
})
export class TownMap {
  readonly map = input.required<MapViewport>();
  /** The access points drawn, or none while a way is. */
  readonly accessPoints = input<TownAccessPoint[]>([]);
  /** The index of the picked access point, or -1. */
  readonly selected = input(-1);
  /** A phone's way placed by Wi-Fi, and by its GPS, each as lines broken where it has a gap. */
  readonly wifi = input<Placed[][]>([]);
  readonly gps = input<Placed[][]>([]);
  /** The index of an access point the user picked on the map. */
  readonly pick = output<number>();

  protected readonly i18n = inject(I18n);
  protected readonly failedTiles = signal<ReadonlySet<string>>(new Set());

  /** Where each access point is drawn, in map units; empty while the map has no view. */
  protected readonly spots = computed(() => {
    const map = this.map();
    return map.view() ? this.accessPoints().map((a) => map.at(a)) : [];
  });

  /** The picked access point as drawn, with its circle. */
  protected readonly picked = computed(() => {
    const ap = this.accessPoints()[this.selected()];
    return ap && this.map().view() ? this.drawn(ap) : null;
  });

  protected readonly wifiLines = computed(() => this.lines(this.wifi()));
  protected readonly gpsLines = computed(() => this.lines(this.gps()));

  private lines(lines: Placed[][]): { points: Drawn[]; path: string }[] {
    if (!this.map().view()) {
      return [];
    }
    return lines.map((line) => {
      const points = line.map((p) => this.drawn(p));
      return { points, path: points.map((p) => `${p.x},${p.y}`).join(' ') };
    });
  }

  /** Where a place is drawn, with a circle of its meters around it, at least a dot. */
  private drawn(p: LatLon & { meters: number }): Drawn {
    const map = this.map();
    const at = map.at(p);
    const north = map.at({ lat: p.lat + p.meters / METERS_PER_DEGREE, lon: p.lon });
    return { ...at, r: Math.abs(at.y - north.y) };
  }

  protected tileFailed(href: string): void {
    this.failedTiles.update((failed) => new Set([...failed, href]));
  }
}
