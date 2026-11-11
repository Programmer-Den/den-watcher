import { DecimalPipe, formatDate, formatNumber } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import { channelText, securityText, signalLevel } from '../compare/wifi';
import { HubConnection } from '../connection/connection';
import { DeviceService } from '../devices/devices';
import { HistoryStore } from '../history/history-store';
import { I18n } from '../i18n/i18n';
import { formatDuration } from '../metrics/format';
import {
  MetricsService,
  PhoneRoute,
  PhoneScanAnswer,
  RoutePoint,
  ScannedNetwork,
  nowSeconds,
} from '../metrics/metrics';
import { PageVisibility } from '../page-visibility';

/** How often the route of a phone is read again. */
export const ROUTE_REFRESH_MS = 60_000;

/** The size of the map, in its own units, which it is drawn at and scaled from to fit the card. */
export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 360;

/** The room around the route on the map, in map units. */
const MAP_PADDING = 32;

/** The size of one tile of the map, in pixels at its zoom, as OpenStreetMap draws them. */
const TILE = 256;

/** The zoom levels the map picks from: from a country to a street. */
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;

/** Where OpenStreetMap serves its tiles: the browser loads them from there, not the hub. */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** How close points must be to count as one place the phone stayed at, in meters. */
export const STOP_METERS = 150;

/** How close two points may be drawn, in map units, before only the newer of them gets a dot. */
export const DOT_SPACING = 8;

/** How long the phone must stay at a place for it to count as a stop, in seconds. */
export const STOP_SECONDS = 10 * 60;

/** The mean radius of the earth, in meters. */
const EARTH_METERS = 6_371_000;

/** How far apart two points are, in meters, along the earth. */
export function meters(a: RoutePoint, b: RoutePoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * How far the phone went along the points, in meters: a step shorter than the points are vague is
 * left out, as the position wavers while the phone stays where it is.
 */
export function distance(points: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const step = meters(points[i - 1], points[i]);
    if (step > Math.max(points[i - 1].accuracy, points[i].accuracy)) {
      total += step;
    }
  }
  return total;
}

/** A place the phone stayed at for STOP_SECONDS or longer: where, from when to when. */
export interface Stop {
  lat: number;
  lon: number;
  start: number;
  end: number;
}

/**
 * The places the phone stayed at, oldest first: points one after the other within STOP_METERS of
 * the first of them, for STOP_SECONDS or longer, at the middle of those points.
 */
export function stops(points: RoutePoint[]): Stop[] {
  const found: Stop[] = [];
  let first = 0;
  const close = (end: number) => {
    const group = points.slice(first, end);
    if (group.length > 0 && group[group.length - 1].time - group[0].time >= STOP_SECONDS) {
      found.push({
        lat: group.reduce((sum, p) => sum + p.lat, 0) / group.length,
        lon: group.reduce((sum, p) => sum + p.lon, 0) / group.length,
        start: group[0].time,
        end: group[group.length - 1].time,
      });
    }
  };
  for (let i = 1; i < points.length; i++) {
    if (meters(points[first], points[i]) > STOP_METERS) {
      close(i);
      first = i;
    }
  }
  close(points.length);
  return found;
}

/** A place the phone stayed at, maybe several times: where, how long in all and how often. */
export interface Place {
  lat: number;
  lon: number;
  seconds: number;
  visits: number;
}

/**
 * The places of the stops, the one the phone stayed at longest first: a stop within STOP_METERS of
 * a place found before counts as another visit there.
 */
export function places(found: Stop[]): Place[] {
  const all: Place[] = [];
  for (const s of found) {
    const here = { time: 0, lat: s.lat, lon: s.lon, accuracy: 0 };
    const place = all.find((p) => meters({ ...here, lat: p.lat, lon: p.lon }, here) <= STOP_METERS);
    if (place) {
      place.seconds += s.end - s.start;
      place.visits++;
    } else {
      all.push({ lat: s.lat, lon: s.lon, seconds: s.end - s.start, visits: 1 });
    }
  }
  return all.sort((a, b) => b.seconds - a.seconds);
}

