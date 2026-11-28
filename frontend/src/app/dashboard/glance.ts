import { formatDate, formatNumber } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AlertKind, AlertLevel } from '../alerts/alert';
import { worstLevel } from '../alerts/alerts';
import { Device, DeviceService, readByHub } from '../devices/devices';
import { ChartPointer } from '../history/chart-pointer';
import { HistoryStore } from '../history/history-store';
import { isWan, linesOf, pointsOf, sum } from '../history/history';
import { Sparkline } from '../history/sparkline';
import { I18n } from '../i18n/i18n';
import { formatBytes } from '../metrics/bytes.pipe';
import { cpuDetail, loadAverageText, usedOfTotal } from '../metrics/format';
import { Snapshot } from '../metrics/metrics';
import { GlanceTile, Tile, TileId } from './glance-tile';

/**
 * The main values of the device in a row of large tiles above its cards, each with a small chart of
 * the range the charts show: at most six, picked and ordered for its kind (TILE_ORDER), so a PC
 * shows its GPU, a phone its battery and Wi-Fi, a router its internet traffic and devices online,
 * and the hub's Raspberry Pi its power. A device that does not report a value, such as a router
 * read without a login, has no tile for it.
 * A router passes each byte it forwards through two interfaces, so its network tile adds up only
 * its internet connection (WAN), and it has none where it does not tell which interface that is.
 */
@Component({
  selector: 'app-glance',
  imports: [GlanceTile, Sparkline],
  template: `
    @let h = store.history();
    @for (tile of tiles(); track tile.id) {
      <app-glance-tile [tile]="tile">
        @if (h) {
          <app-sparkline
            [points]="tile.points"
            [from]="h.from"
            [to]="h.to"
            [step]="h.stepSeconds"
            [unit]="tile.chartUnit"
            [max]="tile.max"
            [series]="tile.series"
            [time]="pointer.time()"
          />
        }
      </app-glance-tile>
    }
  `,
  styles: `
    :host([hidden]) {
      display: none;
    }

    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
  `,
  host: { '[hidden]': 'tiles().length === 0' },
})
export class Glance {
  readonly snapshot = input.required<Snapshot>();

  protected readonly store = inject(HistoryStore);
  /** The moment the pointer is on in a chart, whose values the tiles show instead of now. */
  protected readonly pointer = inject(ChartPointer);
  private readonly devices = inject(DeviceService);
  private readonly i18n = inject(I18n);

  /** Whether the hub reads the device; kept apart, as the list of devices is read every 5 s. */
  private readonly router = computed(() => readByHub(this.devices.selected()));

  /** Which tiles the device shows; kept apart for the same reason. */
  private readonly kind = computed(() => glanceKind(this.devices.selected()));

  /** Whether the network tile counts an interface: on a router only its WAN interfaces. */
  private readonly counted = computed(() => {
    const router = this.router();
    return (name: string) => !router || isWan(name);
  });

  /**
   * The network tile's chart, added up only when the history changes, not with each new snapshot,
   * so its sparkline is not drawn again every few seconds.
   */
  private readonly networkPoints = computed(() => {
    const counted = this.counted();
    const lines = linesOf(this.store.history()?.series ?? [], 'network.receive');
    return sum(lines.filter((line) => counted(line.label)));
  });

  /**
   * The tiles now, or while the pointer is on a moment in a chart, at that moment: each value from
   * its chart, and under it the time instead of its line. A tile without a value then keeps now's.
   */
  protected readonly tiles = computed((): Tile[] => {
    const tiles = this.now();
    const time = this.pointer.time();
    const h = this.store.history();
    if (time === null || !h || time < h.from || time >= h.to) {
      return tiles;
    }
    const language = this.i18n.language();
    const format = this.i18n.t(h.stepSeconds < 60 ? 'format.timeSeconds' : 'format.time');
    const sub = this.i18n.t('dashboard.atTime', {
      time: formatDate(time * 1000, format, language),
    });
    return tiles.map((tile) => {
      const value = tile.points.find((p) => p.time === time)?.value;
      if (value === undefined) {
        return tile;
      }
      if (tile.id === 'network') {
        const [received, unit] = splitUnit(formatBytes(value, language));
        return { ...tile, value: `↓ ${received}`, unit: `${unit}/s`, sub, at: true };
      }
      return { ...tile, value: formatNumber(value, language, '1.0-1'), sub, at: true };
    });
  });

