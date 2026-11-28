import { HttpBackend, HttpClient, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AlertService } from '../app/alerts/alerts';
import { EMPTY_LAYOUT } from '../app/dashboard/page-layout';
import { DeviceService, LOCAL_DEVICE, problemMessage } from '../app/devices/devices';
import { I18n } from '../app/i18n/i18n';
import { fileNameOf } from '../app/history/csv-download';
import { MetricsService } from '../app/metrics/metrics';
import {
  DEMO_DAILY_DAYS,
  DEMO_PAIRING_CODE,
  DEMO_RETENTION_DAYS,
  DEMO_STATUS_PAGE,
  DemoBackend,
  DEMO_ENERGY_PRICE,
  ENERGY_PRICE_STORAGE_KEY,
  LAYOUT_STORAGE_KEY,
  PLACES_STORAGE_KEY,
  csvFileName,
  historyCsv,
} from './demo-backend';
import { demoVersion } from './demo-build';
import { DEMO_GROUPS, FLEET } from './fleet';
import { DEMO_MAX_ROUTE_POINTS } from './phone-route';
import { DEMO_PHONE } from './phone-usage';
import { DEMO_PLACES, demoWifi } from './wifi';
import { DEMO_REMOVED_PHONE } from './wifi-positions';

describe('DemoBackend', () => {
  let metrics: MetricsService;
  let devices: DeviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: HttpBackend, useClass: DemoBackend }],
    });
    metrics = TestBed.inject(MetricsService);
    devices = TestBed.inject(DeviceService);
  });

  it("keeps the page's layout in the visitor's browser, as there is no host, with groups until then", async () => {
    const http = TestBed.inject(HttpClient);
    try {
      expect(await firstValueFrom(http.get('/api/layout'))).toEqual({
        ...EMPTY_LAYOUT,
        groups: DEMO_GROUPS,
      });
      const layout = { folded: ['storage'], order: ['memory'], hidden: ['cpu'] };
      await firstValueFrom(http.put('/api/layout', layout));
      expect(await firstValueFrom(http.get('/api/layout'))).toEqual(layout);
    } finally {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  });

  it('lists one of each thing that needs a look, of devices the demo has', async () => {
    const health = await firstValueFrom(devices.health());
    const kinds = health.problems.map((p) => p.kind).sort();
    expect(kinds).toEqual(['addOn', 'clock', 'pairing', 'version']);
    for (const problem of health.problems) {
      expect(FLEET.some((m) => m.device.id === problem.device)).toBe(true);
    }
    const waiting = FLEET.find((m) => m.device.pairing)!;
    expect(health.problems.find((p) => p.kind === 'pairing')?.device).toBe(waiting.device.id);
  });

  it('shows costs at a price of its own, and keeps the price a visitor enters', async () => {
    const http = TestBed.inject(HttpClient);
    try {
      expect(await firstValueFrom(http.get('/api/energy-price'))).toEqual(DEMO_ENERGY_PRICE);
      const price = { perKwh: 0.25, currency: 'CHF' };
      await firstValueFrom(http.put('/api/energy-price', price));
      expect(await firstValueFrom(http.get('/api/energy-price'))).toEqual(price);
    } finally {
      localStorage.removeItem(ENERGY_PRICE_STORAGE_KEY);
    }
  });

  it('names the office, which the phone heard in the afternoon, and keeps what a visitor names', async () => {
    try {
      expect(await firstValueFrom(metrics.wifiPlaces())).toEqual(DEMO_PLACES);
      const office = demoWifi(0, 2 * 86400).accessPoints.filter((ap) => ap.ssid === 'Office');
      expect(office.flatMap((ap) => ap.seenBy.map((s) => s.device))).toEqual([
        'android-phone',
        'android-phone',
        'android-phone',
      ]);
      const named = [{ name: 'Shed', signals: { '17e3629377a0': 76 } }];
      await firstValueFrom(metrics.saveWifiPlaces(named));
      expect(await firstValueFrom(metrics.wifiPlaces())).toEqual(named);
    } finally {
      localStorage.removeItem(PLACES_STORAGE_KEY);
    }
  });

  it("tells the phone's screen time and apps, and no other device's", async () => {
    const to = Math.floor(Date.now() / 1000);
    const usage = await firstValueFrom(metrics.phoneUsage(to - 86400, to, DEMO_PHONE));
    expect(usage.screenSeconds).toBeGreaterThan(3600);
    expect(usage.unlocks).toBeGreaterThan(10);
    expect(usage.apps[0].label).toBe('Firefox');
    expect(usage.steps.reduce((sum, s) => sum + s.screenSeconds, 0)).toBeCloseTo(
      usage.screenSeconds,
    );
    await expect(
      firstValueFrom(metrics.phoneUsage(to - 86400, to, 'local-x')),
    ).rejects.toBeTruthy();
  });

  it('tells which Wi-Fi the phone was on over the last days, and no other device', async () => {
    const to = Math.floor(Date.now() / 1000);
    const wifi = await firstValueFrom(metrics.phoneWifi(to - 7 * 86400, to, DEMO_PHONE));
    const names = new Set(wifi.connections.map((c) => c.ssid));
    expect(names).toContain('Den');
    expect(names).toContain('Office');
    for (const [i, c] of wifi.connections.entries()) {
      expect(c.end).toBeGreaterThan(c.start);
      expect(c.end).toBeGreaterThan(wifi.from);
      expect(c.start).toBeLessThan(wifi.to);
      // One after another, never two at once.
      if (i > 0) {
        expect(c.start).toBeGreaterThanOrEqual(wifi.connections[i - 1].end);
      }
    }
    await expect(firstValueFrom(metrics.phoneWifi(to - 86400, to, 'local-x'))).rejects.toBeTruthy();
  });

  it("shows the phone's route between the places its Wi-Fi was on, oldest first", async () => {
    const to = Math.floor(Date.now() / 1000);
    const route = await firstValueFrom(metrics.phoneRoute(to - 7 * 86400, to, DEMO_PHONE));
    expect(route.points.length).toBeGreaterThan(100);
    for (const [i, p] of route.points.entries()) {
      expect(p.time).toBeGreaterThanOrEqual(route.from);
      expect(p.time).toBeLessThan(route.to);
      expect(Math.abs(p.lat - 53.56)).toBeLessThan(0.05);
      if (i > 0) {
        expect(p.time).toBeGreaterThan(route.points[i - 1].time);
      }
    }
    await expect(
      firstValueFrom(metrics.phoneRoute(to - 86400, to, 'local-x')),
    ).rejects.toBeTruthy();
  });

  it('answers only the newest points of a long route, as a hub does', async () => {
    const to = Math.floor(Date.now() / 1000);
    const week = await firstValueFrom(metrics.phoneRoute(to - 7 * 86400, to, DEMO_PHONE));
    expect(week.cut).toBeFalsy();
    const year = await firstValueFrom(metrics.phoneRoute(to - 365 * 86400, to, DEMO_PHONE));
    expect(year.cut).toBe(true);
    expect(year.points.length).toBe(DEMO_MAX_ROUTE_POINTS);
    expect(year.points.at(-1)!.time).toBeGreaterThan(to - 86400);
  });

  it('tells the Wi-Fi networks heard at each place, named first, then most scans first, related by the networks', async () => {
    const to = Math.floor(Date.now() / 1000);
    const answer = await firstValueFrom(metrics.wifiPositions(to - 7 * 86400, to));
    expect(answer.places.length).toBeGreaterThan(4);
    for (const [i, p] of answer.places.entries()) {
      // At home, a phone the user removed heard some of the networks too.
      expect(p.devices).toEqual(
        p.name === 'Home' ? [DEMO_PHONE, DEMO_REMOVED_PHONE] : [DEMO_PHONE],
      );
      expect(p.networks.length).toBeGreaterThan(0);
      expect(p.first).toBeLessThanOrEqual(p.last);
      const before = answer.places[i - 1];
      if (before && !!before.name === !!p.name) {
        expect(p.scans).toBeLessThanOrEqual(before.scans);
      } else if (before) {
        expect(before.name).toBeTruthy();
      }
      for (const r of p.related ?? []) {
        expect(r.place).not.toBe(i);
        expect(r.shared).toBeGreaterThan(0);
      }
    }
    // The user named home and the office; home is scanned the most, and the phone heard its own
    // network best there.
    expect(answer.places.slice(0, 2).map((p) => p.name)).toEqual(['Home', 'Office']);
    expect(answer.places[0].networks[0].ssid).toBe('Den');
    // Home itself may share no network with another place, depending on the day's way.
    expect(answer.places.some((p) => (p.related?.length ?? 0) > 0)).toBe(true);
  });

  it('places the access points around town and the phone by them alone', async () => {
    const to = Math.floor(Date.now() / 1000);
    const town = await firstValueFrom(metrics.townWifi(to - 7 * 86400, to));
    expect(town.learned).toBeGreaterThan(100);
    expect(town.accessPoints.length).toBeGreaterThan(5);
    // The bus's network and the city's are heard all over town: left out.
    expect(town.moving).toBeGreaterThan(0);
    expect(town.accessPoints.some((a) => a.ssid === 'HVV Bus')).toBe(false);
    expect(town.accessPoints.find((a) => a.ssid === 'Den')?.connected).toBe(true);
    const [track, removed] = town.tracks;
    expect(track.device).toBe(DEMO_PHONE);
    // And the removed phone's, without its name.
    expect(removed.device).toBe(DEMO_REMOVED_PHONE);
    expect(removed.points.length).toBeGreaterThan(0);
    const placed = track.points.filter((p) => p.known > 0);
    expect(placed.length).toBeGreaterThan(track.points.length / 2);
    // Placed by Wi-Fi alone, mostly close to the GPS.
    const off = placed.map((p) => p.gps!.offMeters!).sort((a, b) => a - b);
    expect(off[Math.floor(off.length / 2)]).toBeLessThan(150);
  });

  it('keeps the names and merges of the places on the Wi-Fi map for the visit', async () => {
    const to = Math.floor(Date.now() / 1000);
    const read = () => firstValueFrom(metrics.wifiPositions(to - 7 * 86400, to));
    const before = await read();
    const [home, office, other] = before.places;
    await firstValueFrom(metrics.renamePosition(other.id, 'Gym'));
    await expect(firstValueFrom(metrics.renamePosition(home.id, 'gym'))).rejects.toBeTruthy();
    let after = await read();
    expect(after.places.find((p) => p.id === other.id)?.name).toBe('Gym');

    await firstValueFrom(metrics.mergePosition(office.id, home.id));
    after = await read();
    const merged = after.places.find((p) => p.id === home.id)!;
    expect(merged.scans).toBe(home.scans + office.scans);
    expect(merged.merged).toEqual([office.id]);
    expect(after.places.some((p) => p.id === office.id)).toBe(false);

    await firstValueFrom(metrics.mergePosition(office.id, null));
    await firstValueFrom(metrics.keepPositionsApart(home.id, other.id));
    after = await read();
    expect(after.places.find((p) => p.id === home.id)?.apart).toEqual(
      [office.id, other.id].sort((a, b) => a - b),
    );
  });

  it('tells the Wi-Fi networks the phone scanned at each point of its route, connected to one at a place', async () => {
    const to = Math.floor(Date.now() / 1000);
    const route = await firstValueFrom(metrics.phoneRoute(to - 2 * 86400, to, DEMO_PHONE));
    let connected = 0;
    for (const p of route.points.filter((_, i) => i % 10 === 0)) {
      const answer = await firstValueFrom(metrics.phoneScan(p.time, DEMO_PHONE));
      expect(answer.time).toBe(p.time);
      expect(Math.abs(answer.scan!.time - p.time)).toBeLessThanOrEqual(150);
      const networks = answer.scan!.networks;
      expect(networks.length).toBeGreaterThan(0);
      for (const [i, n] of networks.entries()) {
        expect(n.signalPercent).toBeGreaterThan(0);
        expect(n.signalPercent).toBeLessThanOrEqual(100);
        if (i > 0) {
          expect(n.signalPercent).toBeLessThanOrEqual(networks[i - 1].signalPercent);
        }
      }
      expect(networks.filter((n) => n.connected).length).toBeLessThanOrEqual(1);
      connected += networks.some((n) => n.connected) ? 1 : 0;
    }
    expect(connected).toBeGreaterThan(0);
    await expect(firstValueFrom(metrics.phoneScan(to, 'local-x'))).rejects.toBeTruthy();
  });

  it("names the demo's version for the page's footer, and no newer release", async () => {
    const http = TestBed.inject(HttpClient);
    expect(await firstValueFrom(http.get('/api/update'))).toEqual({
      current: demoVersion({}),
    });
  });

  it('shows a remote status page whose password cannot be changed', async () => {
    expect(await firstValueFrom(devices.statusPage())).toEqual(DEMO_STATUS_PAGE);
    const refused = await firstValueFrom(devices.setStatusPassword('new password', 'hub')).catch(
      (error: unknown) => error,
    );
    expect(problemMessage(refused, TestBed.inject(I18n))).toContain('demo');
  });

  it('shows the alerts of the values that need attention, and a log', async () => {
    const list = await firstValueFrom(devices.load());
    const nas = list.devices.find((d) => d.id === 'linux-nas');
    expect(nas?.alerts?.map((a) => [a.kind, a.subject, a.level])).toEqual([
      ['disk', '/srv/backup', 'alert'],
    ]);
    const log = await firstValueFrom(TestBed.inject(AlertService).log());
    expect(log.filter((a) => !a.ended).length).toBe(1);
    expect(log.filter((a) => a.ended).length).toBeGreaterThan(0);
  });

  it('keeps the id of an alert from one read to the next, so only a new one is told as new', async () => {
    const ids = async () =>
      (await firstValueFrom(devices.load())).devices
        .flatMap((d) => d.alerts ?? [])
        .map((a) => a.id);
    expect(await ids()).toEqual(await ids());
  });

  it('offers the history as a CSV file, like the backend', async () => {
    const to = Math.floor(Date.now() / 1000);
    const response = await firstValueFrom(metrics.historyCsv(to - 3600, to, 'linux-nas'));
    expect(fileNameOf(response.headers.get('Content-Disposition'))).toMatch(
      /^Linux-NAS-\d{8}T\d{6}Z-\d{8}T\d{6}Z\.csv$/,
    );
    const lines = (await response.body!.text()).split('\r\n');
    expect(lines[0]).toMatch(/^time,cpu,/);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z,\d/);
  });

  it('writes CSV cells as the backend does', () => {
    const csv = historyCsv([
      { metric: 'cpu', points: [{ time: 0, value: 1.5 }] },
      { metric: '=evil, "x"', points: [{ time: 60, value: -2 }] },
    ]);
    expect(csv).toBe(
      `time,cpu,"'=evil, ""x"""\r\n1970-01-01T00:00:00Z,1.5,\r\n1970-01-01T00:01:00Z,,-2\r\n`,
    );
    expect(csvFileName('Büro / PC', 0, 3600)).toBe('Büro-PC-19700101T000000Z-19700101T010000Z.csv');
  });

  it('tells what happened to each device: reboots, updates, alerts and times it was off', async () => {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 7 * 86400;
    const kinds = async (device: string) =>
      (await firstValueFrom(metrics.events(from, to, device))).events.map((e) => e.kind);
    expect(await kinds('linux-nas')).toEqual(expect.arrayContaining(['update', 'alert']));
    expect(await kinds('linux-laptop')).toContain('outage');
    expect(await kinds('windows-pc')).toContain('reboot');
  });

  it('lists Windows and Linux devices, one of them asleep', async () => {
    const list = await firstValueFrom(devices.load());
    expect(list.devices[0]).toEqual(LOCAL_DEVICE);
    expect(list.devices.filter((d) => d.unreachable).map((d) => d.name)).toEqual([
      'Linux laptop',
      'Garage Pi',
    ]);
    expect(FLEET.some((m) => m.os === 'windows')).toBe(true);
  });

  it('answers with values each device reports', async () => {
    for (const machine of FLEET.filter((m) => !m.online && !m.device.pairing)) {
      const s = await firstValueFrom(metrics.current(machine.device.id));
      expect(s.cpu.cores).toBe(machine.cores);
      expect(s.cpu.usagePercent).toBeGreaterThanOrEqual(0);
      expect(s.cpu.usagePercent).toBeLessThanOrEqual(100);
      expect(s.disks.map((d) => d.path)).toEqual(machine.disks.map((d) => d.path));
      // Windows, routers, checks and phones have no load average; Windows and checks no temperature sensors.
      expect(s.cpu.loadAverage === undefined).toBe(
        machine.os === 'windows' ||
          !!machine.router ||
          !!machine.checked ||
          machine.device.kind === 'phone',
      );
      expect(s.temperatures.length === 0).toBe(machine.os === 'windows' || !!machine.checked);
    }
  });

  it('shows a rooted tablet with the processor and thermal zones its app reads with root', async () => {
    const tablet = await firstValueFrom(metrics.current('rooted-tablet'));
    expect(tablet.cpu.cores).toBe(8);
    expect(tablet.cpu.coreUsagePercent).toHaveLength(8);
    expect(tablet.cpu.clockMHz).toBeGreaterThan(0);
    expect(tablet.temperatures.map((t) => t.sensor)).toEqual([
      'battery',
      'cpu-0-0-usr',
      'cpu-1-0-usr',
      'gpuss-0-usr',
      'xo-therm-adc',
    ]);
    expect(tablet.battery?.pluggedIn).toBe(true);
    // An ordinary phone's app cannot read the processor.
    expect((await firstValueFrom(metrics.current('android-phone'))).cpu.cores).toBe(0);
    const to = Math.floor(Date.now() / 1000);
    const history = await firstValueFrom(metrics.history(to - 3600, to, 'rooted-tablet'));
    expect(history.series.find((s) => s.metric === 'cpu')?.points.length).toBeGreaterThan(0);
    // It stays on its charger: its phone cards say that nothing was recorded, not that they load.
    expect(
      (await firstValueFrom(metrics.phoneUsage(to - 86400, to, 'rooted-tablet'))).apps,
    ).toEqual([]);
    expect(
      (await firstValueFrom(metrics.phoneWifi(to - 86400, to, 'rooted-tablet'))).connections,
    ).toEqual([]);
    expect(
      (await firstValueFrom(metrics.phoneRoute(to - 86400, to, 'rooted-tablet'))).points,
    ).toEqual([]);
  });

  it('shows a router with what an ASUS router tells and no disks', async () => {
    const router = FLEET.find((m) => m.router)!;
    expect(router.device.router).toBe(true);
    const s = await firstValueFrom(metrics.current(router.device.id));
    expect(s.disks).toEqual([]);
    expect(s.version).toBeUndefined();
    expect(s.network.map((n) => n.name)).toEqual(['WAN', 'LAN', 'Wi-Fi 2.4 GHz', 'Wi-Fi 5 GHz']);
    expect(s.extras?.[0].items[0].value).toBeGreaterThan(0);
  });

  it('shows a check with only how long it took to answer', async () => {
    const check = FLEET.find((m) => m.device.checked)!;
    expect(check.device.checked).toBe(true);
    const s = await firstValueFrom(metrics.current(check.device.id));
    expect(s.network).toEqual([]);
    expect(s.extras?.map((g) => g.id)).toEqual(['reachability']);
    expect(s.extras?.[0].items[0].value).toBeGreaterThan(0);
  });

  it('shows the packet loss and jitter of a check by ping', async () => {
    const camera = FLEET.find((m) => m.checked && m.device.address === '192.168.1.60')!;
    const s = await firstValueFrom(metrics.current(camera.device.id));
    const items = s.extras?.[0].items ?? [];
    expect(items.map((i) => i.id)).toEqual(['response-time', 'packet-loss', 'jitter', 'method']);
    expect([0, 20, 40]).toContain(items[1].value);
    expect(items[2].value).toBeGreaterThan(0);
    expect(s.extras?.[0].description).toContain('pings it 5 times');
  });

  it('reports the version the demo was built from, like the backend', async () => {
    // A test build sets neither a release nor a commit.
    expect((await firstValueFrom(metrics.current(LOCAL_DEVICE.id))).version).toBe('dev');
    expect(demoVersion({ release: '1.2.0', commit: 'a690bc7' })).toBe('1.2.0');
    expect(demoVersion({ commit: 'a690bc7' })).toBe('a690bc7');
  });

  it('gives every value of the add-ons a number, the processes busiest first', async () => {
    for (const machine of FLEET.filter((m) => !m.online && !m.device.pairing)) {
      const s = await firstValueFrom(metrics.current(machine.device.id));
      for (const group of s.extras ?? []) {
        const values = group.items.filter((i) => i.unit !== 'text').map((i) => i.value);
        expect(
          values.every((v) => typeof v === 'number'),
          `${machine.device.id} ${group.id}`,
        ).toBe(true);
        if (group.id.startsWith('processes-')) {
          expect(values).toEqual([...values].sort((a, b) => b! - a!));
        }
      }
    }
  });

  it('counts the time the laptop sleeps as not in use, not as outages', async () => {
    const laptop = await firstValueFrom(devices.availability('linux-laptop'));
    expect(laptop.kind).toBe('pc');
    expect(laptop.outages).toBeGreaterThan(0);
    const nas = await firstValueFrom(devices.availability('linux-nas'));
    expect(nas).toMatchObject({ kind: 'server', outages: 0 });
  });

  it('answers 503 for the device that is asleep', async () => {
    await expect(firstValueFrom(metrics.current('linux-laptop'))).rejects.toMatchObject({
      status: 503,
    });
  });

  it('ends the history of the device that is asleep at its last reading', async () => {
    const to = Math.floor(Date.now() / 1000);
    const history = await firstValueFrom(metrics.history(to - 60, to, 'linux-laptop'));
    expect(history.lastReading).toBeDefined();
    expect(history.to).toBe(history.lastReading! + 1);
    expect(history.to - history.from).toBe(60);
    expect(history.series.find((s) => s.metric === 'cpu')?.points.length).toBeGreaterThan(0);

    const live = await firstValueFrom(metrics.history(to - 60, to, 'linux-nas'));
    expect(live.lastReading).toBeUndefined();
    expect(live.to).toBe(to);
  });

  it('reads past the retention in whole days, as far as the daily averages reach', async () => {
    const to = Math.floor(Date.now() / 1000);
    const history = await firstValueFrom(metrics.history(to - 5 * 365 * 86400, to, 'linux-nas'));
    expect(history.retentionDays).toBe(DEMO_RETENTION_DAYS);
    expect(history.stepSeconds % 86400).toBe(0);
    const points = history.series.find((s) => s.metric === 'disk:/srv/data')?.points ?? [];
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThanOrEqual(360);
    expect(points[0].time).toBeGreaterThanOrEqual(to - DEMO_DAILY_DAYS * 86400 - 86400 * 6);
    expect(points[0].time).toBeLessThan(to - DEMO_RETENTION_DAYS * 86400);
  });

  it("keeps the Wi-Fi quality's history but not the signal's, with labels the hub keeps whole", async () => {
    const s = await firstValueFrom(metrics.current('windows-laptop'));
    const items = s.extras?.find((g) => g.id === 'wifi')?.items ?? [];
    // The adapter's long description is cut, so what each value is stays in its label.
    expect(items.map((i) => i.label.slice(-12))).toEqual(['link quality', 'signal (dBm)']);
    for (const item of items) {
      expect(item.label.length).toBeLessThanOrEqual(80);
      expect(item.labels?.['de']?.length).toBeLessThanOrEqual(80);
    }
    const to = Math.floor(Date.now() / 1000);
    const history = await firstValueFrom(metrics.history(to - 3600, to, 'windows-laptop'));
    const wifi = history.series.map((s) => s.metric).filter((m) => m.startsWith('extra:wifi/'));
    expect(wifi).toEqual([expect.stringMatching(/-quality$/)]);
  });

  it('refuses to add or remove devices, and says why', async () => {
    const i18n = TestBed.inject(I18n);
    i18n.language.set('en-GB');
    const refused = await firstValueFrom(
      devices.add('NAS', '192.168.1.9:9393', 'server', '', 'password'),
    ).catch((error: unknown) => error);
    expect(problemMessage(refused, i18n)).toBe(
      "This is a demo, so devices can't be added, removed or changed.",
    );
    await expect(
      firstValueFrom(devices.remove('windows-pc', 'password', false)),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('shows a device that waits for its pairing code with its availability only', async () => {
    const waiting = (await firstValueFrom(devices.load())).devices.find((d) => d.pairing);
    expect(waiting?.pairing).toBe('needed');
    const id = waiting?.id ?? '';
    await expect(firstValueFrom(metrics.current(id))).rejects.toBeTruthy();
    expect((await firstValueFrom(metrics.history(0, 3600, id))).series).toEqual([]);
    expect(await firstValueFrom(metrics.fleet())).not.toHaveProperty(id);
  });

  it('shows a pairing code of its own', async () => {
    expect(await firstValueFrom(devices.pairingCode())).toBe(DEMO_PAIRING_CODE);
  });
});
