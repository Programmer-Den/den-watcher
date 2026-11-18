import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { WiFiPosition, WiFiPositions } from '../metrics/metrics';
import { LIST_PLACES, POSITIONS_REFRESH_MS, WifiPositionsView, bandsText } from './wifi-positions';

function place(lat: number, scans: number, extra: Partial<WiFiPosition> = {}): WiFiPosition {
  return {
    lat,
    lon: 10,
    anchorLat: lat,
    anchorLon: 10,
    scans,
    first: 1000,
    last: 2000,
    devices: ['pixel'],
    networks: [
      {
        ssid: 'Cafe',
        signalPercent: 60,
        last: 2000,
        devices: [{ device: 'pixel', signalPercent: 60, last: 2000, scans }],
      },
    ],
    ...extra,
  };
}

function answer(): WiFiPositions {
  return {
    from: 0,
    to: 86400,
    places: [
      place(53.57, 12, {
        devices: ['pixel', 'galaxy'],
        networks: [
          {
            ssid: 'Den',
            accessPoints: 2,
            frequenciesMHz: [2437, 5180],
            security: 'WPA2/WPA3',
            signalPercent: 92,
            last: 2000,
            connected: true,
            devices: [
              { device: 'galaxy', signalPercent: 92, last: 2000, scans: 4 },
              { device: 'pixel', signalPercent: 70, last: 1900, scans: 8 },
            ],
          },
          {
            id: 'abc',
            signalPercent: 20,
            last: 1500,
            devices: [{ device: 'gone', signalPercent: 20, last: 1500, scans: 1 }],
          },
        ],
        related: [{ place: 1, shared: 1, percent: 33 }],
      }),
      place(53.56, 3),
    ],
  };
}

describe('the bands of a network', () => {
  it('names each band once, lowest first', () => {
    TestBed.configureTestingModule({});
    const i18n = TestBed.inject(I18n);
    expect(bandsText([5180, 2437, 2412], i18n)).toBe('2.4 GHz · 5 GHz');
    expect(bandsText(undefined, i18n)).toBe('');
  });
});

describe('the Wi-Fi networks by position', () => {
  let fixture: ComponentFixture<WifiPositionsView>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [WifiPositionsView],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DeviceService).devices.set([
      { id: 'local', name: 'Hub' },
      { id: 'pixel', name: 'Pixel', kind: 'phone' },
      { id: 'galaxy', name: 'Galaxy', kind: 'phone' },
    ]);
    fixture = TestBed.createComponent(WifiPositionsView);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function reply(body: WiFiPositions, seconds = 86400): void {
    const request = http.expectOne((r) => r.url === '/api/wifi/positions');
    const from = Number(request.request.params.get('from'));
    const to = Number(request.request.params.get('to'));
    expect(to - from).toBe(seconds);
    request.flush(body);
    fixture.detectChanges();
  }

  it('shows the places on the map and the networks of the most scanned one from all phones', () => {
    reply(answer());
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('g.place').length).toBe(2);
    expect(element.querySelector('g.place.picked text')?.textContent).toBe('1');
    expect(element.querySelectorAll('.places li').length).toBe(2);
    expect(element.querySelector('.picked-place h3')?.textContent).toContain('Place 1');
    expect(element.querySelector('.picked-place')?.textContent).toContain(
      'scanned by Pixel, Galaxy',
    );
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Den');
    expect(rows[0].textContent).toContain('2.4 GHz · 5 GHz · WPA2/WPA3 · 2 access points');
    expect(rows[0].textContent).toContain('connected');
    const sightings = rows[0].querySelectorAll('.sighting');
    expect(sightings[0].textContent).toContain('Galaxy');
    expect(sightings[1].textContent).toContain('Pixel');
    // A hidden network, heard by a phone removed since, which keeps its id.
    expect(rows[1].textContent).toContain('Hidden network');
    expect(rows[1].textContent).toContain('gone');
    // The related place, linked on the map, which a click picks.
    expect(element.querySelectorAll('line.related').length).toBe(1);
    const chip = element.querySelector<HTMLButtonElement>('.related-list .chip')!;
    expect(chip.textContent).toContain('Place 2 · 33 % (1 shared)');
    chip.click();
    fixture.detectChanges();
    expect(element.querySelector('.picked-place h3')?.textContent).toContain('Place 2');
    expect(element.querySelector('g.place.picked text')?.textContent).toBe('2');
  });

  it('keeps the picked place when the places are read again', () => {
    reply(answer());
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('.places .pick')[1].click();
    fixture.detectChanges();
    vi.advanceTimersByTime(POSITIONS_REFRESH_MS);
    const again = answer();
    again.places.reverse();
    // A new scan there moved its middle a few meters.
    again.places[0].lat += 0.0002;
    reply(again);
    expect(element.querySelector('.picked-place')?.textContent).toContain('Place 1');
    expect(element.querySelector('tbody tr')?.textContent).toContain('Cafe');
  });

  it('keeps the picked place by its first scan when its middle moves next to another', () => {
    reply(answer());
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('.places .pick')[1].click();
    fixture.detectChanges();
    vi.advanceTimersByTime(POSITIONS_REFRESH_MS);
    const again = answer();
    // Place 2's middle moved right onto place 1's; its first scan did not.
    again.places[1].lat = again.places[0].lat;
    reply(again);
    expect(element.querySelector('.picked-place h3')?.textContent).toContain('Place 2');
  });

  it('picks the place drawn on top when places are close on the map', () => {
    reply(answer());
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLButtonElement>('.places .pick')[1].click();
    fixture.detectChanges();
    // The picked place is drawn last, so its click circle is the one on top.
    const groups = element.querySelectorAll('g.place');
    const top = groups[groups.length - 1];
    expect(top.classList).toContain('picked');
    expect(top.querySelector('circle.hit title')?.textContent).toContain('Place 2');
    groups[0].querySelector<SVGCircleElement>('circle.hit')!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(element.querySelector('.picked-place h3')?.textContent).toContain('Place 1');
  });

  it('tells when the places could not be read again and greys out the old ones', () => {
    reply(answer());
    const element = fixture.nativeElement as HTMLElement;
    vi.advanceTimersByTime(POSITIONS_REFRESH_MS);
    http
      .expectOne((r) => r.url === '/api/wifi/positions')
      .flush('', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Could not read the places');
    expect(element.querySelector('.overview')?.classList).toContain('stale');
    vi.advanceTimersByTime(POSITIONS_REFRESH_MS);
    reply(answer());
    expect(element.textContent).not.toContain('Could not read the places');
    expect(element.querySelector('.overview')?.classList).not.toContain('stale');
  });

  it('lists the first places until all are asked for', () => {
    const many = {
      ...answer(),
      places: Array.from({ length: LIST_PLACES + 3 }, (_, i) => place(50 + i / 100, 20 - i)),
    };
    reply(many);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.places li').length).toBe(LIST_PLACES);
    element.querySelector<HTMLButtonElement>('.places .link')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.places li').length).toBe(LIST_PLACES + 3);
  });

  it('reads the picked range and tells when there are no places or they could not be read', () => {
    reply({ from: 0, to: 1, places: [] });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('No Wi-Fi scans with a position');
    element.querySelectorAll<HTMLButtonElement>('.choices button')[1].click();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    http
      .expectOne((r) => r.url === '/api/wifi/positions')
      .flush('', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Could not read the places');
  });
});
