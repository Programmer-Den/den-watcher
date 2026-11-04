import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { DeviceService, LOCAL_DEVICE } from '../devices/devices';
import { ChartCanvas } from '../history/chart-canvas';
import { ChartPointer } from '../history/chart-pointer';
import { HistoryStore } from '../history/history-store';
import { Sparkline } from '../history/sparkline';
import { History, Snapshot } from '../metrics/metrics';
import { Glance } from './glance';

const SNAPSHOT: Snapshot = {
  time: '2026-10-11T12:00:00Z',
  uptimeSeconds: 60,
  cpu: {
    usagePercent: 7.7,
    cores: 4,
    clockMHz: 1400,
    loadAverage: { one: 0.34, five: 0.29, fifteen: 0.35 },
  },
  memory: {
    totalBytes: 8 * 1024 ** 3,
    usedBytes: 3 * 1024 ** 3,
    usedPercent: 38.8,
    swap: { totalBytes: 100, usedBytes: 4, usedPercent: 3.6 },
  },
  temperatures: [
    { sensor: 'gpu', celsius: 40 },
    { sensor: 'cpu_thermal', celsius: 45.8 },
  ],
  fans: [{ name: 'pwmfan', rpm: 1446 }],
  disks: [
    { path: '/', totalBytes: 100 * 1024 ** 3, usedBytes: 21 * 1024 ** 3, usedPercent: 21 },
    { path: '/mnt/usb', totalBytes: 1024 ** 4, usedBytes: 469 * 1024 ** 3, usedPercent: 45.8 },
  ],
  network: [
    {
      name: 'eth0',
      receivedBytes: 0,
      sentBytes: 0,
      receiveBytesPerSecond: 1536,
      sendBytesPerSecond: 512,
    },
  ],
};

