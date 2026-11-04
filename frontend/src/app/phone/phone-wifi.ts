import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import { HubConnection } from '../connection/connection';
import { DeviceService } from '../devices/devices';
import { HistoryStore } from '../history/history-store';
import { I18n } from '../i18n/i18n';
import { formatDuration } from '../metrics/format';
import { MetricsService, PhoneWifi, nowSeconds } from '../metrics/metrics';
import { PageVisibility } from '../page-visibility';

/** How often the Wi-Fi networks a phone was connected to are read again. */
export const WIFI_REFRESH_MS = 60_000;

/** How many connections the card lists until all are asked for. */
export const FIRST_CONNECTIONS = 8;

/** How many networks get a color of their own; the others share a grey one. */
export const COLORED_NETWORKS = 8;

/** One network the phone was connected to in the range: how long in all and how often. */
export interface WifiNetwork {
  ssid: string;
  seconds: number;
  connections: number;
  /** Its color, the series of the charts by how long it was used, or -1 for the grey one. */
  color: number;
}

/** One connection as a stretch of the strip along the range, in percent of it. */
export interface WifiSegment {
  ssid: string;
  start: number;
  end: number;
  left: number;
  width: number;
  color: number;
}

/**
 * The networks the phone was connected to in the range, the longest first, each with the time
 * within the range and how many connections it had there.
 */
export function wifiNetworks(wifi: PhoneWifi): WifiNetwork[] {
  const byName = new Map<string, WifiNetwork>();
  for (const c of wifi.connections) {
    const seconds = Math.max(0, Math.min(c.end, wifi.to) - Math.max(c.start, wifi.from));
    const network = byName.get(c.ssid) ?? { ssid: c.ssid, seconds: 0, connections: 0, color: -1 };
    network.seconds += seconds;
    network.connections++;
    byName.set(c.ssid, network);
  }
  return [...byName.values()]
    .sort(
      (a, b) =>
        b.seconds - a.seconds || b.connections - a.connections || (a.ssid < b.ssid ? -1 : 1),
    )
    .map((n, i) => ({ ...n, color: i < COLORED_NETWORKS ? i : -1 }));
}

/** The connections as stretches of the strip along the range, each in its network's color. */
export function wifiSegments(wifi: PhoneWifi, networks: WifiNetwork[]): WifiSegment[] {
  const length = Math.max(1, wifi.to - wifi.from);
  const colors = new Map(networks.map((n) => [n.ssid, n.color]));
  return wifi.connections.map((c) => {
    const start = Math.max(c.start, wifi.from);
    const end = Math.min(c.end, wifi.to);
    return {
      ssid: c.ssid,
      start: c.start,
      end: c.end,
      left: ((start - wifi.from) / length) * 100,
      width: (Math.max(0, end - start) / length) * 100,
      color: colors.get(c.ssid) ?? -1,
    };
  });
}

/**
 * Which Wi-Fi networks a phone was connected to over the picked range and when, from what its app
 * reads with the location permission: a strip along the range with a color for each network, the
 * time on each network, and the connections, the newest first.
 */
@Component({
  selector: 'app-phone-wifi',
  imports: [DatePipe],
  templateUrl: './phone-wifi.html',
  styleUrl: './phone-wifi.css',
})
export class PhoneWifiCard {
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);
  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);
  private readonly store = inject(HistoryStore);
  private readonly page = inject(PageVisibility);

  protected readonly FIRST_CONNECTIONS = FIRST_CONNECTIONS;
  protected readonly wifi = signal<PhoneWifi | null>(null);
  protected readonly showAll = signal(false);

  protected readonly networks = computed(() => {
    const wifi = this.wifi();
    return wifi ? wifiNetworks(wifi) : [];
  });

  protected readonly segments = computed(() => {
    const wifi = this.wifi();
    return wifi ? wifiSegments(wifi, this.networks()) : [];
  });

  /** The time on any Wi-Fi in the range. */
  protected readonly total = computed(() => this.networks().reduce((sum, n) => sum + n.seconds, 0));

  /** The longest time on one network, which the networks' bars are a share of. */
  protected readonly longest = computed(() =>
    Math.max(1, ...this.networks().map((n) => n.seconds)),
  );

  /** The connections, the newest first, as many as are shown. */
  protected readonly connections = computed(() => {
    const newest = [...this.segments()].reverse();
    return this.showAll() ? newest : newest.slice(0, FIRST_CONNECTIONS);
  });

  /** A range within a day shows the time of day, a longer one the weekday too. */
  protected readonly timeFormat = computed(() => {
    const wifi = this.wifi();
    return this.i18n.t(wifi && wifi.to - wifi.from > 86400 ? 'format.weekdayTime' : 'format.time');
  });

  protected readonly duration = (seconds: number) => formatDuration(seconds, this.i18n);

  constructor() {
    const asked = computed(() => ({ device: this.devices.selected().id, span: this.store.span() }));
    toObservable(asked)
      .pipe(
        switchMap(({ device, span }) => {
          this.wifi.set(null);
          this.showAll.set(false);
          return this.page.poll(WIFI_REFRESH_MS, () => {
            const to = nowSeconds();
            return this.metrics.phoneWifi(to - span, to, device).pipe(catchError(() => of(null)));
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((wifi) => {
        if (wifi) {
          this.wifi.set(wifi);
        }
      });
  }
}
