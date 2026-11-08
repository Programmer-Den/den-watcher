import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { HistoryStore } from '../history/history-store';
import { PhoneUsage } from '../metrics/metrics';
import { FIRST_APPS, PhoneUsageCard, USAGE_REFRESH_MS, usageBars } from './phone-usage';

const HOUR = 3600;

function usage(apps: number, unlocks = 3): PhoneUsage {
  return {
    from: 10 * HOUR + 600,
    to: 13 * HOUR,
    stepSeconds: HOUR,
    screenSeconds: 1800,
    unlocks,
    steps: [
      { time: 10 * HOUR, screenSeconds: 1200, unlocks: 2 },
      { time: 12 * HOUR, screenSeconds: 600, unlocks: 1 },
    ],
    apps: Array.from({ length: apps }, (_, i) => ({
      app: `app.${i}`,
      label: i === 1 ? undefined : `App ${i}`,
      seconds: 1000 - i * 10,
      opens: i + 1,
    })),
  };
}

describe('usageBars', () => {
  it('has a bar for every step of the range, also the empty ones, as a share of the longest', () => {
    expect(usageBars(usage(1))).toEqual([
      { time: 10 * HOUR, seconds: 1200, unlocks: 2, share: 1 },
      { time: 11 * HOUR, seconds: 0, unlocks: 0, share: 0 },
      { time: 12 * HOUR, seconds: 600, unlocks: 1, share: 0.5 },
    ]);
  });
});

describe('PhoneUsageCard', () => {
  let fixture: ComponentFixture<PhoneUsageCard>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [PhoneUsageCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const devices = TestBed.inject(DeviceService);
    devices.devices.set([
      { id: 'local', name: 'Hub' },
      { id: 'pixel', name: 'Pixel', kind: 'phone' },
    ]);
    devices.selectedId.set('pixel');
    fixture = TestBed.createComponent(PhoneUsageCard);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function answer(body: PhoneUsage): void {
    const request = http.expectOne((r) => r.url === '/api/phone/usage');
    expect(request.request.params.get('device')).toBe('pixel');
    const from = Number(request.request.params.get('from'));
    const to = Number(request.request.params.get('to'));
    expect(to - from).toBe(TestBed.inject(HistoryStore).span());
    request.flush(body);
    fixture.detectChanges();
  }

  it('shows the screen time, the unlocks and the longest used apps first', () => {
    answer(usage(FIRST_APPS + 2));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('30 min');
    expect(text).toContain('3 unlocks');
    expect(text).toContain(`${FIRST_APPS + 2} apps used`);
    const rows = fixture.nativeElement.querySelectorAll('.apps li');
    expect(rows.length).toBe(FIRST_APPS);
    expect(rows[0].textContent).toContain('App 0');
    expect(rows[0].textContent).toContain('opened once');
    // Without a name, the app shows as its package.
    expect(rows[1].textContent).toContain('app.1');
    expect(fixture.nativeElement.querySelectorAll('.bar').length).toBe(3);

    (fixture.nativeElement.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.apps li').length).toBe(FIRST_APPS + 2);
  });

  it('tells the average a day for a range of two days or more', () => {
    const week = usage(1);
    week.from = 0;
    week.to = 7 * 86400;
    week.screenSeconds = 7 * 7200;
    answer(week);
    expect(fixture.nativeElement.textContent).toContain('2 h 0 min a day on average');
  });

  it('tells how to allow it when the phone sent none', () => {
    answer(usage(0, 0));
    expect(fixture.nativeElement.textContent).toContain('allow usage access');
  });

  it('keeps the apps open and does not read again when the list of devices is read', () => {
    answer(usage(FIRST_APPS + 2));
    (fixture.nativeElement.querySelector('.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    // The list of devices is read every few seconds, each time with new objects.
    const devices = TestBed.inject(DeviceService);
    devices.devices.set(devices.devices().map((d) => ({ ...d })));
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    expect(fixture.nativeElement.querySelectorAll('.apps li').length).toBe(FIRST_APPS + 2);
  });

  it('reads it again after a while and for another range', () => {
    answer(usage(1));
    vi.advanceTimersByTime(USAGE_REFRESH_MS);
    answer(usage(2));
    TestBed.inject(HistoryStore).span.set(24 * HOUR);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    answer(usage(1));
  });
});
