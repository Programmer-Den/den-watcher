import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { HistoryStore } from '../history/history-store';
import { PhoneRoute, RoutePoint } from '../metrics/metrics';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  PhoneRouteCard,
  ROUTE_REFRESH_MS,
  STOP_SECONDS,
  distance,
  meters,
  places,
  routeMap,
  stops,
} from './phone-route';

const MINUTE = 60;

/** A point at minute `minute`, `north` hundredths of a degree north of the start. */
function point(minute: number, north: number, accuracy = 15): RoutePoint {
  return { time: minute * MINUTE, lat: 53.55 + north / 100, lon: 10, accuracy };
}

/** Half an hour at home, the way 2.2 km north over 10 minutes, and half an hour at work. */
function day(): PhoneRoute {
  return {
    from: 0,
    to: 80 * MINUTE,
    points: [
      point(0, 0),
      point(15, 0.0001),
      point(30, 0),
      point(35, 1),
      point(40, 2),
      point(45, 2.0001),
      point(60, 2),
      point(75, 2.0001),
    ],
  };
}

describe('the route', () => {
  it('measures the way along the earth, leaving out where the position only wavers', () => {
    expect(meters(point(0, 0), point(0, 1))).toBeCloseTo(1112, -1);
    expect(distance(day().points)).toBeCloseTo(2224, -1);
    expect(distance([point(0, 0), point(1, 0.05, 100)])).toBe(0);
  });

  it('finds the places the phone stayed at', () => {
    const found = stops(day().points);
    expect(found.length).toBe(2);
    expect(found[0].start).toBe(0);
    expect(found[0].end).toBe(30 * MINUTE);
    expect(found[1].start).toBe(40 * MINUTE);
    expect(found[1].lat).toBeCloseTo(53.57, 3);
    expect(stops([point(0, 0), point(STOP_SECONDS / MINUTE - 1, 0)])).toEqual([]);
  });

  it('counts the stops at the same place as visits there, the longest first', () => {
    const home = { lat: 53.55, lon: 10, start: 0, end: 600 };
    const work = { lat: 53.57, lon: 10, start: 1000, end: 4600 };
    const back = { lat: 53.5501, lon: 10, start: 5000, end: 6200 };
    expect(places([home, work, back])).toEqual([
      { lat: 53.57, lon: 10, seconds: 3600, visits: 1 },
      { lat: 53.55, lon: 10, seconds: 1800, visits: 2 },
    ]);
  });

  it('gives the points a dot each, only the newest of those drawn on top of each other', () => {
    const map = routeMap(day().points)!;
    expect(map.points.length).toBe(8);
    // The three at home, the two on the way and the three at work, each drawn at the same spot.
    expect(map.dots).toEqual([2, 3, 7]);
  });

  it('draws the route centered on a map that holds all of it', () => {
    const map = routeMap(day().points, places(stops(day().points)))!;
    expect(map.zoom).toBeGreaterThan(10);
    expect(map.path.startsWith('M')).toBe(true);
    for (const p of [map.start, map.end, ...map.places]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(MAP_WIDTH);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(MAP_HEIGHT);
    }
    // North is up.
    expect(map.end.y).toBeLessThan(map.start.y);
    expect(map.tiles.length).toBeGreaterThan(0);
    expect(map.tiles[0].href).toMatch(
      new RegExp(`^https://tile\\.openstreetmap\\.org/${map.zoom}/\\d+/\\d+\\.png$`),
    );
    expect(routeMap([])).toBeNull();
  });
});

