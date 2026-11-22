import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import { HubConnection } from '../connection/connection';
import { Range } from '../history/history-store';
import { I18n } from '../i18n/i18n';
import { MetricsService, WiFiPosition, WiFiPositions, nowSeconds } from '../metrics/metrics';
import { MapViewport } from '../map/map-view';
import { PageVisibility } from '../page-visibility';
import { signalLevel } from '../compare/wifi';
import { NetworkDetail } from './network-detail';
import { MapNetwork, mapNetworks, networkMatches } from './networks';
import { PlaceDetail } from './place-detail';
import { TownWifi } from './town-wifi';
import { matches, placeLabel } from './places';
import { MAP_HEIGHT, MAP_WIDTH, PlacesMap } from './places-map';

/** The ranges the places can be shown for. */
const RANGES: Range[] = [
  { label: 'history.range1d', seconds: 86400 },
  { label: 'history.range7d', seconds: 7 * 86400 },
  { label: 'history.range30d', seconds: 30 * 86400 },
];

/** How often the places are read again: the phones send their scans every few minutes. */
export const POSITIONS_REFRESH_MS = 5 * 60_000;

/** How many of the places without a name the list shows until all are asked for. */
export const LIST_PLACES = 12;

/** A place in the list: its index among the places read, and what it is called. */
interface Listed {
  index: number;
  place: WiFiPosition;
  label: string;
}

/**
 * The Wi-Fi map of all phones: the places they scanned the Wi-Fi networks at, on a map the user
 * can zoom and in a list, the named ones first, and for the picked one every network heard there.
 * The user names places and merges the ones that are the same, which the hub keeps.
 */
@Component({
  selector: 'app-wifi-map',
  imports: [NetworkDetail, NgTemplateOutlet, PlaceDetail, PlacesMap, TownWifi],
  templateUrl: './wifi-map.html',
  styleUrl: './wifi-map.css',
})
export class WifiMap {
  private readonly metrics = inject(MetricsService);
  private readonly page = inject(PageVisibility);
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);

  /** The map, which opens on all places and keeps the user's zoom as they are read again. */
  protected readonly viewport = new MapViewport(MAP_WIDTH, MAP_HEIGHT);
  protected readonly ranges = RANGES;
  protected readonly range = signal(RANGES[1]);
  protected readonly search = signal('');
  protected readonly showAll = signal(false);

  protected readonly answer = signal<WiFiPositions | null>(null);
  protected readonly failed = signal(false);

  protected readonly places = computed(() => this.answer()?.places ?? []);
  protected readonly labels = computed(() => this.places().map((p) => placeLabel(p, this.i18n)));

  /** The id of the picked place, which the hub keeps as the range changes or moves on. */
  private readonly picked = signal<number | null>(null);

  /** The picked place, or the first one while none is (or the picked one is gone). */
  protected readonly selected = computed(() => {
    const picked = this.picked();
    const index = picked === null ? -1 : this.places().findIndex((p) => p.id === picked);
    return index >= 0 || this.places().length === 0 ? index : 0;
  });

  /** The places the search finds, the named and the others apart. */
  private readonly found = computed(() => {
    const labels = this.labels();
    return this.places()
      .map((place, index): Listed => ({ index, place, label: labels[index] }))
      .filter((l) => matches(l.place, l.label, this.search()));
  });
  protected readonly named = computed(() => this.found().filter((l) => l.place.name));
  protected readonly others = computed(() => this.found().filter((l) => !l.place.name));
  protected readonly listedOthers = computed(() =>
    this.showAll() ? this.others() : this.others().slice(0, LIST_PLACES),
  );
  protected readonly LIST_PLACES = LIST_PLACES;

  /**
   * Whether the list shows the places, the networks heard at them, or the access points placed
   * around town and the phones' ways placed by them.
   */
  protected readonly tab = signal<'places' | 'networks' | 'town'>('places');

  /** Every network heard at the places, the user's own first. */
  protected readonly networks = computed(() => mapNetworks(this.places()));
  protected readonly foundNetworks = computed(() =>
    this.networks().filter((n) => networkMatches(n, this.search())),
  );
  protected readonly listedNetworks = computed(() =>
    this.showAll() ? this.foundNetworks() : this.foundNetworks().slice(0, LIST_PLACES),
  );

  /** The key of the picked network, which stays picked as the places are read again. */
  private readonly pickedNetwork = signal<string | null>(null);

  /** The picked network, or the first one while none is (or the picked one is gone). */
  protected readonly network = computed((): MapNetwork | undefined => {
    const key = this.pickedNetwork();
    const networks = this.networks();
    return networks.find((n) => n.key === key) ?? networks[0];
  });

  /** How well the picked network was heard at each place, on the networks tab. */
  protected readonly levels = computed(() => {
    const network = this.network();
    if (this.tab() !== 'networks' || !network) {
      return null;
    }
    const levels = this.places().map(() => null as ReturnType<typeof signalLevel> | null);
    for (const s of network.at) {
      levels[s.place] = signalLevel(s.signalPercent);
    }
    return levels;
  });

  /** The place drawn as picked: on the networks tab, where the picked network was heard best. */
  protected readonly mapSelected = computed(() =>
    this.tab() === 'networks' ? (this.network()?.at[0]?.place ?? -1) : this.selected(),
  );

  protected showTab(tab: 'places' | 'networks' | 'town'): void {
    this.tab.set(tab);
    this.showAll.set(false);
  }

  protected selectNetwork(network: MapNetwork): void {
    this.pickedNetwork.set(network.key);
    // The map shows where it reaches.
    this.viewport.focus(network.at.map((s) => this.places()[s.place]));
  }

  /** Picks a place, from the map or a network's places, and shows it on the places tab. */
  protected showPlace(index: number): void {
    this.showTab('places');
    this.select(index);
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

  /** The best known networks of a place, by name, for the list: such as "Den, Den-Guest". */
  protected networkNames(place: WiFiPosition): string {
    return place.networks
      .flatMap((n) => (n.ssid ? [n.ssid] : []))
      .slice(0, 2)
      .join(', ');
  }

  /** Reads the places again at once, after the user changed one. */
  protected reload(): void {
    const to = nowSeconds();
    this.metrics.wifiPositions(to - this.range().seconds, to).subscribe({
      next: (answer) => this.show(answer),
      error: () => this.failed.set(true),
    });
  }

  private show(answer: WiFiPositions): void {
    this.failed.set(false);
    this.answer.set(answer);
    this.viewport.show(answer.places);
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
          this.show(answer);
        }
      });
  }
}
