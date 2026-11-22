import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { TownTrackPoint, TownWiFi } from '../metrics/metrics';
import { BREAK_SECONDS, quantile, townDays, townLines } from './town';
import { LIST_TOWN, TOWN_REFRESH_MS, TownWifi } from './town-wifi';

/** Noon on a day, in Unix seconds, local time, so the scans of one day stay on one. */
const NOON = new Date(2026, 10, 18, 12).getTime() / 1000;

function at(minutes: number, extra: Partial<TownTrackPoint> = {}): TownTrackPoint {
  return {
    time: NOON + minutes * 60,
    known: 2,
    lat: 53.57 + minutes / 10_000,
    lon: 10,
    meters: 40,
    gps: { lat: 53.57 + minutes / 10_000, lon: 10.0003, offMeters: minutes },
    ...extra,
  };
}

function town(): TownWiFi {
  return {
    from: 0,
    to: 7 * 86400,
    learned: 1234,
    learnedFrom: NOON - 86400,
    moving: 3,
    once: 7,
    accessPoints: [
      {
        id: 'a1',
        ssid: 'Den',
        lat: 53.57,
        lon: 10,
        meters: 60,
        points: 9,
        scans: 40,
        signalPercent: 95,
        first: NOON - 86400,
        last: NOON,
        connected: true,
      },
      {
        id: 'b2',
        lat: 53.58,
        lon: 10.01,
        meters: 30,
        points: 2,
        scans: 2,
        signalPercent: 40,
        first: NOON,
        last: NOON,
      },
    ],
    tracks: [
      { device: 'pixel', points: [at(0), at(5), at(10, { known: 0, lat: undefined }), at(15)] },
      { device: 'galaxy', points: [at(-86400 / 60, { gps: undefined })] },
    ],
  };
}

describe('the ways by Wi-Fi', () => {
  it('splits the ways by phone and day, the newest first, and counts what was placed', () => {
    const days = townDays(town().tracks);
    expect(days.map((d) => d.device)).toEqual(['pixel', 'galaxy']);
    expect(days[0]).toEqual(
      expect.objectContaining({ placed: 3, gaps: 1, off: [0, 5, 15], start: NOON }),
    );
    expect(days[1].off).toEqual([]);
  });

  it('breaks the lines where a scan placed nothing or the phone scanned nothing for long', () => {
    const points = [at(0), at(5), at(10, { known: 0 }), at(15), at(15 + BREAK_SECONDS / 60 + 1)];
    expect(townLines(points).map((l) => l.length)).toEqual([2, 1, 1]);
    // The GPS is broken only where it is missing or for long.
    expect(townLines(points, true).map((l) => l.length)).toEqual([4, 1]);
  });

  it('takes the value a share of the way up', () => {
    expect(quantile([], 0.5)).toBeUndefined();
    expect(quantile([30, 10, 20], 0.5)).toBe(20);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(10);
  });
});