  /** The tiles with the values now. */
  private readonly now = computed((): Tile[] => {
    const s = this.snapshot();
    const series = this.store.history()?.series ?? [];
    const t = this.i18n.t.bind(this.i18n);
    const language = this.i18n.language();
    const number = (value: number, digits = '1.0-1') => formatNumber(value, language, digits);
    const bytes = (value: number) => formatBytes(value, language);
    const tiles: Tile[] = [];

    if (s.cpu.cores > 0) {
      tiles.push({
        id: 'cpu',
        label: t('dashboard.cpu'),
        value: number(s.cpu.usagePercent),
        unit: '%',
        detail: cpuDetail(s.cpu, this.i18n),
        sub: s.cpu.loadAverage ? loadAverageText(s.cpu.loadAverage, this.i18n) : '',
        alert: this.alertOn('cpu'),
        points: pointsOf(series, 'cpu'),
        chartUnit: 'percent',
        max: 100,
        series: 0,
      });
    }
    if (s.memory.totalBytes > 0) {
      tiles.push({
        id: 'memory',
        label: t('dashboard.memory'),
        value: number(s.memory.usedPercent),
        unit: '%',
        detail: s.memory.swap
          ? `${t('dashboard.swap')} ${number(s.memory.swap.usedPercent)} %`
          : '',
        sub: usedOfTotal(s.memory.usedBytes, s.memory.totalBytes, this.i18n),
        alert: this.alertOn('memory'),
        points: pointsOf(series, 'memory'),
        chartUnit: 'percent',
        max: 100,
        series: 1,
      });
    }
    const disk = [...s.disks].sort((a, b) => b.usedPercent - a.usedPercent)[0];
    if (disk) {
      tiles.push({
        id: 'disk',
        label: t('compare.disk'),
        value: number(disk.usedPercent),
        unit: '%',
        detail: disk.path,
        sub: usedOfTotal(disk.usedBytes, disk.totalBytes, this.i18n),
        alert: this.alertOn('disk', disk.path),
        points: pointsOf(series, `disk:${disk.path}`),
        chartUnit: 'percent',
        max: 100,
        series: 2,
      });
    }
    const hottest = [...s.temperatures].sort((a, b) => b.celsius - a.celsius)[0];
    if (hottest) {
      const fan = s.fans?.[0];
      tiles.push({
        id: 'temperature',
        label: t('dashboard.temperature'),
        value: number(hottest.celsius),
        unit: '°C',
        detail: hottest.sensor,
        sub: fan ? `${fan.name} · ${t('dashboard.rpm', { rpm: number(fan.rpm, '1.0-0') })}` : '',
        alert: this.alertOn('temperature', hottest.sensor),
        points: pointsOf(series, `temperature:${hottest.sensor}`),
        chartUnit: 'celsius',
        series: 3,
      });
    }
    const counted = this.counted();
    const network = s.network.filter((n) => counted(n.name));
    if (network.length > 0) {
      const [received, unit] = splitUnit(
        bytes(network.reduce((total, n) => total + n.receiveBytesPerSecond, 0)),
      );
      const sent = bytes(network.reduce((total, n) => total + n.sendBytesPerSecond, 0));
      tiles.push({
        id: 'network',
        label: t(this.router() ? 'glance.internet' : 'dashboard.network'),
        value: `↓ ${received}`,
        unit: `${unit}/s`,
        detail: network.length === 1 ? network[0].name : '',
        sub: `↑ ${sent}/s`,
        alert: null,
        points: this.networkPoints(),
        chartUnit: 'bytesPerSecond',
        series: 6,
      });
    }
    const gpu = s.gpus?.[0];
    if (gpu) {
      const memory =
        gpu.memoryTotalBytes && gpu.memoryUsedBytes !== undefined
          ? t('dashboard.gpuMemory', {
              used: bytes(gpu.memoryUsedBytes),
              total: bytes(gpu.memoryTotalBytes),
            })
          : '';
      tiles.push({
        id: 'gpu',
        label: t('dashboard.gpu'),
        value: number(gpu.usagePercent),
        unit: '%',
        detail: gpu.name,
        sub: [gpu.celsius !== undefined ? `${number(gpu.celsius, '1.0-0')} °C` : '', memory]
          .filter(Boolean)
          .join(' · '),
        alert: null,
        points: pointsOf(series, `gpu:${gpu.name}`),
        chartUnit: 'percent',
        max: 100,
        series: 4,
      });
    }
    if (s.battery) {
      tiles.push({
        id: 'battery',
        label: t('dashboard.battery'),
        value: number(s.battery.percent, '1.0-0'),
        unit: '%',
        detail: '',
        sub: t(s.battery.pluggedIn ? 'dashboard.pluggedIn' : 'dashboard.onBattery'),
        alert: null,
        points: pointsOf(series, 'battery'),
        chartUnit: 'percent',
        max: 100,
        series: 5,
      });
    }
    const extra = (group: string, item: string) =>
      s.extras?.find((e) => e.id === group)?.items.find((i) => i.id === item);
    // The power add-on's first value is the whole machine where it tells several parts.
    const power = s.extras?.find((e) => e.id === 'power')?.items[0];
    if (power?.value !== undefined) {
      tiles.push({
        id: 'power',
        label: t('glance.power'),
        value: number(power.value),
        unit: 'W',
        detail: '',
        sub: '',
        alert: null,
        points: pointsOf(series, `extra:power/${power.id}`),
        chartUnit: 'watts',
        series: 7,
      });
    }
    const clients = extra('clients', 'online');
    if (clients?.value !== undefined) {
      tiles.push({
        id: 'clients',
        label: t('glance.clients'),
        value: number(clients.value, '1.0-0'),
        unit: '',
        detail: '',
        sub: '',
        alert: null,
        points: pointsOf(series, 'extra:clients/online'),
        chartUnit: 'number',
        series: 5,
      });
    }
    const wifi = extra('wifi', 'wifi-quality');
    if (wifi?.value !== undefined) {
      const signal = extra('wifi', 'wifi-signal')?.value;
      tiles.push({
        id: 'wifi',
        label: t('glance.wifi'),
        value: number(wifi.value, '1.0-0'),
        unit: '%',
        detail: '',
        sub: signal !== undefined ? `${number(signal, '1.0-0')} dBm` : '',
        alert: null,
        points: pointsOf(series, 'extra:wifi/wifi-quality'),
        chartUnit: 'percent',
        max: 100,
        series: 0,
      });
    }
    const order = TILE_ORDER[this.kind()];
    return order.flatMap((id) => tiles.filter((tile) => tile.id === id)).slice(0, MAX_TILES);
  });

