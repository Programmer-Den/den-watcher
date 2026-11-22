import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { History } from '../metrics/metrics';
import { ChartCanvas } from './chart-canvas';
import { HistoryStore, refreshIntervalMs } from './history-store';
import { Timeline } from './timeline';

const HISTORY: History = {
  from: 0,
  to: 300,
  stepSeconds: 100,
  retentionDays: 30,
  series: [
    {
      metric: 'cpu',
      points: [
        { time: 0, value: 10 },
        { time: 100, value: 50 },
        { time: 200, value: 20 },
      ],
    },
    { metric: 'memory', points: [{ time: 0, value: 40 }] },
    { metric: 'disk:/', points: [{ time: 200, value: 30 }] },
  ],
};

describe('Timeline', () => {
  let fixture: ComponentFixture<Timeline>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [Timeline],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    // The week before is read in a test of its own.
    TestBed.inject(HistoryStore).weekBefore.set(false);
    http = TestBed.inject(HttpTestingController);
    // The range of HISTORY: a short range starts a span before the end the backend answers.
    TestBed.inject(HistoryStore).span.set(HISTORY.to - HISTORY.from);
    fixture = TestBed.createComponent(Timeline);
  });

  function show(history: History = HISTORY): void {
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    http.expectOne((r) => r.url === '/api/history').flush(history);
    fixture.detectChanges();
  }

  afterEach(() => {
    // The marks of the charts are read alongside the history; these tests leave them unanswered.
    http.match((r) => r.url === '/api/events');
    http.verify();
    vi.useRealTimers();
  });

  function rows(): string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-timeline-row'),
      (row) =>
        `${row.querySelector('.label')!.textContent!.trim()}: ${row.querySelector('.value')!.textContent!.trim()}`,
    );
  }

  function point(row: number, fraction: number): void {
    const strip = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      'app-timeline-row .strip',
    )[row];
    strip.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    strip.dispatchEvent(new PointerEvent('pointermove', { clientX: fraction * 300 }));
    fixture.detectChanges();
  }

  it('shows every value as a row with its latest value, in the order of the categories', () => {
    show();
    expect(rows()).toEqual(['CPU: 20 %', 'Memory: 40 %', 'Disks: 30 %']);
  });

  it('shows every value at the time under the pointer, with a line across all rows', () => {
    show();
    point(2, 0.5);
    expect(rows()).toEqual(['CPU: 50 %', 'Memory: –', 'Disks: –']);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--cursor')).toBe('50%');
    expect(host.style.getPropertyValue('--cursor-display')).toBe('block');

    (host.querySelector('app-timeline-row .strip') as HTMLElement).dispatchEvent(
      new PointerEvent('pointerleave'),
    );
    fixture.detectChanges();
    expect(rows()[0]).toBe('CPU: 20 %');
    expect(host.style.getPropertyValue('--cursor-display')).toBe('none');
  });

  it('marks what happened in a row above the values, and tells it at the pointer', () => {
    show();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-timeline-marks .label')!.textContent!.trim()).toBe('Events');
    http
      .expectOne((r) => r.url === '/api/events')
      .flush({
        from: 0,
        to: 300,
        events: [
          { kind: 'reboot', time: 120 },
          { kind: 'update', time: 900, detail: '9.9.9' },
        ],
      });
    fixture.detectChanges();
    const marks = host.querySelector('app-timeline-marks')!;
    expect(marks.querySelector('.label')!.textContent!.trim()).toBe('Events');
    expect(marks.querySelectorAll('.marker').length).toBe(1);

    point(0, 0.5);
    expect(marks.querySelector('.label')!.textContent!.trim()).toBe('Restarted');
    expect(rows()[0]).toBe('CPU: 50 %');
  });

  it('forgets the time under the pointer once the range no longer has it', () => {
    show();
    point(0, 0.5);
    vi.advanceTimersByTime(5_000);
    // The next read is of the newest steps only, which move the range on to now.
    const now = Math.floor(Date.now() / 1000);
    http
      .expectOne((r) => r.url === '/api/history')
      .flush({
        ...HISTORY,
        from: 200,
        to: now,
        series: [{ metric: 'cpu', points: [{ time: now - 100, value: 20 }] }],
      });
    fixture.detectChanges();
    expect(rows()[0]).toBe('CPU: 20 %');
    expect((fixture.nativeElement as HTMLElement).style.getPropertyValue('--cursor-display')).toBe(
      'none',
    );
  });

  it('colors the lines after the eighth from the start of the palette again', () => {
    show({
      ...HISTORY,
      series: Array.from({ length: 9 }, (_, i) => ({
        metric: `temperature:sensor${i}`,
        points: [{ time: 0, value: 40 }],
      })),
    });
    const series = fixture.debugElement
      .queryAll(By.css('app-timeline-row app-sparkline canvas'))
      .map((canvas) => canvas.injector.get(ChartCanvas).lines()[0].series);
    expect(series[8]).toBe(0);
  });

  const ZOOMED: History = {
    ...HISTORY,
    from: 60,
    to: 180,
    stepSeconds: 20,
    series: [
      { metric: 'cpu', points: [{ time: 160, value: 90 }] },
      { metric: 'memory', points: [{ time: 160, value: 45 }] },
    ],
  };

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Drags across the rows from one fraction of the time axis to another. */
  function brush(from: number, to: number): void {
    const rows = host().querySelector<HTMLElement>('.rows')!;
    for (const strip of Array.from(rows.querySelectorAll<HTMLElement>('.strip'))) {
      strip.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    }
    const strip = rows.querySelector('.strip')!;
    strip.dispatchEvent(new PointerEvent('pointerdown', { clientX: from * 300, bubbles: true }));
    rows.dispatchEvent(new PointerEvent('pointermove', { clientX: to * 300 }));
    fixture.detectChanges();
    rows.dispatchEvent(new PointerEvent('pointerup', { clientX: to * 300 }));
    fixture.detectChanges();
  }

  function trail(): string[] {
    return Array.from(host().querySelectorAll('.trail > button'), (b) => b.textContent!.trim());
  }

  function zoomedRequest(): Record<string, string | null> {
    const request = http.expectOne((r) => r.url === '/api/history');
    const params = request.request.params;
    request.flush(ZOOMED);
    fixture.detectChanges();
    return { from: params.get('from'), to: params.get('to') };
  }

  it('opens on the whole range, with the window over the whole strip', () => {
    show();
    const window = host().querySelector<HTMLElement>('app-timeline-overview .window')!;
    expect(window.style.left).toBe('0%');
    expect(window.style.width).toBe('100%');
    expect(trail()).toEqual(['Whole range']);
    expect(host().querySelector('.trail .hint')!.textContent).toContain('Drag across a row');
  });

  it('zooms every row into the stretch dragged across, and goes back', () => {
    show();
    brush(0.2, 0.6);
    expect(zoomedRequest()).toEqual({ from: '60', to: '180' });
    expect(rows()).toEqual(['CPU: 90 %', 'Memory: 45 %']);
    expect(trail().length).toBe(3);
    expect(trail().at(-1)).toContain('Back');
    // The stretch zoomed into can be downloaded; the whole range is, next to the range picker.
    expect(host().querySelector('.trail app-csv-download')!.textContent).toContain('Download CSV');
    const window = host().querySelector<HTMLElement>('app-timeline-overview .window')!;
    expect(window.style.left).toBe('20%');
    expect(window.style.width).toBe('40%');

    host().querySelector<HTMLButtonElement>('.trail .back')!.click();
    fixture.detectChanges();
    expect(rows()).toEqual(['CPU: 20 %', 'Memory: 40 %', 'Disks: 30 %']);
    expect(trail()).toEqual(['Whole range']);
    expect(host().querySelector('app-csv-download')).toBeNull();
  });

  it('keeps the trail on a stretch it could not read, and reads it again with the whole range', () => {
    show();
    brush(0.2, 0.6);
    zoomedRequest();
    const zoomedOnce = trail();
    brush(0.2, 0.6);
    const zoomedTwice = trail();
    expect(zoomedTwice.length).toBe(zoomedOnce.length + 1);
    const failed = http.expectOne((r) => r.url === '/api/history');
    const { params } = failed.request;
    failed.flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(trail()).toEqual(zoomedTwice);
    expect(rows()).toEqual([]);
    expect(host().querySelector('.nothing')!.textContent).toContain('cannot be read');

    // The whole range is read again, and with it the stretch.
    vi.advanceTimersByTime(refreshIntervalMs(HISTORY.to - HISTORY.from));
    http.expectOne((r) => r.url === '/api/history').flush(HISTORY);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    expect(zoomedRequest()).toEqual({ from: params.get('from'), to: params.get('to') });
    expect(trail()).toEqual(zoomedTwice);
    expect(rows()).toEqual(['CPU: 90 %', 'Memory: 45 %']);
    expect(host().querySelector('.nothing')).toBeNull();
  });

  it('keeps the trail in a stretch without readings, and says nothing was recorded', () => {
    show();
    brush(0.2, 0.6);
    http.expectOne((r) => r.url === '/api/history').flush({ ...ZOOMED, series: [] });
    fixture.detectChanges();

    expect(rows()).toEqual([]);
    expect(host().querySelector('.nothing')!.textContent).toContain('Nothing was recorded');
    expect(trail().at(-1)).toContain('Back');

    host().querySelector<HTMLButtonElement>('.trail .back')!.click();
    fixture.detectChanges();
    expect(rows()).toEqual(['CPU: 20 %', 'Memory: 40 %', 'Disks: 30 %']);
    expect(host().querySelector('.nothing')).toBeNull();
  });

  it('takes a short drag across the rows for a click', () => {
    show();
    brush(0.5, 0.502);
    expect(trail()).toEqual(['Whole range']);
  });

  it('shows the whole range again when another range is picked', () => {
    show();
    brush(0.2, 0.6);
    zoomedRequest();
    TestBed.inject(HistoryStore).span.set(3600);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    http.expectOne((r) => r.url === '/api/history').flush(HISTORY);
    fixture.detectChanges();
    expect(trail()).toEqual(['Whole range']);
  });

  it('zooms into a stretch drawn on the strip, and moves it with the arrow keys', () => {
    show();
    const overview = host().querySelector<HTMLElement>('app-timeline-overview')!;
    overview.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    overview.dispatchEvent(new PointerEvent('pointerdown', { clientX: 60 }));
    overview.dispatchEvent(new PointerEvent('pointermove', { clientX: 180 }));
    overview.dispatchEvent(new PointerEvent('pointerup', { clientX: 180 }));
    fixture.detectChanges();
    expect(zoomedRequest()).toEqual({ from: '60', to: '180' });

    overview
      .querySelector('.window')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(zoomedRequest()).toEqual({ from: '72', to: '192' });
    expect(trail().length).toBe(3);
  });

  it('shows nothing while the history holds no values', () => {
    show({ ...HISTORY, series: [] });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.axis')).toBeNull();
    expect(host.querySelector('app-timeline-row')).toBeNull();
  });
});
