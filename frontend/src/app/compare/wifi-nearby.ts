import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { catchError, of, retry } from 'rxjs';

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
  WiFiPlace,
  Whereabout,
  channelUse,
  homeNetwork,
  homeRows,
  lowerAsHub,
  networkBoxes,
  networkRows,
  placeSignals,
  places,
  sameSpot,
  signalLevel,
  timeline,
  whereNow,
  wifiBand,
  wifiChannel,
  wifiChanges,
  wifiDevices,
} from './wifi';

/** The views of what the devices' Wi-Fi sees. */
export type WifiView = 'who' | 'home' | 'channels' | 'where' | 'places' | 'changes';

const VIEWS: { id: WifiView; label: MessageKey }[] = [
  { id: 'who', label: 'wifi.whoSeesWhat' },
  { id: 'home', label: 'wifi.homeNetwork' },
  { id: 'channels', label: 'wifi.channels' },
  { id: 'where', label: 'wifi.where' },
  { id: 'places', label: 'wifi.places' },
  { id: 'changes', label: 'wifi.changes' },
];

/** How far back the views look: a day, in hourly steps. */
const SPAN_SECONDS = 86400;

/** Where each device is now and was over the day, for the view of places. */
interface Whereabouts {
  rows: {
    device: string;
    now: Whereabout | undefined;
    steps: (Whereabout | undefined)[];
    /** Whether it hears networks now, so the place it is at can be named. */
    hears: boolean;
  }[];
  /** The spots told apart by color, in the order of their colors (see spotKey). */
  spots: string[];
  /** The routers of the home network, by box. */
  boxes: Map<string, NetworkBox>;
}

/** How many colors the places are told apart by; more places repeat them. */
const SPOT_COLORS = 8;

/** The longest name of a place the hub keeps, in bytes of UTF-8. */
const MAX_PLACE_NAME_BYTES = 100;

/** How often what the Wi-Fi saw is read again: the hub keeps it by hour. */
const REFRESH_MS = 5 * 60_000;

/** How long after the named places could not be read they are read again. */
const PLACES_RETRY_MS = 10_000;

/**
 * Compares the Wi-Fi networks the devices with the Wi-Fi add-on see: which device hears which
 * network how well, how well each one hears the network they are connected to, through which of
 * its access points, how crowded the channels are, and which devices hear the networks alike, as
 * those are probably in one place, where each device was over the day, at the places named on
 * the page or near which router at home, and what changed, such as a copy of the home network.
 * Shown only once a device has the add-on.
 */
