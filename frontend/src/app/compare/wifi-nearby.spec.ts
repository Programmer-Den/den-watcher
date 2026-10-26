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

  /** Answers the read with the hub and the laptop seeing two radios of Den and a neighbour. */
  function answer(): void {
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
});
