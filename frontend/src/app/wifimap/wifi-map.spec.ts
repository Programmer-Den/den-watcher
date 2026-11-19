import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { WiFiPosition, WiFiPositions } from '../metrics/metrics';
import { bandsText } from './place-detail';
import { LIST_PLACES, POSITIONS_REFRESH_MS, WifiMap } from './wifi-map';

function place(lat: number, scans: number, extra: Partial<WiFiPosition> = {}): WiFiPosition {
  return {
    lat,
    lon: 10,
    id: Math.round(lat * 100),
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
    to: 7 * 86400,
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

describe('the Wi-Fi map', () => {
  let fixture: ComponentFixture<WifiMap>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [WifiMap],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DeviceService).devices.set([
      { id: 'local', name: 'Hub' },
      { id: 'pixel', name: 'Pixel', kind: 'phone' },
      { id: 'galaxy', name: 'Galaxy', kind: 'phone' },
    ]);
    fixture = TestBed.createComponent(WifiMap);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function reply(body: WiFiPositions, seconds = 7 * 86400): void {
    const request = http.expectOne((r) => r.method === 'GET' && r.url === '/api/wifi/positions');
    const from = Number(request.request.params.get('from'));
    const to = Number(request.request.params.get('to'));
    expect(to - from).toBe(seconds);
    request.flush(body);
    fixture.detectChanges();
  }

  function heading(): string {
    return element.querySelector('app-place-detail h3')?.textContent?.trim() ?? '';
  }

  function pick(index: number): void {
    element.querySelectorAll<HTMLButtonElement>('.places .pick')[index].click();
    fixture.detectChanges();
  }

  function button(text: string): HTMLButtonElement {
    const found = [...element.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(text),
    );
    expect(found, text).toBeTruthy();
    return found!;
  }

  it('shows the places on the map and the networks of the first one from all phones', () => {
    reply(answer());
    expect(element.querySelectorAll('g.place').length).toBe(2);
    expect(element.querySelector('g.place.picked text')?.textContent).toBe('Place 5357');
    expect(element.querySelectorAll('.places li').length).toBe(2);
    expect(element.querySelector('.places')?.textContent?.replace(/\s+/g, ' ')).toContain(
      '2 Wi-Fi networks · Den',
    );
    expect(heading()).toBe('Place 5357');
    const tiles = element.querySelector('.tiles')!.textContent!;
    expect(tiles).toContain('Pixel, Galaxy');
    // The network a phone was connected to.
    expect(tiles).toContain('92 %');
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Den');
    expect(rows[0].textContent).toContain('2.4 GHz · 5 GHz · WPA2/WPA3 · 2 access points');
    expect(rows[0].textContent).toContain('connected');
    expect(rows[0].textContent).toContain('12 of 12 scans');
    const sightings = rows[0].querySelectorAll('.sighting');
    expect(sightings[0].textContent).toContain('Galaxy');
    expect(sightings[1].textContent).toContain('Pixel');
    // A hidden network, heard by a phone removed since, which keeps its id.
    expect(rows[1].textContent).toContain('Hidden network');
    expect(rows[1].textContent).toContain('gone');
    expect(rows[1].textContent).toContain('1 of 12 scans');
    // The related place, linked on the map, which a click picks.
    expect(element.querySelectorAll('line.related').length).toBe(1);
    const chip = element.querySelector<HTMLButtonElement>('.related-list .chip')!;
    expect(chip.textContent).toContain('Place 5356 · 33 % (1 shared)');
    chip.click();
    fixture.detectChanges();
    expect(heading()).toBe('Place 5356');
    expect(element.querySelector('g.place.picked text')?.textContent).toBe('Place 5356');
  });

  it('lists the named places first, by their names', () => {
    const named = answer();
    named.places.unshift(place(53.5, 2, { name: 'Café Nord' }));
    reply(named);
    const headings = [...element.querySelectorAll('.places h3')].map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Named', 'Other places']);
    expect(element.querySelectorAll('.places .pick')[0].textContent).toContain('Café Nord');
    expect(element.querySelector('g.place.named text')?.textContent).toBe('Café Nord');
    expect(heading()).toBe('Café Nord');
  });

  it('finds places by their names and those of their networks', () => {
    const named = answer();
    named.places[1].name = 'Gym';
    reply(named);
    const search = element.querySelector<HTMLInputElement>('input.search')!;
    search.value = 'den';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelectorAll('.places .pick').length).toBe(1);
    expect(element.querySelector('.places .pick')?.textContent).toContain('Place 5357');
    search.value = 'gym';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('.places .pick')?.textContent).toContain('Gym');
    search.value = 'nowhere';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelector('.places')?.textContent).toContain('No place or network');
  });

  it('keeps the picked place by its id when the places are read again or the range changes', () => {
    reply(answer());
    pick(1);
    vi.advanceTimersByTime(POSITIONS_REFRESH_MS);
    const again = answer();
    again.places.reverse();
    again.places[0].lat += 0.002;
    reply(again);
    expect(heading()).toBe('Place 5356');
    element.querySelectorAll<HTMLButtonElement>('.choices button')[2].click();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    reply(answer(), 30 * 86400);
    expect(heading()).toBe('Place 5356');
    expect(element.querySelector('tbody tr')?.textContent).toContain('Cafe');
  });

  it('draws places close together as one numbered circle, which zooms in on them', () => {
    const close = answer();
    close.places.push(place(53.56001, 2, { id: 7 }), place(53.56002, 1, { id: 8 }));
    reply(close);
    const cluster = element.querySelector('circle.cluster')!.parentElement!;
    expect(cluster.querySelector('text')?.textContent).toBe('3');
    cluster.querySelector<SVGCircleElement>('circle.hit')!.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(element.querySelector<HTMLButtonElement>('app-map-frame .whole')!.disabled).toBe(false);
    // A place picked in the list is never part of one.
    pick(3);
    expect(element.querySelector('g.place.picked text')?.textContent).toBe('Place 8');
  });

  it('names a place, and tells when the hub refuses the name', () => {
    reply(answer());
    button('Name it').click();
    fixture.detectChanges();
    const input = element.querySelector<HTMLInputElement>('.rename input')!;
    input.value = '  Home ';
    button('Save').click();
    fixture.detectChanges();
    const put = http.expectOne('/api/wifi/positions/5357/name');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ name: 'Home' });
    put.flush(null);
    const named = answer();
    named.places[0].name = 'Home';
    reply(named);
    expect(heading()).toBe('Home');

    button('Rename').click();
    fixture.detectChanges();
    button('Save').click();
    http
      .expectOne('/api/wifi/positions/5357/name')
      .flush({ problem: 'request', message: 'taken' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(element.querySelector('.problem')?.textContent).toContain('Another place has this name');
  });

  it('suggests merging the places that are likely the same, or keeping them apart', () => {
    const same = answer();
    // 60 % alike and 55 m apart: likely the same.
    same.places[1] = place(53.5705, 3, { id: 99 });
    same.places[0].related = [{ place: 1, shared: 3, percent: 60 }];
    reply(same);
    expect(element.querySelector('.same')?.textContent).toContain(
      'Looks like the same place as Place 99: 60 % alike, 56 m away.',
    );
    // The one with fewer scans is merged into the other.
    button('Merge into Place 5357').click();
    const merge = http.expectOne('/api/wifi/positions/99/merged-into');
    expect(merge.request.body).toEqual({ into: 5357 });
    merge.flush(null);
    reply(same);

    button('Keep apart').click();
    const apart = http.expectOne('/api/wifi/positions/5357/apart');
    expect(apart.request.method).toBe('POST');
    expect(apart.request.body).toEqual({ other: 99 });
    apart.flush(null);
    const kept = answer();
    kept.places[1] = place(53.5705, 3, { id: 99 });
    kept.places[0].related = [{ place: 1, shared: 3, percent: 60 }];
    kept.places[0].apart = [99];
    reply(kept);
    expect(element.querySelector('.same')).toBeNull();
  });

  it('splits a place merged into the picked one off again', () => {
    const merged = answer();
    merged.places[0].merged = [42];
    reply(merged);
    button('Place 42 · split off').click();
    const split = http.expectOne('/api/wifi/positions/42/merged-into');
    expect(split.request.body).toEqual({ into: null });
    split.flush(null);
    reply(answer());
    expect(element.textContent).not.toContain('split off');
  });

  it('zooms the map and follows a place picked in the list', () => {
    reply(answer());
    const at = () => element.querySelector('g.place.picked')!.getAttribute('transform');
    const zoomIn = element.querySelector<HTMLButtonElement>('app-map-frame .zoom button')!;
    zoomIn.click();
    zoomIn.click();
    fixture.detectChanges();
    pick(1);
    expect(at()).toBe('translate(400 260)');
  });

  it('tells when the places could not be read again and greys out the old ones', () => {
    reply(answer());
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
      places: Array.from({ length: LIST_PLACES + 3 }, (_, i) => place(50 + i / 10, 20 - i)),
    };
    reply(many);
    expect(element.querySelectorAll('.places li').length).toBe(LIST_PLACES);
    element.querySelector<HTMLButtonElement>('.places .link')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.places li').length).toBe(LIST_PLACES + 3);
  });

  it('reads the picked range and tells when there are no places or they could not be read', () => {
    reply({ from: 0, to: 1, places: [] });
    expect(element.textContent).toContain('No Wi-Fi scans with a position');
    element.querySelectorAll<HTMLButtonElement>('.choices button')[0].click();
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    http
      .expectOne((r) => r.url === '/api/wifi/positions')
      .flush('', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Could not read the places');
  });
});