@Component({
  selector: 'app-wifi-nearby',
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './wifi-nearby.html',
  styleUrl: './wifi-nearby.css',
})
export class WifiNearby {
  private readonly metrics = inject(MetricsService);
  private readonly page = inject(PageVisibility);
  protected readonly devices = inject(DeviceService);
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);
  private readonly destroyRef = inject(DestroyRef);

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

  /** The places named on the page, read once the view of places is first shown. */
  protected readonly named = signal<WiFiPlace[]>([]);
  /**
   * Whether the named places have been read. Until then a place is not named or removed, as
   * saving the whole list would replace the places kept on the hub.
   */
  protected readonly placesKnown = signal(false);
  /** The device whose place is being named, and the name typed so far. */
  protected readonly naming = signal<string | null>(null);
  protected readonly placeName = signal('');
  protected readonly savingPlaces = signal(false);
  protected readonly placesFailed = signal(false);
  private placesRead = false;

  /**
   * Where each device is now and was over the day, and the spots told apart by color: the named
   * places first, then the routers of the home network.
   */
  protected readonly whereabouts = computed((): Whereabouts => {
    const history = this.history();
    const named = this.named();
    const home = this.home();
    if (!history) {
      return { rows: [], spots: [], boxes: new Map<string, NetworkBox>() };
    }
    const boxes = home ? networkBoxes(history, home) : [];
    const rows = this.columns().map((d) => ({
      device: d.id,
      now: whereNow(history, d.id, named),
      steps: timeline(history, d.id, named),
      hears: placeSignals(history, d.id) !== undefined,
    }));
    return {
      rows,
      spots: [...named.map((p) => `place:${p.name}`), ...boxes.map((b) => `box:${b.box}`)],
      boxes: new Map(boxes.map((b) => [b.box, b])),
    };
  });

  /** The spots any device was at in the day, in the order of their colors, for the legend. */
  protected readonly legend = computed((): Whereabout[] => {
    const { rows, spots } = this.whereabouts();
    const seen = new Set(
      rows.flatMap((r) => [r.now, ...r.steps]).flatMap((w) => (w ? [this.spotKey(w)] : [])),
    );
    const legend: Whereabout[] = spots
      .filter((key) => seen.has(key))
      .map((key) =>
        key.startsWith('place:') ? { place: key.slice('place:'.length) } : { box: key.slice(4) },
      );
    return seen.has('') ? [...legend, {}] : legend;
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
    effect(() => {
      if (this.view() === 'places' && !this.placesRead) {
        this.placesRead = true;
        this.metrics
          .wifiPlaces()
          .pipe(retry({ delay: PLACES_RETRY_MS }), takeUntilDestroyed(this.destroyRef))
          .subscribe((named) => {
            this.named.set(named);
            this.placesKnown.set(true);
          });
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

  /**
   * How an access point of the home network is named: as the device it is, or else by number and
   * the device nearest it.
   */
  protected accessPointName(box?: NetworkBox): string {
    if (!box) {
      return '';
    }
    if (box.router) {
      return this.name(box.router);
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

  private spotKey(w: Whereabout): string {
    if (w.place !== undefined) {
      return `place:${w.place}`;
    }
    return w.box !== undefined ? `box:${w.box}` : '';
  }

  /** The color of a spot: one of SPOT_COLORS, else "unknown" somewhere not named, or "off". */
  protected spotColor(w: Whereabout | undefined): string {
    if (!w) {
      return 'off';
    }
    const index = this.whereabouts().spots.indexOf(this.spotKey(w));
    return index < 0 ? 'unknown' : String(index % SPOT_COLORS);
  }

  /** What a spot is called: the place's name, or the router at home it was near. */
  protected spotName(w: Whereabout | undefined): string {
    if (!w) {
      return this.i18n.t('wifi.notRead');
    }
    if (w.place !== undefined) {
      return w.place;
    }
    if (w.box !== undefined) {
      const box = this.whereabouts().boxes.get(w.box);
      const room = box?.router
        ? this.name(box.router)
        : this.i18n.t('wifi.accessPoint', { number: box?.number ?? '?' });
      return this.i18n.t('wifi.atHome', { room });
    }
    return this.i18n.t('wifi.somewhereElse');
  }

  /** What a step of a device's day stands for: how long ago, and where it was. */
  protected placeTitle(hoursAgo: number, w: Whereabout | undefined): string {
    const when =
      hoursAgo === 0
        ? this.i18n.t('wifi.thisHour')
        : this.i18n.plural(hoursAgo, 'wifi.hoursAgo.one', 'wifi.hoursAgo.other');
    return `${when}: ${this.spotName(w)}`;
  }

  protected startNaming(device: string): void {
    this.placesFailed.set(false);
    this.placeName.set('');
    this.naming.set(device);
  }

  /** Whether a typed name can be kept: not empty, and not longer than the hub keeps. */
  protected nameFits(name: string): boolean {
    const trimmed = name.trim();
    return trimmed !== '' && new TextEncoder().encode(trimmed).length <= MAX_PLACE_NAME_BYTES;
  }

  /**
   * Names the place a device is at by what it hears now; a place named alike, whatever the case,
   * is learned anew there.
   */
  protected namePlace(device: string): void {
    const history = this.history();
    const name = this.placeName().trim();
    const signals = history && placeSignals(history, device);
    if (!signals || !this.nameFits(name) || !this.placesKnown()) {
      return;
    }
    const others = this.named().filter((p) => lowerAsHub(p.name) !== lowerAsHub(name));
    this.savePlaces([...others, { name, signals }], () => this.naming.set(null));
  }

  protected removePlace(name: string): void {
    if (!this.placesKnown()) {
      return;
    }
    this.savePlaces(this.named().filter((p) => p.name !== name));
  }

  private savePlaces(next: WiFiPlace[], done?: () => void): void {
    this.savingPlaces.set(true);
    this.placesFailed.set(false);
    this.metrics.saveWifiPlaces(next).subscribe({
      next: () => {
        this.savingPlaces.set(false);
        this.named.set(next);
        done?.();
      },
      error: () => {
        this.savingPlaces.set(false);
        this.placesFailed.set(true);
      },
    });
  }
}
