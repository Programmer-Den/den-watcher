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
  DEMO_PAIRING_CODE,
  DEMO_RETENTION_DAYS,
  DEMO_STATUS_PAGE,
  DemoBackend,
  LAYOUT_STORAGE_KEY,
  PLACES_STORAGE_KEY,
  csvFileName,
  historyCsv,
} from './demo-backend';
import { demoVersion } from './demo-build';
import { FLEET } from './fleet';
import { DEMO_PLACES, demoWifi } from './wifi';

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

  it("keeps the page's layout in the visitor's browser, as there is no host", async () => {
    const http = TestBed.inject(HttpClient);
    try {
      expect(await firstValueFrom(http.get('/api/layout'))).toEqual(EMPTY_LAYOUT);
      const layout = { folded: ['storage'], order: ['memory'], hidden: ['cpu'] };
      await firstValueFrom(http.put('/api/layout', layout));
      expect(await firstValueFrom(http.get('/api/layout'))).toEqual(layout);
    } finally {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
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
      // Windows, routers and checks have no load average; Windows and checks no temperature sensors.
      expect(s.cpu.loadAverage === undefined).toBe(
        machine.os === 'windows' || !!machine.router || !!machine.checked,
      );
      expect(s.temperatures.length === 0).toBe(machine.os === 'windows' || !!machine.checked);
    }
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

  it('keeps the history within the retention and in at most 360 steps', async () => {
    const to = Math.floor(Date.now() / 1000);
    const history = await firstValueFrom(metrics.history(to - 365 * 86400, to, 'linux-nas'));
    expect(history.retentionDays).toBe(DEMO_RETENTION_DAYS);
    const points = history.series.find((s) => s.metric === 'disk:/srv/data')?.points ?? [];
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThanOrEqual(360);
    expect(points[0].time).toBeGreaterThanOrEqual(to - DEMO_RETENTION_DAYS * 86400);
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