describe('Glance', () => {
  let fixture: ComponentFixture<Glance>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [Glance],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Glance);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function show(snapshot: Snapshot, history: History | null = null): void {
    fixture.componentRef.setInput('snapshot', snapshot);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const request = http.expectOne((r) => r.url === '/api/history');
    if (history) {
      request.flush(history);
    }
    fixture.detectChanges();
  }

  function tiles(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-glance-tile'),
      (t) => t.textContent!.replace(/\s+/g, ' ').trim(),
    );
  }

  it('shows the main values with what they are, the fullest disk and the hottest sensor', () => {
    show(SNAPSHOT);

    expect(tiles()).toEqual([
      'CPU 4 cores · 1.4 GHz 7.7%Load 0.34 · 0.29 · 0.35',
      'Memory Swap 3.6 % 38.8%3.0 GiB of 8.0 GiB',
      'Fullest disk /mnt/usb 45.8%469.0 GiB of 1.0 TiB',
      'Temperature cpu_thermal 45.8°Cpwmfan · 1,446 rpm',
      'Network eth0 ↓ 1.5KiB/s↑ 512 B/s',
    ]);
  });

  it('leaves out what the device does not report, and hides when it reports none of it', () => {
    show({
      ...SNAPSHOT,
      cpu: { usagePercent: 0, cores: 0 },
      memory: { totalBytes: 0, usedBytes: 0, usedPercent: 0 },
      temperatures: [],
    });
    expect(tiles().map((t) => t.split(' ')[0])).toEqual(['Fullest', 'Network']);

    fixture.componentRef.setInput('snapshot', { ...SNAPSHOT, ...EMPTY });
    fixture.detectChanges();
    expect(tiles()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).hidden).toBe(true);
  });

  it("adds up only a router's internet connection, and leaves the network out where it does not tell which one that is", () => {
    TestBed.inject(DeviceService).devices.set([{ id: 'local', name: '', router: true }]);
    const port = (name: string, receiveBytesPerSecond: number) => ({
      name,
      receivedBytes: 0,
      sentBytes: 0,
      receiveBytesPerSecond,
      sendBytesPerSecond: 0,
    });
    show(
      { ...SNAPSHOT, network: [port('WAN', 2048), port('LAN', 2048)] },
      {
        from: 0,
        to: 1000,
        stepSeconds: 100,
        retentionDays: 30,
        series: [
          { metric: 'network.receive:WAN', points: [{ time: 0, value: 1024 }] },
          { metric: 'network.receive:LAN', points: [{ time: 0, value: 1024 }] },
        ],
      },
    );
    expect(tiles()[4]).toBe('Network WAN ↓ 2.0KiB/s↑ 0 B/s');

    fixture.componentRef.setInput('snapshot', { ...SNAPSHOT, network: [port('LAN', 2048)] });
    fixture.detectChanges();
    expect(tiles().map((t) => t.split(' ')[0])).not.toContain('Network');
  });

  it('marks the tile of a value with an alert on what it shows', () => {
    TestBed.inject(DeviceService).devices.set([
      {
        id: 'local',
        name: '',
        alerts: [
          {
            id: 1,
            device: 'local',
            deviceName: '',
            kind: 'disk',
            subject: '/mnt/usb',
            level: 'warning',
            started: '2026-10-11T11:00:00Z',
          },
          {
            id: 2,
            device: 'local',
            deviceName: '',
            kind: 'temperature',
            subject: 'gpu',
            level: 'alert',
            started: '2026-10-11T11:00:00Z',
          },
        ],
      },
    ]);
    show(SNAPSHOT);

    const [, , disk, temperature] = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'app-glance-tile',
    );
    expect(disk.classList).toContain('warning');
    expect(disk.querySelector('app-alert-icon')?.getAttribute('aria-label')).toBe(
      'Needs attention',
    );
    // The alert is on the GPU, not on the hottest sensor the tile shows.
    expect(temperature.querySelector('app-alert-icon')).toBeNull();
  });

  it('draws the history of each value in a small chart', () => {
    // A long range, which is shown as the backend answers it.
    TestBed.inject(HistoryStore).span.set(3600);
    show(SNAPSHOT, {
      from: 0,
      to: 1000,
      stepSeconds: 100,
      retentionDays: 30,
      series: [
        {
          metric: 'cpu',
          points: [
            { time: 0, value: 50 },
            { time: 100, value: 100 },
          ],
        },
        { metric: 'network.receive:eth0', points: [{ time: 0, value: 1024 }] },
        { metric: 'network.receive:wlan0', points: [{ time: 0, value: 1024 }] },
      ],
    });

    const lines = fixture.debugElement
      .queryAll(By.css('app-sparkline canvas'))
      .map((canvas) => canvas.injector.get(ChartCanvas).lines()[0].segments);
    expect(lines[0]).toEqual([
      [
        { x: 0.05, y: 0.5 },
        { x: 0.15, y: 0 },
      ],
    ]);
    expect(lines[1]).toEqual([]);
    // Both cards together, 2 KiB/s, at the top of a 2 KiB/s chart.
    expect(lines[4]).toEqual([[{ x: 0.05, y: 0 }]]);
  });

  it('shows the values at the moment the pointer is on in a chart, and now again after', () => {
    TestBed.inject(HistoryStore).span.set(3600);
    show(SNAPSHOT, {
      from: 0,
      to: 1000,
      stepSeconds: 100,
      retentionDays: 30,
      series: [
        {
          metric: 'cpu',
          points: [
            { time: 0, value: 50 },
            { time: 100, value: 21.25 },
          ],
        },
      ],
    });
    const pointer = TestBed.inject(ChartPointer);

    pointer.point({}, 100);
    fixture.detectChanges();
    expect(tiles()[0]).toMatch(/^CPU 4 cores · 1.4 GHz 21.3%at \d/);
    // A tile without a value at that moment keeps now's.
    expect(tiles()[1]).toBe('Memory Swap 3.6 % 38.8%3.0 GiB of 8.0 GiB');

    pointer.clear();
    fixture.detectChanges();
    expect(tiles()[0]).toBe('CPU 4 cores · 1.4 GHz 7.7%Load 0.34 · 0.29 · 0.35');
  });

  it('does not draw the small charts again for a new snapshot while the history stays', () => {
    show(SNAPSHOT, {
      from: 0,
      to: 1000,
      stepSeconds: 100,
      retentionDays: 30,
      series: [
        { metric: 'cpu', points: [{ time: 0, value: 50 }] },
        { metric: 'network.receive:eth0', points: [{ time: 0, value: 1024 }] },
      ],
    });
    const points = () =>
      fixture.debugElement
        .queryAll(By.directive(Sparkline))
        .map((d) => (d.componentInstance as Sparkline).points());
    const before = points();

    fixture.componentRef.setInput('snapshot', {
      ...SNAPSHOT,
      cpu: { ...SNAPSHOT.cpu, usagePercent: 9 },
    });
    TestBed.inject(DeviceService).devices.set([{ ...LOCAL_DEVICE }]);
    fixture.detectChanges();
    // The CPU's and the network's, which the history has.
    expect(points()[0]).toBe(before[0]);
    expect(points()[4]).toBe(before[4]);
  });
});

const EMPTY: Partial<Snapshot> = {
  cpu: { usagePercent: 0, cores: 0 },
  memory: { totalBytes: 0, usedBytes: 0, usedPercent: 0 },
  temperatures: [],
  disks: [],
  network: [],
};