describe('PhoneRouteCard', () => {
  let fixture: ComponentFixture<PhoneRouteCard>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [PhoneRouteCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const devices = TestBed.inject(DeviceService);
    devices.devices.set([
      { id: 'local', name: 'Hub' },
      { id: 'pixel', name: 'Pixel', kind: 'phone' },
    ]);
    devices.selectedId.set('pixel');
    fixture = TestBed.createComponent(PhoneRouteCard);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function answer(body: PhoneRoute): void {
    const request = http.expectOne((r) => r.url === '/api/phone/route');
    expect(request.request.params.get('device')).toBe('pixel');
    const from = Number(request.request.params.get('from'));
    const to = Number(request.request.params.get('to'));
    expect(to - from).toBe(TestBed.inject(HistoryStore).span());
    request.flush(body);
    fixture.detectChanges();
  }

  it('shows the way, the map and the stops', () => {
    answer(day());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('2.2 km travelled');
    expect(text).toContain('8 points');
    expect(text).toContain('OpenStreetMap');
    expect(fixture.nativeElement.querySelectorAll('image').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('path.line').getAttribute('d')).toMatch(/^M/);
    const listed = fixture.nativeElement.querySelectorAll('.list li');
    expect(listed.length).toBe(2);
    expect(listed[0].textContent).toContain('35 min');
    expect(listed[1].textContent).toContain('stayed once');
  });

  it('leaves out the tiles that do not load', () => {
    answer(day());
    const tiles = fixture.nativeElement.querySelectorAll('image');
    tiles[0].dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('image').length).toBe(tiles.length - 1);
  });

  it('tells how to allow it when the phone sent none', () => {
    answer({ from: 0, to: MINUTE, points: [] });
    expect(fixture.nativeElement.textContent).toContain('allow the location all the time');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('keeps the map and does not read again when the list of devices is read', () => {
    answer(day());
    // The list of devices is read every few seconds, each time with new objects.
    const devices = TestBed.inject(DeviceService);
    devices.devices.set(devices.devices().map((d) => ({ ...d })));
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    expect(fixture.nativeElement.querySelector('path.line')).not.toBeNull();
  });

  it('shows the Wi-Fi networks scanned at a point clicked on the map', () => {
    answer(day());
    const hits = fixture.nativeElement.querySelectorAll('circle.hit');
    expect(hits.length).toBe(3);
    hits[1].dispatchEvent(new Event('click'));
    fixture.detectChanges();
    const request = http.expectOne((r) => r.url === '/api/phone/scan');
    expect(request.request.params.get('device')).toBe('pixel');
    expect(request.request.params.get('time')).toBe(String(35 * MINUTE));
    request.flush({
      time: 35 * MINUTE,
      scan: {
        time: 33 * MINUTE,
        networks: [
          { ssid: 'Den', signalPercent: 80, frequencyMHz: 5180, security: 'WPA2', connected: true },
          { signalPercent: 20, frequencyMHz: 2412, security: 'Open' },
        ],
      },
    });
    fixture.detectChanges();
    const scan = fixture.nativeElement.querySelector('.scan') as HTMLElement;
    expect(scan.textContent).toContain('2 Wi-Fi networks');
    expect(scan.textContent).toContain('scanned 2 minutes before');
    const listed = scan.querySelectorAll('.networks li');
    expect(listed[0].textContent).toContain('Den');
    expect(listed[0].textContent).toContain('connected');
    expect(listed[0].textContent).toContain('36 · 5 GHz · WPA2');
    expect(listed[0].textContent).toContain('80 %');
    expect(listed[1].textContent).toContain('Hidden network');
    expect(listed[1].textContent).toContain('Open');
    expect(fixture.nativeElement.querySelector('circle.selected')).not.toBeNull();

    // The next point is read in turn, and one without a scan says so.
    (scan.querySelectorAll('.step')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const next = http.expectOne((r) => r.url === '/api/phone/scan');
    expect(next.request.params.get('time')).toBe(String(40 * MINUTE));
    next.flush({ time: 40 * MINUTE, scan: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.scan').textContent).toContain('no Wi-Fi scan');

    // Closed again, it offers the newest point.
    (fixture.nativeElement.querySelectorAll('.scan .step')[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('circle.selected')).toBeNull();
    (fixture.nativeElement.querySelector('.scan .link') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne(
      (r) => r.url === '/api/phone/scan' && r.params.get('time') === String(75 * MINUTE),
    );
  });

  it('reads it again after a while and for another range', () => {
    answer(day());
    vi.advanceTimersByTime(ROUTE_REFRESH_MS);
    answer(day());
    TestBed.inject(HistoryStore).span.set(24 * 3600);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    answer(day());
  });
});
