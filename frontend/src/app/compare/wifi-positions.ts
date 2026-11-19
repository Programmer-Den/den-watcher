import { DecimalPipe, formatDate } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import { HubConnection } from '../connection/connection';
import { DeviceService, deviceName } from '../devices/devices';
import { Range } from '../history/history-store';
import { I18n } from '../i18n/i18n';
import {
  MetricsService,
  PositionNetwork,
  WiFiPosition,
  WiFiPositions,
  nowSeconds,
} from '../metrics/metrics';
import { MapFrame } from '../map/map-frame';
import { LatLon, MapViewport, Spot } from '../map/map-view';
import { MapZoom } from '../map/map-zoom';
import { PageVisibility } from '../page-visibility';
import { MAP_HEIGHT, MAP_WIDTH } from '../phone/phone-route';
import { bandText, securityText, signalLevel, wifiBand } from './wifi';

/** The ranges the places can be shown for. */
const RANGES: Range[] = [
  { label: 'history.range1d', seconds: 86400 },
  { label: 'history.range7d', seconds: 7 * 86400 },
  { label: 'history.range30d', seconds: 30 * 86400 },
];

/** How often the places are read again: the phones send their scans every few minutes. */
export const POSITIONS_REFRESH_MS = 5 * 60_000;

/** How many places the list shows until all are asked for. */
export const LIST_PLACES = 8;

/** The bands of a network's frequencies, such as "2.4 GHz · 5 GHz". */
export function bandsText(frequencies: number[] | undefined, i18n: I18n): string {
  const bands = [...new Set((frequencies ?? []).map(wifiBand))]
    .filter((b) => b !== undefined)
    .sort((a, b) => a - b);
  return bands.map((b) => bandText(b, i18n)).join(' · ');
}

/** Where the places are drawn on the map, in map units, by where `at` puts them. */
export function placesMap(places: WiFiPosition[], at: (place: LatLon) => Spot) {
  return places.length > 0 ? { points: places.map(at) } : null;
}

/**
 * Every Wi-Fi network the phones heard at each place they scanned at, all phones together: the
 * places on an OpenStreetMap map and in a list, the one with the most scans first, and for the
 * picked one its networks, the best heard first, with which phones heard each how well and when.
 */
@Component({
  selector: 'app-wifi-positions',
  imports: [DecimalPipe, MapFrame, MapZoom],
  templateUrl: './wifi-positions.html',
  styleUrl: './wifi-positions.css',
})
export class WifiPositionsView {
  private readonly metrics = inject(MetricsService);
  private readonly page = inject(PageVisibility);
  private readonly devices = inject(DeviceService);
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);

  /** The map, which opens on all places and keeps the user's zoom as they are read again. */
  protected readonly viewport = new MapViewport(MAP_WIDTH, MAP_HEIGHT);
  protected readonly ranges = RANGES;
  protected readonly range = signal(RANGES[0]);
  protected readonly signalLevel = signalLevel;

  protected readonly answer = signal<WiFiPositions | null>(null);
  protected readonly failed = signal(false);
  protected readonly failedTiles = signal<ReadonlySet<string>>(new Set());
  protected readonly showAll = signal(false);

  protected readonly places = computed(() => this.answer()?.places ?? []);
  protected readonly map = computed(() =>
    this.viewport.view() ? placesMap(this.places(), (p) => this.viewport.at(p)) : null,
  );

  /** The places the list shows. */
  protected readonly listed = computed(() =>
    this.showAll() ? this.places() : this.places().slice(0, LIST_PLACES),
  );

  /** The id of the picked place, which the hub keeps as the range changes or moves on. */
  private readonly picked = signal<number | null>(null);

  /** The index of the picked place among those read; -1 when none was picked or it is gone. */
  private readonly matched = computed(() => {
    const picked = this.picked();
    return picked === null ? -1 : this.places().findIndex((p) => p.id === picked);
  });

  /** The picked place, or the one with the most scans while none is (or the picked one is gone). */
  protected readonly selected = computed(() => {
    const matched = this.matched();
    return matched >= 0 || this.places().length === 0 ? matched : 0;
  });

  protected readonly place = computed(() => this.places()[this.selected()] ?? null);

  /** The places by index in the order they are drawn: the most scanned and the picked one on top. */
  protected readonly drawOrder = computed(() => {
    const picked = this.selected();
    const order = this.places()
      .map((_, i) => i)
      .reverse()
      .filter((i) => i !== picked);
    return picked >= 0 ? [...order, picked] : order;
  });

  protected readonly LIST_PLACES = LIST_PLACES;

  /**
   * The places the map numbers: those the list shows, the picked one and those related to it; the
   * others are small dots, so the many places along a way do not cover the map.
   */
  protected readonly numbered = computed(() => {
    const numbered = new Set(this.listed().map((_, i) => i));
    const picked = this.selected();
    numbered.add(picked);
    for (const r of this.place()?.related ?? []) {
      numbered.add(r.place);
    }
    return numbered;
  });

  /** What the user called a place, by its index, or else its number. */
  protected placeName(index: number): string {
    return this.places()[index]?.name || this.i18n.t('wifiPositions.place', { number: index + 1 });
  }

  /** The names of the phones that scanned at a place. */
  protected phones(place: WiFiPosition): string {
    return place.devices.map((id) => this.name(id)).join(', ');
  }

  protected select(index: number): void {
    const place = this.places()[index];
    if (place) {
      this.picked.set(place.id);
      // A zoomed map follows the pick, so it does not stay off the map.
      if (this.viewport.zoomed()) {
        this.viewport.centerOn(place);
      }
    }
  }

  /** A phone's name, or its id once it was removed. */
  protected name(id: string): string {
    const device = this.devices.devices().find((d) => d.id === id);
    return device ? deviceName(device, this.i18n) : id;
  }

  /** A time, with the weekday and date, in the page's language. */
  protected time(seconds: number): string {
    return formatDate(seconds * 1000, this.i18n.t('format.dateTime'), this.i18n.language());
  }

  /**
   * A network's bands, security and access points, such as "2.4 GHz · 5 GHz · WPA2/WPA3 · 2 access
   * points"; one access point is not told.
   */
  protected meta(network: PositionNetwork): string {
    const accessPoints = network.accessPoints ?? 0;
    return [
      bandsText(network.frequenciesMHz, this.i18n),
      securityText(this.i18n, network.security),
      accessPoints > 1
        ? this.i18n.plural(
            accessPoints,
            'wifiPositions.accessPoints.one',
            'wifiPositions.accessPoints.other',
          )
        : '',
    ]
      .filter((part) => part)
      .join(' · ');
  }

  protected tileFailed(href: string): void {
    this.failedTiles.update((failed) => new Set([...failed, href]));
  }

  constructor() {
    toObservable(this.range)
      .pipe(
        switchMap((range) => {
          this.answer.set(null);
          this.failed.set(false);
          this.viewport.show([], true);
          return this.page.poll(POSITIONS_REFRESH_MS, () => {
            const to = nowSeconds();
            return this.metrics.wifiPositions(to - range.seconds, to).pipe(
              catchError(() => {
                this.failed.set(true);
                return of(null);
              }),
            );
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((answer) => {
        if (answer) {
          this.failed.set(false);
          this.answer.set(answer);
          this.viewport.show(answer.places);
        }
      });
  }
}