describe('the Wi-Fi around town', () => {
  let fixture: ComponentFixture<TownWifi>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [TownWifi],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DeviceService).devices.set([
      { id: 'pixel', name: 'Pixel', kind: 'phone' },
      { id: 'galaxy', name: 'Galaxy', kind: 'phone' },
    ]);
    fixture = TestBed.createComponent(TownWifi);
    fixture.componentRef.setInput('seconds', 7 * 86400);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function reply(body: TownWiFi | null, seconds = 7 * 86400): void {
    const request = http.expectOne((r) => r.method === 'GET' && r.url === '/api/wifi/town');
    const from = Number(request.request.params.get('from'));
    expect(Number(request.request.params.get('to')) - from).toBe(seconds);
    if (body) {
      request.flush(body);
    } else {
      request.flush('no', { status: 500, statusText: 'Server Error' });
    }
    fixture.detectChanges();
  }

  function text(selector: string): string[] {
    return [...element.querySelectorAll(selector)].map(
      (e) => e.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  function click(label: string): void {
    const found = [...element.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    );
    expect(found, label).toBeTruthy();
    found!.click();
    fixture.detectChanges();
  }

  it('lists the placed access points, what was left out, and shows the picked one', () => {
    reply(town());
    expect(text('.summary li')).toEqual([
      '2 access points placed: heard at 2 or more points close together',
      '3 left out: heard too far apart (hotspots, buses, phones)',
      '7 heard at one point only so far, placed after the next',
      expect.stringContaining('Learned from 1,234 scans with a GPS position since'),
    ]);
    expect(text('.pick')).toEqual([
      'Den Heard at 9 points · Yours ± 60 m',
      'Hidden network Heard at 2 points ± 30 m',
    ]);
    expect(element.querySelectorAll('g.ap').length).toBe(2);
    expect(element.querySelector('g.ap.picked text')?.textContent?.trim()).toBe('Den');
    expect(element.querySelector('circle.reach')).toBeTruthy();
    expect(element.querySelector('.detail-card h3')?.textContent).toContain('Den');
    expect(element.querySelector('.detail-card dl')?.textContent).toContain('95 %');

    click('Hidden network');
    expect(element.querySelector('.detail-card h3')?.textContent).toContain('Hidden network');

    fixture.componentRef.setInput('search', 'den');
    fixture.detectChanges();
    expect(text('.pick').length).toBe(1);
    expect(element.querySelector('.detail-card h3')?.textContent).toContain('Den');
    fixture.componentRef.setInput('search', 'nowhere');
    fixture.detectChanges();
    expect(element.textContent).toContain('No placed access point has this name.');
  });

  it("tracks a phone's day by Wi-Fi next to its GPS", () => {
    reply(town());
    click('Track by Wi-Fi');
    expect(text('.pick')).toEqual([
      expect.stringMatching(/^Pixel 3 of 4 scans placed/),
      expect.stringMatching(/^Galaxy 1 of 1 scans placed/),
    ]);
    expect(text('.summary li')).toEqual([
      '3 of 4 scans placed by Wi-Fi',
      '5 m from the GPS in the middle, at most 15 m for 9 of 10',
      '1 scan without a known network: a gap in the line',
    ]);
    // Broken at the gap: two lines by Wi-Fi, one by GPS.
    expect(element.querySelectorAll('polyline.wifi').length).toBe(2);
    expect(element.querySelectorAll('circle.wifi-dot').length).toBe(3);
    expect(element.querySelectorAll('circle.sure').length).toBe(3);
    expect(element.querySelectorAll('polyline.gps').length).toBe(1);
    expect(element.querySelectorAll('g.ap').length).toBe(0);
    expect(element.querySelector('.detail-card h3')?.textContent).toContain('Pixel');

    click('Galaxy');
    expect(text('.summary li')).toContain(
      'No GPS to compare with: the phone sent no position at these scans.',
    );
  });

  it('reads the town again, greys out what it had when that fails, and tells when nothing is placed', () => {
    reply(town());
    vi.advanceTimersByTime(TOWN_REFRESH_MS);
    reply(null);
    expect(element.textContent).toContain('Could not read the Wi-Fi around town.');
    expect(element.querySelector('.overview.stale')).toBeTruthy();

    fixture.componentRef.setInput('seconds', 86400);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    reply({ ...town(), accessPoints: [], tracks: [] }, 86400);
    expect(element.textContent).toContain('No access point is placed yet.');
    click('Track by Wi-Fi');
    expect(element.textContent).toContain('No phone scanned in this range.');
  });

  it('lists the first access points until all are asked for', () => {
    const many = town();
    many.accessPoints = Array.from({ length: LIST_TOWN + 3 }, (_, i) => ({
      ...many.accessPoints[0],
      id: `ap${i}`,
      ssid: `Net ${i}`,
    }));
    reply(many);
    expect(element.querySelectorAll('.pick').length).toBe(LIST_TOWN);
    click(`Show all ${LIST_TOWN + 3} access points`);
    expect(element.querySelectorAll('.pick').length).toBe(LIST_TOWN + 3);
  });
});