  constructor() {
    this.store.watch.pipe(takeUntilDestroyed()).subscribe();
  }

  /** The worst alert of a kind, and for a tile that shows one disk or sensor only its own. */
  private alertOn(kind: AlertKind, subject?: string): AlertLevel | null {
    const alerts = this.devices.selected().alerts ?? [];
    return worstLevel(
      alerts.filter((a) => a.kind === kind && (subject === undefined || a.subject === subject)),
    );
  }
}

/** The most tiles the row shows, so it stays one row on a wide screen. */
export const MAX_TILES = 6;

/** The kinds of device whose tiles are picked and ordered alike. */
export type GlanceKind = 'server' | 'pc' | 'phone' | 'router';

/** The tiles each kind of device shows, most important first; the ones it does not report are left out. */
export const TILE_ORDER: Record<GlanceKind, readonly TileId[]> = {
  server: ['cpu', 'memory', 'disk', 'temperature', 'network', 'power', 'gpu', 'battery'],
  pc: ['cpu', 'gpu', 'memory', 'disk', 'network', 'battery', 'temperature', 'power'],
  // Only a rooted hub app reads a phone's processor; its CPU then goes before the network.
  phone: ['battery', 'wifi', 'cpu', 'memory', 'disk', 'temperature', 'network'],
  router: ['network', 'clients', 'cpu', 'memory', 'temperature'],
};

/** Which order of tiles a device takes. */
export function glanceKind(device: Device): GlanceKind {
  if (readByHub(device)) {
    return 'router';
  }
  if (device.kind === 'phone') {
    return 'phone';
  }
  return device.kind === 'pc' ? 'pc' : 'server';
}

/** A formatted amount split into its number and its unit, such as "1.5 KiB" into "1.5" and "KiB". */
function splitUnit(text: string): [string, string] {
  const space = text.lastIndexOf(' ');
  return [text.slice(0, space), text.slice(space + 1)];
}