/** Where a point is on the whole map of the world at a zoom, in its pixels (Web Mercator). */
function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** One tile of the map: where it is drawn, in map units, and where it is loaded from. */
export interface MapTile {
  href: string;
  x: number;
  y: number;
}

/** The map of a route: its tiles and the route and places on them, in map units. */
export interface RouteMap {
  zoom: number;
  tiles: MapTile[];
  /** The route as an SVG path. */
  path: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  places: { x: number; y: number }[];
  /** Where each of the points is drawn, in their order. */
  points: { x: number; y: number }[];
  /**
   * The points that get a dot, by their index, oldest first: of points closer together than
   * DOT_SPACING, as while the phone stays at a place, only the newest, so the dots do not pile up.
   */
  dots: number[];
}

/**
 * The map of the points, at the closest zoom that shows all of them with MAP_PADDING around, centered
 * on them: the OpenStreetMap tiles it needs, and the route and the places drawn on them.
 */
export function routeMap(points: RoutePoint[], placesOf: Place[] = []): RouteMap | null {
  if (points.length === 0) {
    return null;
  }
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lons);
  const west = Math.min(...lons);
  let zoom = MIN_ZOOM;
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const nw = project(north, west, z);
    const se = project(south, east, z);
    if (se.x - nw.x <= MAP_WIDTH - 2 * MAP_PADDING && se.y - nw.y <= MAP_HEIGHT - 2 * MAP_PADDING) {
      zoom = z;
      break;
    }
  }
  const nw = project(north, west, zoom);
  const se = project(south, east, zoom);
  const left = (nw.x + se.x) / 2 - MAP_WIDTH / 2;
  const top = (nw.y + se.y) / 2 - MAP_HEIGHT / 2;
  const at = (lat: number, lon: number) => {
    const p = project(lat, lon, zoom);
    return { x: round(p.x - left), y: round(p.y - top) };
  };
  const count = 2 ** zoom;
  const tiles: MapTile[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + MAP_HEIGHT) / TILE); ty++) {
    if (ty < 0 || ty >= count) {
      continue;
    }
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + MAP_WIDTH) / TILE); tx++) {
      const wrapped = ((tx % count) + count) % count;
      tiles.push({
        href: TILE_URL.replace('{z}', String(zoom))
          .replace('{x}', String(wrapped))
          .replace('{y}', String(ty)),
        x: round(tx * TILE - left),
        y: round(ty * TILE - top),
      });
    }
  }
  const drawn = points.map((p) => at(p.lat, p.lon));
  const cells = new Map<string, number>();
  drawn.forEach((p, i) => {
    cells.set(`${Math.round(p.x / DOT_SPACING)} ${Math.round(p.y / DOT_SPACING)}`, i);
  });
  return {
    zoom,
    tiles,
    path: drawn.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '),
    start: drawn[0],
    end: drawn[drawn.length - 1],
    places: placesOf.map((p) => at(p.lat, p.lon)),
    points: drawn,
    dots: [...cells.values()].sort((a, b) => a - b),
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Where a phone was over the picked range, from what its app reads with the location permission:
 * the route drawn on an OpenStreetMap map, with a dot for its points, how far the phone went, and
 * the places it stayed at, the one it stayed at longest first. A click on a dot shows the Wi-Fi
 * networks the phone's scan found there.
 */
@Component({
  selector: 'app-phone-route',
  imports: [DecimalPipe],
  templateUrl: './phone-route.html',
  styleUrl: './phone-route.css',
})
export class PhoneRouteCard {
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);
  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);
  private readonly store = inject(HistoryStore);
  private readonly page = inject(PageVisibility);

  protected readonly MAP_WIDTH = MAP_WIDTH;
  protected readonly MAP_HEIGHT = MAP_HEIGHT;
  protected readonly route = signal<PhoneRoute | null>(null);

  /** The tiles that did not load, which are left out. */
  protected readonly failedTiles = signal<ReadonlySet<string>>(new Set());

  protected readonly places = computed(() => places(stops(this.route()?.points ?? [])));
  protected readonly map = computed(() => routeMap(this.route()?.points ?? [], this.places()));

  /** How far the phone went, in kilometers in the page's language. */
  protected readonly distance = computed(() =>
    formatNumber(distance(this.route()?.points ?? []) / 1000, this.i18n.language(), '1.1-1'),
  );

  protected readonly duration = (seconds: number) => formatDuration(seconds, this.i18n);

  /** The time of the point whose Wi-Fi networks are shown, kept by time as the route moves on. */
  protected readonly selectedTime = signal<number | null>(null);

  /** The index of that point among the route's points, or -1. */
  protected readonly selected = computed(() => {
    const time = this.selectedTime();
    return time === null ? -1 : (this.route()?.points.findIndex((p) => p.time === time) ?? -1);
  });

  protected readonly selectedPoint = computed(() => this.route()?.points[this.selected()] ?? null);

  /** The answer for the selected point, or null while it is read or when it could not be. */
  protected readonly scan = signal<PhoneScanAnswer | null>(null);
  protected readonly scanFailed = signal(false);

  protected readonly signalLevel = signalLevel;

  /** A network's channel, band and security, such as "36 · 5 GHz · WPA2/WPA3". */
  protected meta(network: ScannedNetwork): string {
    return [channelText(this.i18n, network.frequencyMHz), securityText(this.i18n, network.security)]
      .filter((part) => part)
      .join(' · ');
  }

  /** A time of the route, with the weekday and date, in the page's language. */
  protected time(seconds: number): string {
    return formatDate(seconds * 1000, this.i18n.t('format.dateTime'), this.i18n.language());
  }

  /** How vague a point is, such as "± 30 m". */
  protected accuracy(meters: number): string {
    return this.i18n.t('phoneRoute.accuracy', {
      meters: formatNumber(meters, this.i18n.language(), '1.0-0'),
    });
  }

  /** How far the scan was from the point: at its time, or minutes before or after it. */
  protected scanOffset(answer: PhoneScanAnswer): string {
    const minutes = Math.round(((answer.scan?.time ?? answer.time) - answer.time) / 60);
    if (minutes === 0) {
      return this.i18n.t('phoneRoute.scanAtPoint');
    }
    return this.i18n.plural(
      Math.abs(minutes),
      minutes < 0 ? 'phoneRoute.scanBefore.one' : 'phoneRoute.scanAfter.one',
      minutes < 0 ? 'phoneRoute.scanBefore.other' : 'phoneRoute.scanAfter.other',
    );
  }

  /** Shows the Wi-Fi networks of the point at index, or hides them when it is shown already. */
  protected select(index: number): void {
    const time = this.route()?.points[index]?.time ?? null;
    this.selectedTime.set(time === this.selectedTime() ? null : time);
  }

  /** Shows the point before or after the selected one, by step. */
  protected step(by: number): void {
    const points = this.route()?.points ?? [];
    const next = points[this.selected() + by];
    if (next) {
      this.selectedTime.set(next.time);
    }
  }

  /** Shows the newest point. */
  protected latest(): void {
    const points = this.route()?.points ?? [];
    this.selectedTime.set(points.at(-1)?.time ?? null);
  }

  protected tileFailed(href: string): void {
    this.failedTiles.update((failed) => new Set([...failed, href]));
  }

  constructor() {
    // The id, not the device: the list is read every few seconds, which would read the card again.
    const asked = computed(() => ({ device: this.devices.selectedId(), span: this.store.span() }));
    toObservable(asked)
      .pipe(
        switchMap(({ device, span }) => {
          this.route.set(null);
          this.selectedTime.set(null);
          return this.page.poll(ROUTE_REFRESH_MS, () => {
            const to = nowSeconds();
            return this.metrics.phoneRoute(to - span, to, device).pipe(catchError(() => of(null)));
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((route) => {
        if (route) {
          this.route.set(route);
        }
      });

    // The scan of the selected point, read again only when another point is picked.
    const point = computed(() => ({
      device: this.devices.selectedId(),
      time: this.selectedTime(),
    }));
    toObservable(point)
      .pipe(
        switchMap(({ device, time }) => {
          this.scan.set(null);
          this.scanFailed.set(false);
          if (time === null) {
            return of(null);
          }
          return this.metrics.phoneScan(time, device).pipe(
            catchError(() => {
              this.scanFailed.set(true);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((answer) => this.scan.set(answer));
  }
}
