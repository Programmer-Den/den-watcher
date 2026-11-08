import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { HistoryStore } from '../history/history-store';
import { PhoneWifi } from '../metrics/metrics';
import {
  COLORED_NETWORKS,
  FIRST_CONNECTIONS,
  PhoneWifiCard,
  WIFI_REFRESH_MS,
  wifiNetworks,
  wifiSegments,
} from './phone-wifi';

const HOUR = 3600;

/** From 8:00 to 20:00: home until 9:00, then the office twice with a café between. */
function day(): PhoneWifi {
  return {
    from: 8 * HOUR,
    to: 20 * HOUR,
    connections: [
      { ssid: 'Home', start: 0, end: 9 * HOUR },
      { ssid: 'Office', start: 10 * HOUR, end: 12 * HOUR },
      { ssid: 'Café', start: 12 * HOUR, end: 13 * HOUR },
      { ssid: 'Office', start: 13 * HOUR, end: 17 * HOUR },
    ],
  };
}

describe('wifiNetworks', () => {
  it('counts the time within the range, the longest first, each with its color', () => {
    expect(wifiNetworks(day())).toEqual([
      { ssid: 'Office', seconds: 6 * HOUR, connections: 2, color: 0 },
      { ssid: 'Café', seconds: HOUR, connections: 1, color: 1 },
      { ssid: 'Home', seconds: HOUR, connections: 1, color: 2 },
    ]);
  });

  it('gives the networks beyond the colors a grey one', () => {
    const many = day();
    many.connections = Array.from({ length: COLORED_NETWORKS + 1 }, (_, i) => ({
      ssid: `Net ${i}`,
      start: 8 * HOUR + i * 60,
      end: 8 * HOUR + i * 60 + 60 - i,
    }));
    const networks = wifiNetworks(many);
    expect(networks[COLORED_NETWORKS - 1].color).toBe(COLORED_NETWORKS - 1);
    expect(networks[COLORED_NETWORKS].color).toBe(-1);
  });
});

describe('wifiSegments', () => {
  it('places each connection along the range, cut at its edges', () => {
    const wifi = day();
    const segments = wifiSegments(wifi, wifiNetworks(wifi));
    expect(segments[0]).toEqual(
      expect.objectContaining({ ssid: 'Home', start: 0, end: 9 * HOUR, left: 0, color: 2 }),
    );
    expect(segments[0].width).toBeCloseTo(100 / 12);
    expect(segments[1].left).toBeCloseTo((200 / 12) * 1);
    expect(segments[1].width).toBeCloseTo((100 / 12) * 2);
  });
});

describe('PhoneWifiCard', () => {
  let fixture: ComponentFixture<PhoneWifiCard>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [PhoneWifiCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const devices = TestBed.inject(DeviceService);
    devices.devices.set([
      { id: 'local', name: 'Hub' },
      { id: 'pixel', name: 'Pixel', kind: 'phone' },
    ]);
    devices.selectedId.set('pixel');
    fixture = TestBed.createComponent(PhoneWifiCard);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function answer(body: PhoneWifi): void {
    const request = http.expectOne((r) => r.url === '/api/phone/wifi');
    expect(request.request.params.get('device')).toBe('pixel');
    const from = Number(request.request.params.get('from'));
    const to = Number(request.request.params.get('to'));
    expect(to - from).toBe(TestBed.inject(HistoryStore).span());
    request.flush(body);
    fixture.detectChanges();
  }

  it('shows the time on Wi-Fi, the networks and the connections, the newest first', () => {
    answer(day());
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('8 h 0 min on Wi-Fi');
    expect(text).toContain('3 networks');
    expect(fixture.nativeElement.querySelectorAll('.segment').length).toBe(4);
    const networks = fixture.nativeElement.querySelectorAll('.networks li');
    expect(networks[0].textContent).toContain('Office');
    expect(networks[0].textContent).toContain('connected 2 times');
    const times = fixture.nativeElement.querySelectorAll('.times li');
    expect(times.length).toBe(4);
    expect(times[0].textContent).toContain('Office');
    expect(times[0].textContent).toContain('4 h 0 min');
    expect(times[3].textContent).toContain('Home');
    expect(fixture.nativeElement.querySelector('.more')).toBeNull();
  });

  it('lists the first connections until all are asked for', () => {
    const busy = day();
    busy.connections = Array.from({ length: FIRST_CONNECTIONS + 3 }, (_, i) => ({
      ssid: i % 2 ? 'Home' : 'Office',
      start: 8 * HOUR + i * 600,
      end: 8 * HOUR + i * 600 + 300,
    }));
    answer(busy);
    expect(fixture.nativeElement.querySelectorAll('.times li').length).toBe(FIRST_CONNECTIONS);
    (fixture.nativeElement.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.times li').length).toBe(FIRST_CONNECTIONS + 3);
  });

  it('tells how to allow it when the phone sent none', () => {
    answer({ from: 0, to: HOUR, connections: [] });
    expect(fixture.nativeElement.textContent).toContain('allow the Wi-Fi networks');
  });

  it('keeps the connections open and does not read again when the list of devices is read', () => {
    const busy = day();
    busy.connections = Array.from({ length: FIRST_CONNECTIONS + 3 }, (_, i) => ({
      ssid: i % 2 ? 'Home' : 'Office',
      start: 8 * HOUR + i * 600,
      end: 8 * HOUR + i * 600 + 300,
    }));
    answer(busy);
    (fixture.nativeElement.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    // The list of devices is read every few seconds, each time with new objects.
    const devices = TestBed.inject(DeviceService);
    devices.devices.set(devices.devices().map((d) => ({ ...d })));
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    expect(fixture.nativeElement.querySelectorAll('.times li').length).toBe(FIRST_CONNECTIONS + 3);
  });

  it('reads it again after a while and for another range', () => {
    answer(day());
    vi.advanceTimersByTime(WIFI_REFRESH_MS);
    answer(day());
    TestBed.inject(HistoryStore).span.set(24 * HOUR);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    answer(day());
  });
});
