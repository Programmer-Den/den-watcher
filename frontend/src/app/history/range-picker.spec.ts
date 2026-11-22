import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { History } from '../metrics/metrics';
import { HistoryStore } from './history-store';
import { RangePicker } from './range-picker';

const NOW = new Date('2026-10-02T20:00:00Z');
const NOW_SECONDS = NOW.getTime() / 1000;

function historyFor(from: number, to: number, retentionDays: number): History {
  return {
    from,
    to,
    stepSeconds: 240,
    retentionDays,
    series: [
      { metric: 'cpu', points: [{ time: from, value: 12.5 }] },
      { metric: 'memory', points: [{ time: from, value: 40 }] },
    ],
  };
}

describe('RangePicker', () => {
  let fixture: ComponentFixture<RangePicker>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({
      imports: [RangePicker],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    // The week before is read in a test of its own.
    TestBed.inject(HistoryStore).weekBefore.set(false);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RangePicker);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  /** Answers the pending history request and returns the range it asked for. */
  function respond(retentionDays = 30): { from: number; to: number } {
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    const request = http.expectOne((r) => r.url === '/api/history');
    const from = Number(request.request.params.get('from'));
    const to = Number(request.request.params.get('to'));
    request.flush(historyFor(from, to, retentionDays));
    fixture.detectChanges();
    return { from, to };
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function labels(selector: string): string[] {
    return Array.from(element().querySelectorAll(selector)).map((b) => b.textContent?.trim() ?? '');
  }

  function click(selector: string, label: string): void {
    const buttons = Array.from(element().querySelectorAll<HTMLButtonElement>(selector));
    buttons.find((b) => b.textContent?.trim() === label)?.click();
  }

  const UNIT = '.units button';
  const RANGE = '.ranges button';

  it('shows the last 30 minutes and refreshes them every 5 seconds', () => {
    expect(respond()).toEqual({ from: NOW_SECONDS - 30 * 60, to: NOW_SECONDS });
    expect(labels(RANGE)).toEqual(['1 min', '5 min', '10 min', '30 min']);
    expect(element().querySelector('.units [aria-pressed="true"]')?.textContent?.trim()).toBe(
      'Minutes',
    );
    expect(element().querySelector('.ranges [aria-pressed="true"]')?.textContent?.trim()).toBe(
      '30 min',
    );

    vi.advanceTimersByTime(5_000);
    expect(respond().to).toBe(NOW_SECONDS + 5);
  });

  it('shows the longest range of a chosen unit, then the chosen range', () => {
    respond();

    click(UNIT, 'Hours');
    expect(respond()).toEqual({ from: NOW_SECONDS - 12 * 3600, to: NOW_SECONDS });
    expect(labels(RANGE)).toEqual(['1 h', '3 h', '6 h', '12 h']);

    click(UNIT, 'Days');
    expect(respond()).toEqual({ from: NOW_SECONDS - 30 * 86400, to: NOW_SECONDS });
    expect(labels(RANGE)).toEqual(['1 d', '7 d', '14 d', '30 d']);

    click(UNIT, 'Minutes');
    expect(respond()).toEqual({ from: NOW_SECONDS - 30 * 60, to: NOW_SECONDS });
    expect(labels(RANGE)).toEqual(['1 min', '5 min', '10 min', '30 min']);

    click(RANGE, '1 min');
    expect(respond()).toEqual({ from: NOW_SECONDS - 60, to: NOW_SECONDS });
    // Short ranges are read again every 5 seconds.
    vi.advanceTimersByTime(5_000);
    expect(respond().to).toBe(NOW_SECONDS + 5);
  });

  it('skips a refresh while the previous answer is still on its way', () => {
    respond();
    click(UNIT, 'Days');
    respond();
    click(RANGE, '1 d');
    respond();
    vi.advanceTimersByTime(60_000);
    const slow = http.expectOne((r) => r.url === '/api/history');

    vi.advanceTimersByTime(60_000);
    http.expectNone((r) => r.url === '/api/history');

    slow.flush(historyFor(NOW_SECONDS - 86400 + 60, NOW_SECONDS + 60, 30));
    vi.advanceTimersByTime(60_000);
    expect(respond().to).toBe(NOW_SECONDS + 180);
  });

  it('offers all data when more than 30 days are kept', () => {
    respond();
    expect(labels(UNIT)).toEqual(['Minutes', 'Hours', 'Days']);

    vi.advanceTimersByTime(5_000);
    respond(90);
    expect(labels(UNIT)).toEqual(['Minutes', 'Hours', 'Days', 'All']);

    click(UNIT, 'All');
    expect(respond(90).from).toBe(NOW_SECONDS + 5 - 90 * 86400);
    expect(labels(RANGE)).toEqual([]);
  });

  it('writes the year in the period of a range over a year', () => {
    respond(400);
    expect(element().querySelector('.period')?.textContent).not.toContain('2026');

    click(UNIT, 'All');
    respond(400);
    const period = element().querySelector('.period')?.textContent ?? '';
    expect(period).toContain('2025');
    expect(period).toContain('2026');
  });

  it('offers only ranges within the retention', () => {
    respond(7);
    expect(labels(UNIT)).toEqual(['Minutes', 'Hours', 'Days']);
    click(UNIT, 'Days');
    respond(7);
    expect(labels(RANGE)).toEqual(['1 d', '7 d']);
  });

  it('offers all data when more is kept than the longest range within the retention', () => {
    respond(10);
    expect(labels(UNIT)).toEqual(['Minutes', 'Hours', 'Days', 'All']);
    click(UNIT, 'Days');
    respond(10);
    expect(labels(RANGE)).toEqual(['1 d', '7 d']);

    click(UNIT, 'All');
    expect(respond(10).from).toBe(NOW_SECONDS - 10 * 86400);
  });

  it('shows the longest range offered when the picked one is longer than the retention', () => {
    respond();
    click(UNIT, 'Days');
    // The 30 days were picked before the backend said it keeps 10.
    expect(respond(10).from).toBe(NOW_SECONDS - 30 * 86400);

    expect(respond(10).from).toBe(NOW_SECONDS - 10 * 86400);
    expect(element().querySelector('.units button[aria-pressed=true]')?.textContent?.trim()).toBe(
      'All',
    );
  });

  it('downloads the period shown as CSV', () => {
    fixture.detectChanges();
    expect(element().querySelector('app-csv-download')).toBeNull();
    const { from, to } = respond();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    element().querySelector<HTMLButtonElement>('app-csv-download button')!.click();
    const request = http.expectOne((r) => r.url === '/api/history.csv');
    expect(request.request.params.get('from')).toBe(String(from));
    expect(request.request.params.get('to')).toBe(String(to));
    request.flush(new Blob(['time\r\n']));
    vi.advanceTimersByTime(0);
    vi.restoreAllMocks();
  });

  it('shows another device without the error or the period of the previous one', () => {
    respond();
    vi.advanceTimersByTime(5_000);
    http
      .expectOne((r) => r.url === '/api/history')
      .flush('', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(element().querySelector('[role=alert]')).not.toBeNull();

    TestBed.inject(DeviceService).selectedId.set('living-room-pi');
    fixture.detectChanges();
    expect(element().querySelector('[role=alert]')).toBeNull();
    expect(element().querySelector('.period')?.textContent?.trim()).toBe('');
    respond();
  });

  it('keeps the chosen "All" range while another device loads', () => {
    respond(10);
    click(UNIT, 'All');
    respond(10);

    TestBed.inject(DeviceService).selectedId.set('living-room-pi');
    fixture.detectChanges();
    expect(labels(UNIT)).toEqual(['Minutes', 'Hours', 'Days', 'All']);
    expect(element().querySelector('.units button[aria-pressed=true]')?.textContent?.trim()).toBe(
      'All',
    );
    respond(10);
  });

  it('reads the history of the picked device', () => {
    respond();

    TestBed.inject(DeviceService).selectedId.set('living-room-pi');
    fixture.detectChanges();
    vi.advanceTimersByTime(0);

    const request = http.expectOne((r) => r.url === '/api/history');
    expect(request.request.params.get('device')).toBe('living-room-pi');
    request.flush(historyFor(NOW_SECONDS - 30 * 60, NOW_SECONDS, 30));
  });

  it('says when nothing was recorded in the range', () => {
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    http
      .expectOne((r) => r.url === '/api/history')
      .flush({ ...historyFor(NOW_SECONDS - 1800, NOW_SECONDS, 30), series: [] });
    fixture.detectChanges();
    expect(element().querySelector('.detail')?.textContent).toContain('No usage recorded');

    vi.advanceTimersByTime(5_000);
    respond();
    expect(element().querySelector('.detail')).toBeNull();
  });

  it('says the charts are not live when they end at the last reading', () => {
    respond();
    expect(element().querySelector('[role=status]')).toBeNull();

    vi.advanceTimersByTime(5_000);
    const last = NOW_SECONDS - 3 * 3600;
    const unanswered = { ...historyFor(last + 1 - 30 * 60, last + 1, 30), lastReading: last };
    http.expectOne((r) => r.url === '/api/history').flush(unanswered);
    // The read of the newest steps found the device not answering, so the whole range is read.
    http.expectOne((r) => r.url === '/api/history').flush(unanswered);
    fixture.detectChanges();

    expect(element().querySelector('[role=status]')?.textContent).toContain('Not live');
  });
});
