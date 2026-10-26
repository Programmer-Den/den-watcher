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
  BandChannels,
  HomeRow,
  NetworkBox,
  TOGETHER,
  WiFiChange,
  WiFiHistory,
  channelUse,
  homeNetwork,
  homeRows,
  networkRows,
  places,
  sameSpot,
  signalLevel,
  wifiBand,
  wifiChannel,
  wifiChanges,
  wifiDevices,
} from './wifi';

/** The views of what the devices' Wi-Fi sees. */
export type WifiView = 'who' | 'home' | 'channels' | 'where' | 'changes';

const VIEWS: { id: WifiView; label: MessageKey }[] = [
  { id: 'who', label: 'wifi.whoSeesWhat' },
  { id: 'home', label: 'wifi.homeNetwork' },
  { id: 'channels', label: 'wifi.channels' },
  { id: 'where', label: 'wifi.where' },
  { id: 'changes', label: 'wifi.changes' },
];

/** How far back the views look: a day, in hourly steps. */
const SPAN_SECONDS = 86400;

/** How often what the Wi-Fi saw is read again: the hub keeps it by hour. */
const REFRESH_MS = 5 * 60_000;

/**
 * Compares the Wi-Fi networks the devices with the Wi-Fi add-on see: which device hears which
 * network how well, how well each one hears the network they are connected to, through which of
 * its access points, how crowded the channels are, and which devices hear the networks alike, as
 * those are probably in one place, and what changed, such as a copy of the home network. Shown
 * only once a device has the add-on.
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

  protected readonly bands = computed((): BandChannels[] => {
    const history = this.history();
    return history ? channelUse(history) : [];
  });

  /** How alike the devices hear the networks, the groups probably together, and each one's day. */
  protected readonly places = computed(() => {
    const history = this.history();
    const ids = this.columns().map((d) => d.id);
    if (!history) {
      return { likeness: new Map<string, number>(), groups: [], spots: [] };
    }
    return {
      ...places(history, ids),
      spots: ids.map((device) => ({ device, steps: sameSpot(history, device) })),
    };
  });

  protected readonly changes = computed((): WiFiChange[] => {
    const history = this.history();
    return history ? wifiChanges(history) : [];
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

  /** The most routers on one channel of a band, which the bars are drawn against. */
  protected mostRouters(band: BandChannels): number {
    return Math.max(1, ...band.channels.map((c) => c.routers));
  }

  protected routers(channel: number, count: number): string {
    const routers = this.i18n.plural(count, 'wifi.routers.one', 'wifi.routers.other');
    return `${this.i18n.t('wifi.channel')} ${channel}: ${routers}`;
  }

  /** What the page suggests for the home network in a band, or nothing without a suggestion. */
  protected suggestion(band: BandChannels): string {
    const network = this.home();
    if (band.suggested === undefined || !network) {
      return '';
    }
    const params = { network, channel: band.suggested };
    return band.channels.some((c) => c.home && c.channel === band.suggested)
      ? this.i18n.t('wifi.suggestStay', params)
      : this.i18n.t('wifi.suggestMove', params);
  }

  /** How alike two devices hear the networks, in percent, whichever of them comes first. */
  protected alike(a: string, b: string): number | undefined {
    const likeness = this.places().likeness;
    return likeness.get(`${a}\n${b}`) ?? likeness.get(`${b}\n${a}`);
  }

  /** How alike is shown: as one place from TOGETHER on, and less and less so below. */
  protected alikeLevel(percent: number): string {
    if (percent >= TOGETHER) {
      return 'great';
    }
    return percent >= 60 ? 'fair' : 'poor';
  }

  /** The names of a group of devices as a list in the page's language, such as "A and B". */
  protected together(group: string[]): string {
    const list = new Intl.ListFormat(this.i18n.language(), { type: 'conjunction' });
    return this.i18n.t('wifi.together', { devices: list.format(group.map((d) => this.name(d))) });
  }

  /** What a step of a device's day stands for: how long ago, and how alike to now it heard. */
  protected spotTitle(hoursAgo: number, value: number | undefined): string {
    const when =
      hoursAgo === 0
        ? this.i18n.t('wifi.thisHour')
        : this.i18n.plural(hoursAgo, 'wifi.hoursAgo.one', 'wifi.hoursAgo.other');
    return value === undefined
      ? `${when}: ${this.i18n.t('wifi.notRead')}`
      : `${when}: ${this.i18n.t('wifi.likeNow', { percent: Math.round(value) })}`;
  }

  /** When a change happened: this hour, or how many hours ago. */
  protected changeTime(change: WiFiChange): string {
    const hoursAgo = Math.max(0, Math.floor((nowSeconds() - change.time) / 3600));
    return hoursAgo === 0
      ? this.i18n.t('wifi.thisHour')
      : this.i18n.plural(hoursAgo, 'wifi.hoursAgo.one', 'wifi.hoursAgo.other');
  }

  /** What changed, in a sentence. */
  protected changeText(change: WiFiChange): string {
    const channel = change.frequencyMHz ? wifiChannel(change.frequencyMHz) : '?';
    const params = { network: change.ssid, channel, security: change.security ?? '' };
    switch (change.kind) {
      case 'lookalike':
        return change.security === 'Open'
          ? this.i18n.t('wifi.change.lookalikeOpen', params)
          : this.i18n.t('wifi.change.lookalike', params);
      case 'newAccessPoint':
        return this.i18n.t('wifi.change.newAccessPoint', params);
      case 'channel':
        return this.i18n.t('wifi.change.channel', {
          ...params,
          band: this.bandOf(change.frequencyMHz),
          from: change.fromMHz ? wifiChannel(change.fromMHz) : '?',
        });
      case 'appeared':
        return this.i18n.t('wifi.change.appeared', params);
      case 'gone':
        return this.i18n.t('wifi.change.gone', params);
    }
  }

  /** What a change may mean, under its sentence, or nothing. */
  protected changeDetail(change: WiFiChange): string {
    switch (change.kind) {
      case 'lookalike':
        return this.i18n.t('wifi.change.lookalikeDetail', { network: change.ssid });
      case 'newAccessPoint':
        return this.i18n.t('wifi.change.newAccessPointDetail');
      case 'channel':
        return change.devices.length > 1 ? this.i18n.t('wifi.change.channelDetail') : '';
      default:
        return '';
    }
  }

  /** The devices that saw a change: all of them, or their names. */
  protected changeSeenBy(change: WiFiChange): string {
    const total = this.columns().length;
    if (total > 1 && change.devices.length === total) {
      return this.i18n.t('wifi.allDevices', { count: total });
    }
    const list = new Intl.ListFormat(this.i18n.language(), { type: 'conjunction' });
    return list.format(change.devices.map((d) => this.name(d)));
  }
}
