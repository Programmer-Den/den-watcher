import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Alert } from '../alerts/alert';
import { DeviceService, LOCAL_DEVICE } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { DeviceEvent, History } from '../metrics/metrics';
import {
  ChartEvents,
  ChartMarker,
  EVENTS_REFRESH_MS,
  markersIn,
  markersOf,
  placeMarkers,
} from './chart-events';
import { HistoryStore } from './history-store';

const DISK: Alert = {
  id: 1,
  device: 'local',
  deviceName: '',
  kind: 'disk',
  subject: '/',
  level: 'warning',
  value: 91,
  started: '1970-01-01T00:01:40Z',
  ended: '1970-01-01T00:03:20Z',
};

const EVENTS: DeviceEvent[] = [
  { kind: 'outage', time: 50, end: 80 },
  { kind: 'alert', time: 100, end: 200, alert: DISK },
  { kind: 'alert', time: 120, alert: { ...DISK, id: 2, kind: 'offline', ended: undefined } },
  { kind: 'reboot', time: 150 },
  { kind: 'update', time: 160, detail: '1.5.0' },
  { kind: 'something new' as DeviceEvent['kind'], time: 170 },
];

describe('markersOf', () => {
  it('marks alerts where they start and end, outages as bands, reboots and updates', () => {
    const i18n = TestBed.inject(I18n);
    expect(markersOf(EVENTS, i18n, false)).toEqual([
      { kind: 'outage', time: 50, end: 80, text: 'Did not answer' },
      { kind: 'alert', time: 100, level: 'warning', text: 'Disk / is 91 % full' },
      { kind: 'alertEnded', time: 200, level: 'warning', text: 'Ended: Disk / is 91 % full' },
      { kind: 'reboot', time: 150, text: 'Restarted' },
      { kind: 'update', time: 160, text: 'Den-Watcher updated to 1.5.0' },
    ]);
    expect(markersOf(EVENTS, i18n, true)[0].text).toBe('Switched off');
  });
});

describe('placeMarkers and markersIn', () => {
  const markers: ChartMarker[] = [
    { kind: 'outage', time: 0, end: 150, text: 'off' },
    { kind: 'reboot', time: 150, text: 'up' },
    { kind: 'update', time: 500, text: 'later' },
  ];

  it('places the marks within the range, cutting a band to it', () => {
    expect(placeMarkers(markers, 100, 300)).toEqual([
      { ...markers[0], left: 0, width: 25 },
      { ...markers[1], left: 25 },
    ]);
    expect(placeMarkers(markers, 100, 100)).toEqual([]);
  });

  it('finds the marks in a step, and a band over it', () => {
    expect(markersIn(markers, 100, 60).map((m) => m.text)).toEqual(['off', 'up']);
    expect(markersIn(markers, 160, 60)).toEqual([]);
    expect(markersIn(markers, 400, 60)).toEqual([]);
    expect(markersIn(markers, 400, 60, 50).map((m) => m.text)).toEqual(['later']);
  });
});

describe('ChartEvents', () => {
  let http: HttpTestingController;
  let store: HistoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(HistoryStore);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const history = (from: number, to: number): History => ({
    from,
    to,
    stepSeconds: 5,
    retentionDays: 30,
    series: [],
  });

  function show(from: number, to: number): void {
    store.history.set(history(from, to));
    TestBed.tick();
  }

  it('reads the range shown, again when it changes, but at most every 30 s as it moves on', () => {
    const events = TestBed.inject(ChartEvents);
    const watching = events.watch.subscribe();
    show(0, 1800);
    const request = http.expectOne((r) => r.url === '/api/events');
    expect(request.request.params.get('from')).toBe('0');
    expect(request.request.params.get('to')).toBe('1800');
    request.flush({ from: 0, to: 1800, events: [{ kind: 'reboot', time: 900 }] });
    expect(events.markers()).toEqual([{ kind: 'reboot', time: 900, text: 'Restarted' }]);

    vi.advanceTimersByTime(5_000);
    show(5, 1805);
    expect(http.match((r) => r.url === '/api/events')).toEqual([]);

    vi.advanceTimersByTime(EVENTS_REFRESH_MS);
    show(35, 1835);
    http.expectOne((r) => r.url === '/api/events').flush({ from: 35, to: 1835, events: [] });

    // A longer range is read at once.
    show(0, 86400);
    http.expectOne((r) => r.url === '/api/events').flush({ from: 0, to: 86400, events: [] });

    // Another device's marks are not shown while its own load.
    TestBed.inject(DeviceService).selectedId.set('nas');
    expect(events.markers()).toEqual([]);
    watching.unsubscribe();
  });

  it('keeps the marks when the list of devices is read again unchanged', () => {
    const devices = TestBed.inject(DeviceService);
    const events = TestBed.inject(ChartEvents);
    const watching = events.watch.subscribe();
    show(0, 1800);
    http
      .expectOne((r) => r.url === '/api/events')
      .flush({ from: 0, to: 1800, events: [{ kind: 'reboot', time: 900 }] });
    const marks = events.markers();

    devices.devices.set([{ ...LOCAL_DEVICE }]);
    expect(events.markers()).toBe(marks);
    watching.unsubscribe();
  });

  it('draws the charts unmarked when the events cannot be read', () => {
    const events = TestBed.inject(ChartEvents);
    const watching = events.watch.subscribe();
    show(0, 1800);
    http
      .expectOne((r) => r.url === '/api/events')
      .flush('', { status: 500, statusText: 'Server Error' });
    expect(events.markers()).toEqual([]);

    // The next range read tries again, without waiting 30 s.
    vi.advanceTimersByTime(5_000);
    show(5, 1805);
    http
      .expectOne((r) => r.url === '/api/events')
      .flush({ from: 5, to: 1805, events: [{ kind: 'reboot', time: 900 }] });
    expect(events.markers()).toEqual([{ kind: 'reboot', time: 900, text: 'Restarted' }]);
    watching.unsubscribe();
  });
});
