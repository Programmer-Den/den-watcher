import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { History, Snapshot } from '../metrics/metrics';
import { summarize } from '../metrics/summary';
import { Compare, Row, largest, sortRows, within } from './compare';

const snapshot: Snapshot = {
  time: '2026-10-02T17:00:00Z',
  uptimeSeconds: 3 * 86400 + 4 * 3600,
  cpu: { usagePercent: 12.5, cores: 4 },
  memory: { totalBytes: 8 * 1024 ** 3, usedBytes: 2 * 1024 ** 3, usedPercent: 25 },
  temperatures: [
    { sensor: 'cpu_thermal', celsius: 48.3 },
    { sensor: 'nvme', celsius: 52.1 },
  ],
  disks: [
    { path: '/', totalBytes: 64 * 1024 ** 3, usedBytes: 16 * 1024 ** 3, usedPercent: 25 },
    { path: '/srv', totalBytes: 64 * 1024 ** 3, usedBytes: 60 * 1024 ** 3, usedPercent: 93.8 },
  ],
  network: [
    {
      name: 'eth0',
      receivedBytes: 0,
      sentBytes: 0,
      receiveBytesPerSecond: 1000,
      sendBytesPerSecond: 200,
    },
    {
      name: 'wlan0',
      receivedBytes: 0,
      sentBytes: 0,
      receiveBytesPerSecond: 24,
      sendBytesPerSecond: 0,
    },
  ],
};

/** What a router read over UPnP reports: only its network. */
const router: Snapshot = {
  ...snapshot,
  uptimeSeconds: 0,
  cpu: { usagePercent: 0, cores: 0 },
  memory: { totalBytes: 0, usedBytes: 0, usedPercent: 0 },
  temperatures: [],
  disks: [],
  network: [{ ...snapshot.network[0], name: 'WAN', receiveBytesPerSecond: 1024 }],
};

describe('summarize', () => {
  it('takes the fullest disk, the hottest sensor and the traffic of all network cards', () => {
    expect(summarize(snapshot)).toEqual({
      cpu: 12.5,
      memory: 25,
      disk: { path: '/srv', percent: 93.8 },
      temperature: { sensor: 'nvme', celsius: 52.1 },
      network: { receive: 1024, send: 200 },
      uptimeSeconds: 3 * 86400 + 4 * 3600,
    });
  });

  it('leaves out what a router does not report', () => {
    expect(summarize(router)).toEqual({
      cpu: undefined,
      memory: undefined,
      disk: undefined,
      temperature: undefined,
      network: { receive: 1024, send: 200 },
      uptimeSeconds: undefined,
    });
  });

  it('counts only the WAN interfaces of a device the hub reads, as its own page does', () => {
    const wan = {
      ...snapshot.network[0],
      name: 'WAN',
      receiveBytesPerSecond: 500,
      sendBytesPerSecond: 50,
    };
    const lan = {
      ...snapshot.network[0],
      name: 'LAN',
      receiveBytesPerSecond: 60,
      sendBytesPerSecond: 480,
    };
    const asus: Snapshot = { ...router, network: [wan, lan] };
    expect(summarize(asus, true).network).toEqual({ receive: 500, send: 50 });
    expect(summarize(asus).network).toEqual({ receive: 560, send: 530 });
    expect(summarize({ ...router, network: [lan] }, true).network).toBeUndefined();
  });
});

