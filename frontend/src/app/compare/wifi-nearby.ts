import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { HubConnection } from '../connection/connection';
import { Device, DeviceService, deviceName } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { MetricsService, nowSeconds } from '../metrics/metrics';
import { PageVisibility } from '../page-visibility';
import {
  HomeRow,
  NetworkBox,
  WiFiHistory,
  homeNetwork,
  homeRows,
  networkRows,
  signalLevel,
  wifiBand,
  wifiChannel,
  wifiDevices,
} from './wifi';

/** The views of what the devices' Wi-Fi sees. */
export type WifiView = 'who' | 'home';

const VIEWS: { id: WifiView; label: MessageKey }[] = [
  { id: 'who', label: 'wifi.whoSeesWhat' },
  { id: 'home', label: 'wifi.homeNetwork' },
];

/** How far back the views look: a day, in hourly steps. */
const SPAN_SECONDS = 86400;

/** How often what the Wi-Fi saw is read again: the hub keeps it by hour. */
const REFRESH_MS = 5 * 60_000;

/**
 * Compares the Wi-Fi networks the devices with the Wi-Fi add-on see: which device hears which
 * network how well, and how well each one hears the network they are connected to, through which
 * of its access points. Shown only once a device has the add-on.
 */
@Component({
  selector: 'app-wifi-nearby',
  imports: [DecimalPipe],
  templateUrl: './wifi-nearby.html',
  styleUrl: './wifi-nearby.css',
})
export class WifiNearby {
  private readonly metrics = inject(MetricsService);
  private readonly page = inject(PageVisibility);
  protected readonly devices = inject(DeviceService);
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);

  protected readonly views = VIEWS;
  protected readonly view = signal<WifiView>('who');
  protected readonly signalLevel = signalLevel;
  protected readonly history = signal<WiFiHistory | null>(null);

  /** The devices whose Wi-Fi was read, in the order of the list of devices. */
  protected readonly columns = computed((): Device[] => {
    const history = this.history();
    if (!history) {
      return [];
    }
    const devices = this.devices.devices();
    const ids = wifiDevices(
      history,
      devices.map((d) => d.id),
    );
    return ids.map((id) => devices.find((d) => d.id === id)!);
  });

  protected readonly networks = computed(() => {
    const history = this.history();
    return history ? networkRows(history) : [];
  });

  protected readonly home = computed(() => {
    const history = this.history();
    return history ? homeNetwork(history) : undefined;
  });

  protected readonly homeRows = computed((): HomeRow[] => {
    const history = this.history();
    const home = this.home();
    return history && home
      ? homeRows(
          history,
          home,
          this.columns().map((d) => d.id),
        )
      : [];
  });

  constructor() {
    this.page
      .poll(REFRESH_MS, () => {
        const to = nowSeconds();
        return this.metrics.wifi(to - SPAN_SECONDS, to).pipe(catchError(() => of(null)));
      })
      .pipe(takeUntilDestroyed())
      .subscribe((history) => {
        if (history) {
          this.history.set(history);
        }
      });
  }

  protected name(id: string): string {
    const device = this.devices.devices().find((d) => d.id === id);
    return device ? deviceName(device, this.i18n) : id;
  }

  /** The channel and band of a frequency, such as "36 · 5 GHz". */
  protected channel(mhz?: number): string {
    if (!mhz) {
      return '';
    }
    const band = wifiBand(mhz);
    const parts = [wifiChannel(mhz) || undefined, band && this.band(band)];
    return parts.filter((p) => p !== undefined).join(' · ');
  }

  protected band(band: 2.4 | 5 | 6): string {
    return band === 2.4 ? this.i18n.t('wifi.band24') : `${band} GHz`;
  }

  protected bandOf(mhz?: number): string {
    const band = mhz ? wifiBand(mhz) : undefined;
    return band ? this.band(band) : '';
  }

  /** How a network is secured, with "Open" in the page's language. */
  protected security(security?: string): string {
    return security === 'Open' ? this.i18n.t('wifi.open') : (security ?? '');
  }

  /** How an access point of the home network is named: by number, and the device nearest it. */
  protected accessPointName(box?: NetworkBox): string {
    if (!box) {
      return '';
    }
    const name = this.i18n.t('wifi.accessPoint', { number: box.number });
    return box.nearest
      ? `${name} · ${this.i18n.t('wifi.near', { device: this.name(box.nearest) })}`
      : name;
  }

  /** What a step of a strip stands for, for its tooltip: how long ago, and the signal then. */
  protected stepTitle(hoursAgo: number, value: number | null | undefined): string {
    const when =
      hoursAgo === 0
        ? this.i18n.t('wifi.thisHour')
        : this.i18n.plural(hoursAgo, 'wifi.hoursAgo.one', 'wifi.hoursAgo.other');
    if (value === undefined) {
      return `${when}: ${this.i18n.t('wifi.notRead')}`;
    }
    if (value === null) {
      return `${when}: ${this.i18n.t('wifi.notInRange')}`;
    }
    return `${when}: ${Math.round(value)} %`;
  }
}
