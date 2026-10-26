import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { WiFiAccessPoint, WiFiHistory } from './wifi';
import { WifiNearby } from './wifi-nearby';

const HOUR = 3600;

describe('WifiNearby', () => {
  let fixture: ComponentFixture<WifiNearby>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [WifiNearby],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DeviceService).devices.set([
      { id: 'local', name: 'Hub' },
      { id: 'laptop', name: 'Laptop', kind: 'pc' },
      { id: 'nas', name: 'NAS' },
    ]);
    fixture = TestBed.createComponent(WifiNearby);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  /**
   * Answers the read with the hub and the laptop seeing two radios of Den and a neighbour, and the
   * routers that are devices.
   */
  function answer(routers?: Record<string, string>): void {
    const request = http.expectOne((r) => r.url === '/api/wifi');
    const to = Number(request.request.params.get('to'));
    const hour = Math.floor(to / HOUR) * HOUR;
    const ap = (
      id: string,
      ssid: string,
      signals: Record<string, number>,
      connected: string[] = [],
      frequencyMHz = 5180,
    ): WiFiAccessPoint => ({
      id,
      box: id === 'n1' ? 'nb' : 'b1',
      ssid,
      frequencyMHz,
      security: id === 'n1' ? 'Open' : 'WPA2/WPA3',
      firstSeen: hour,
      lastSeen: hour,
      seenBy: Object.entries(signals).map(([device, signalPercent]) => ({
        device,
        points: [
          {
            time: hour,
            seen: 6,
            connected: connected.includes(device) ? 6 : undefined,
            signalPercent,
            minPercent: signalPercent,
            maxPercent: signalPercent,
          },
        ],
      })),
    });
    const answer: WiFiHistory = {
      from: to - 86400,
      to,
      stepSeconds: HOUR,
      devices: ['local', 'laptop'].map((device) => ({
        device,
        steps: [{ time: hour, readings: 6 }],
      })),
      accessPoints: [
        ap('a1', 'Den', { local: 64, laptop: 98 }, ['laptop']),
        ap('a2', 'Den', { local: 58 }, [], 2437),
        ap('n1', 'Vodafone Hotspot', { laptop: 34 }),
      ],
      routers,
    };
    request.flush(answer);
    fixture.detectChanges();
  }

  function rows(): string[][] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'), (tr) =>
      Array.from(tr.querySelectorAll('th, td'), (cell) =>
        cell.textContent!.replace(/\s+/g, ' ').trim(),
      ),
    );
  }

  it('shows nothing until a device reports its Wi-Fi', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
    http.expectOne((r) => r.url === '/api/wifi');
  });

  it('shows which device hears which network, with only the devices whose Wi-Fi is read', () => {
    answer();
    const head = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('thead th'),
      (th) => th.textContent!.trim(),
    );
    expect(head).toEqual(['Network', 'Channel', 'Security', 'Hub', 'Laptop', 'Seen by']);
    expect(rows()).toEqual([
      ['Denhome', '36 · 5 GHz', 'WPA2/WPA3', '64 %', '98 %', '2 of 2'],
      ['Vodafone Hotspot', '36 · 5 GHz', 'Open', '–', '34 %', '1 of 2'],
    ]);
  });

  it('shows how well each device hears the home network', () => {
    answer();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.choices button',
    );
    buttons[1].click();
    fixture.detectChanges();
    expect(rows().map((r) => r.slice(0, 5))).toEqual([
      ['Hub', 'Access point 1 · near Laptop', '5 GHz', '64 %', '–'],
      ['Laptop', 'Access point 1 · near Laptop · connected', '5 GHz', '98 %', '–'],
    ]);
  });

  it('names an access point after the device it is', () => {
    answer({ b1: 'nas' });
    show(1);
    expect(rows().map((r) => r.slice(0, 2))).toEqual([
      ['Hub', 'NAS'],
      ['Laptop', 'NAS · connected'],
    ]);
  });

  /** Switches to the view of the button at index. */
  function show(index: number): HTMLElement {
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('.choices button')[index].click();
    fixture.detectChanges();
    return element;
  }

  it('shows how many routers are on each channel, and the least crowded one', () => {
    answer();
    const element = show(2);
    const bands = Array.from(element.querySelectorAll('.band'), (band) => ({
      band: band.querySelector('h3')!.textContent!.trim(),
      busy: Array.from(band.querySelectorAll('.bar'))
        .filter((bar) => bar.querySelector('.count')!.textContent!.trim() !== '')
        .map((bar) => bar.getAttribute('title')),
      home: Array.from(band.querySelectorAll('.bar.home .number'), (n) => n.textContent!.trim()),
      hint: band.querySelector('.hint')?.textContent!.trim(),
    }));
    expect(bands).toEqual([
      {
        band: '2.4 GHz',
        busy: ['Channel 6: 1 router'],
        home: ['6'],
        hint: 'Den already uses channel 6, the least crowded.',
      },
      {
        band: '5 GHz',
        busy: ['Channel 36: 2 routers'],
        home: ['36'],
        hint: 'Least crowded: channel 52. Den could move there.',
      },
    ]);
  });

  it('shows what changed in the networks', () => {
    answer();
    show(5);
    expect(rows()).toEqual([
      ['This hour', 'New network Vodafone Hotspot on channel 36.', 'Laptop'],
    ]);
  });

  it('shows how alike the devices hear the networks', () => {
    answer();
    const element = show(3);
    expect(element.querySelector('.together')!.textContent!.trim()).toBe(
      'No two devices seem to be in one place.',
    );
    expect(rows().map((r) => r.slice(0, 3))).toEqual([
      ['Hub', '–', '58 %'],
      ['Laptop', '58 %', '–'],
    ]);
    const steps = element.querySelectorAll('tbody tr:first-child .step');
    expect(steps[steps.length - 1].getAttribute('title')).toBe('This hour: 100 % like now');
    expect(steps[steps.length - 2].getAttribute('title')).toBe('1 hour ago: off or away');
  });

  it('shows where each device is, and names the place one is at', () => {
    answer();
    const element = show(4);
    http
      .expectOne((r) => r.url === '/api/wifi/places' && r.method === 'GET')
      .flush({ places: [{ name: 'Work', signals: { n1: 34, a1: 98 } }] });
    fixture.detectChanges();
    expect(rows().map((r) => r.slice(0, 2))).toEqual([
      ['Hub', 'Home · Access point 1 Name this place'],
      ['Laptop', 'Work'],
    ]);
    const steps = element.querySelectorAll('tbody tr:last-child .step');
    expect(steps[steps.length - 1].getAttribute('title')).toBe('This hour: Work');
    expect(steps[steps.length - 2].getAttribute('title')).toBe('1 hour ago: off or away');

    element.querySelector<HTMLButtonElement>('tbody tr:first-child .now button')!.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const input = element.querySelector<HTMLInputElement>('.name-place input')!;
    input.value = ' Desk ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector('.name-place')!.dispatchEvent(new Event('submit'));
    const put = http.expectOne((r) => r.url === '/api/wifi/places' && r.method === 'PUT');
    expect(put.request.body).toEqual({
      places: [
        { name: 'Work', signals: { n1: 34, a1: 98 } },
        { name: 'Desk', signals: { a1: 64, a2: 58 } },
      ],
    });
    put.flush(null);
    fixture.detectChanges();
    expect(rows().map((r) => r.slice(0, 2))).toEqual([
      ['Hub', 'Desk'],
      ['Laptop', 'Work'],
    ]);
  });

  it('removes a named place, and tells when the places could not be saved', () => {
    answer();
    const element = show(4);
    http
      .expectOne((r) => r.url === '/api/wifi/places')
      .flush({ places: [{ name: 'Work', signals: { n1: 34, a1: 98 } }] });
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.named button')!.click();
    http
      .expectOne((r) => r.url === '/api/wifi/places' && r.method === 'PUT')
      .flush('no', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(element.querySelector('.failed')!.textContent!.trim()).toBe(
      'Could not save the places. Try again.',
    );
    expect(element.querySelector('.named li')!.textContent).toContain('Work');

    element.querySelector<HTMLButtonElement>('.named button')!.click();
    http.expectOne((r) => r.url === '/api/wifi/places' && r.method === 'PUT').flush(null);
    fixture.detectChanges();
    expect(element.querySelector('.named li')!.textContent!.trim()).toBe('No places named yet.');
    expect(rows().map((r) => r.slice(0, 2))).toEqual([
      ['Hub', 'Home · Access point 1 Name this place'],
      ['Laptop', 'Home · Access point 1 Name this place'],
    ]);
  });
});