describe('sortRows', () => {
  const row = (id: string, cpu?: number, alerts = 0): Row => ({
    device: {
      id,
      name: id,
      alerts: Array.from({ length: alerts }, (_, i) => ({
        id: i,
        device: id,
        deviceName: id,
        kind: 'disk' as const,
        level: 'warning' as const,
        started: '2026-10-02T17:00:00Z',
      })),
    },
    summary: cpu === undefined ? null : { cpu },
  });
  const ids = (rows: Row[]) => rows.map((r) => r.device.id);

  it('sorts largest first, with the devices without a value last', () => {
    const rows = [row('a', 10), row('b'), row('c', 80), row('d', 10)];
    expect(ids(sortRows(rows, 'cpu'))).toEqual(['c', 'a', 'd', 'b']);
    expect(ids(sortRows(rows, null))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts by the alerts, the most first', () => {
    expect(ids(sortRows([row('a', 1), row('b', 1, 2), row('c', 1, 1)], 'alerts'))).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
});

describe('largest', () => {
  it('takes the largest of the series of a kind at each time', () => {
    expect(
      largest(
        [
          {
            metric: 'disk:/',
            points: [
              { time: 60, value: 20 },
              { time: 120, value: 30 },
            ],
          },
          { metric: 'disk:/srv', points: [{ time: 60, value: 90 }] },
          { metric: 'disk.read:/', points: [{ time: 60, value: 1e6 }] },
        ],
        'disk',
      ),
    ).toEqual([
      { time: 60, value: 90 },
      { time: 120, value: 30 },
    ]);
  });
});

describe('within', () => {
  it('keeps the steps within the range, the one the range starts in too', () => {
    const points = [0, 60, 120, 180, 240].map((time) => ({ time, value: 1 }));
    expect(within(points, { from: 100, to: 240, step: 60 }).map((p) => p.time)).toEqual([
      60, 120, 180,
    ]);
  });

  it('drops a history that ends before the range, as of a device asleep', () => {
    expect(within([{ time: 60, value: 1 }], { from: 3600, to: 7200, step: 60 })).toEqual([]);
  });
});

describe('Compare', () => {
  let fixture: ComponentFixture<Compare>;
  let http: HttpTestingController;

  const history = (cpu: number, time: number, retentionDays = 30): History => ({
    from: time - 60,
    to: time + 3600,
    stepSeconds: 60,
    retentionDays,
    series: [{ metric: 'cpu', points: [{ time, value: cpu }] }],
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      imports: [Compare],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DeviceService).devices.set([
      { id: 'local', name: 'Hub' },
      { id: 'router', name: 'Router', router: true },
      { id: 'pc', name: 'Office PC', kind: 'pc', unreachable: true },
      { id: 'printer', name: 'Printer', checked: true },
    ]);
    fixture = TestBed.createComponent(Compare);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    // What the Wi-Fi saw has a test of its own (wifi-nearby.spec.ts).
    http.match((r) => r.url === '/api/wifi');
    http.verify();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Answers the reads; the PC's history ends a day before the range when it is `asleep`. */
  function answer(asleep = false, retentionDays = 30): void {
    // The printer's usage could not be read.
    http.expectOne('/api/devices/metrics').flush({ local: snapshot, router });
    const cpu: Record<string, number> = { local: 40, router: 0, pc: 70 };
    const requests = http.match((r) => r.url === '/api/history');
    expect(requests.map((r) => r.request.params.get('device') ?? 'local')).toEqual([
      'local',
      'router',
      'pc',
    ]);
    for (const r of requests) {
      const device = r.request.params.get('device') ?? 'local';
      const from = Number(r.request.params.get('from'));
      r.flush(
        history(cpu[device], device === 'pc' && asleep ? from - 86400 : from + 60, retentionDays),
      );
    }
    fixture.detectChanges();
  }

  function rows(): string[][] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'), (tr) =>
      Array.from(tr.querySelectorAll('th, td'), (cell) =>
        cell.textContent!.replace(/\s+/g, ' ').trim(),
      ),
    );
  }

  it('shows the values of every device, and why a device has none', () => {
    answer();
    expect(rows()).toEqual([
      [
        'Hub',
        '12.5 %',
        '25.0 %',
        '93.8 % /srv',
        '52.1 °C nvme',
        '↓ 1.0 KiB/s↑ 200 B/s',
        '3 d 4 h',
        '–',
      ],
      ['Router', '–', '–', '–', '–', '↓ 1.0 KiB/s↑ 200 B/s', '–', '–'],
      ['Office PC', 'Not in use', '–'],
      ['Printer', 'No values right now', '–'],
    ]);
  });

  it('lists what each device is that tells it', () => {
    http.expectOne('/api/devices/metrics').flush({
      local: {
        ...snapshot,
        version: '1.2.3',
        system: { os: 'Debian GNU/Linux 13 (trixie)', maker: 'Dell Inc.', model: 'OptiPlex 7010' },
      },
      router,
    });
    http.match((r) => r.url === '/api/history');
    fixture.detectChanges();
    const section = (fixture.nativeElement as HTMLElement).querySelector(
      'section[aria-labelledby="compare-system"]',
    )!;
    expect(
      Array.from(section.querySelectorAll('tr'), (tr) =>
        Array.from(tr.querySelectorAll('th, td'), (cell) => cell.textContent!.trim()),
      ),
    ).toEqual([
      ['Device', 'Model', 'Operating system', 'Kernel', 'Architecture', 'Processor', 'Den-Watcher'],
      ['Hub', 'Dell Inc. OptiPlex 7010', 'Debian GNU/Linux 13 (trixie)', '–', '–', '–', '1.2.3'],
    ]);
  });

  it('leaves out the table of what the devices are when none tells it', () => {
    answer();
    expect((fixture.nativeElement as HTMLElement).querySelector('#compare-system')).toBeNull();
  });

  it('sorts by a column, largest first, and back', () => {
    answer();
    const header = (name: string) =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('thead button'),
      ).find((b) => b.textContent!.trim() === name)!;
    header('Network').click();
    fixture.detectChanges();
    expect(rows().map((r) => r[0])).toEqual(['Hub', 'Router', 'Office PC', 'Printer']);
    header('CPU').click();
    fixture.detectChanges();
    expect(rows().map((r) => r[0])).toEqual(['Hub', 'Router', 'Office PC', 'Printer']);
    expect(header('CPU ↓').getAttribute('aria-pressed')).toBe('true');
  });

  it('charts a line per device that reports the value, leaving out checks', () => {
    answer();
    const titles = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.charts h3'),
      (h) => h.textContent!.trim(),
    );
    expect(titles).toEqual(['CPU']);
    expect(legend()).toEqual(['Hub', 'Office PC']);
  });

  it("colors each device's line by its place among the devices, in every chart", () => {
    answer();
    // The router before the PC charts no CPU; the PC still takes the color of the third device.
    const swatches = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.charts .legend .swatch',
    );
    expect(Array.from(swatches, (s) => s.classList.contains('series-0'))).toEqual([true, false]);
    expect(swatches[1].classList).toContain('series-2');
  });

  it('leaves out the line of a device whose history ends before the range', () => {
    answer(true);
    // With one line left, the chart needs no legend.
    expect(legend()).toEqual([]);
  });

  it('offers only the ranges within the history the hub keeps', () => {
    expect(ranges()).toEqual(['1 h', '6 h', '1 d', '7 d', '30 d']);
    // A range picked before the hub said how long it keeps history.
    http.match((r) => r.url === '/api/history');
    const choices = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.choices button',
    );
    choices[4].click();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    answer(false, 7);
    expect(ranges()).toEqual(['1 h', '6 h', '1 d', '7 d']);
    // The longest range offered stands in for the one picked, and the charts are read for it.
    expect(pressed()).toBe('7 d');
    vi.advanceTimersByTime(0);
    const [read] = http.match((r) => r.url === '/api/history');
    expect(Number(read.request.params.get('to')) - Number(read.request.params.get('from'))).toBe(
      7 * 86400,
    );
  });

  function ranges(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.choices button'),
      (b) => b.textContent!.trim(),
    );
  }

  function pressed(): string | undefined {
    return (fixture.nativeElement as HTMLElement)
      .querySelector('.choices button[aria-pressed="true"]')
      ?.textContent!.trim();
  }

  function legend(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.charts .legend li'),
      (li) => li.textContent!.trim(),
    );
  }

  it('shows a device on its own when its name is picked', () => {
    answer();
    const devices = TestBed.inject(DeviceService);
    devices.comparing.set(true);
    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('tbody .device')[1]
      .click();
    expect(devices.selectedId()).toBe('router');
    expect(devices.comparing()).toBe(false);
  });
});
