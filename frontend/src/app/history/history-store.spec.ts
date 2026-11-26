import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DeviceService } from '../devices/devices';
import { History, Point } from '../metrics/metrics';
import {
  HistoryStore,
  WEEK,
  WEEK_BEFORE_STORAGE_KEY,
  refreshIntervalMs,
  weekBeforeOffered,
} from './history-store';

const HISTORY: History = {
  from: 0,
  to: 1800,
  stepSeconds: 5,
  retentionDays: 30,
  series: [{ metric: 'cpu', points: [{ time: 0, value: 12.5 }] }],
};

describe('HistoryStore', () => {
  let store: HistoryStore;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(HistoryStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function tick(ms = 0): void {
    TestBed.tick();
    vi.advanceTimersByTime(ms);
  }

  const reads = () => http.match((r) => r.url === '/api/history');

  it('reads once for all watchers, and only while something watches', () => {
    const first = store.watch.subscribe();
    const second = store.watch.subscribe();
    tick();
    const [request, ...more] = reads();
    expect(more).toEqual([]);
    request.flush(HISTORY);
    expect(store.history()).toEqual(HISTORY);

    tick(5_000);
    expect(reads().length).toBe(1);

    first.unsubscribe();
    second.unsubscribe();
    tick(60_000);
    expect(reads()).toEqual([]);
  });

  it('drops the history of the device it showed when another one is picked', () => {
    const watching = store.watch.subscribe();
    tick();
    reads()[0].flush(HISTORY);

    TestBed.inject(DeviceService).selectedId.set('nas');
    tick();
    expect(store.history()).toBeNull();
    const [request] = reads();
    expect(request.request.params.get('device')).toBe('nas');

    watching.unsubscribe();
  });
});

describe('HistoryStore with the week before', () => {
  let store: HistoryStore;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem(WEEK_BEFORE_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(HistoryStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(WEEK_BEFORE_STORAGE_KEY);
    vi.useRealTimers();
  });

  function tick(ms = 0): void {
    TestBed.tick();
    vi.advanceTimersByTime(ms);
  }

  const reads = () => http.match((r) => r.url === '/api/history');

  it('reads the same range a week before for ranges from an hour to a week', () => {
    store.span.set(3600);
    const watching = store.watch.subscribe();
    tick();
    // The week before waits for the range's own answer.
    const [now, ...early] = reads();
    expect(early).toEqual([]);
    const to = Number(now.request.params.get('to'));
    now.flush({ ...HISTORY, from: to - 3600, to });
    tick();
    const [before] = reads();
    expect(Number(before.request.params.get('to'))).toBe(to - WEEK);
    expect(Number(before.request.params.get('from'))).toBe(to - WEEK - 3600);
    const earlier = { ...HISTORY, from: to - WEEK - 3600, to: to - WEEK };
    before.flush(earlier);
    expect(store.weekBeforeHistory()).toEqual(earlier);

    // A new answer of the range does not start the week before over.
    tick(60_000);
    const pending = reads();
    const later = (r: TestRequest) => Number(r.request.params.get('to')) > to;
    const range = pending.find(later);
    expect(range).toBeDefined();
    range!.flush({ ...HISTORY, from: to + 60 - 3600, to: to + 60 });
    tick();
    expect(store.weekBeforeHistory()).toEqual(earlier);
    expect(reads()).toEqual([]);
    pending.filter((r) => !later(r)).forEach((r) => r.flush(earlier));

    // Switched off, it is no longer read, and kept so for the next visit.
    store.toggleWeekBefore();
    tick(60_000);
    expect(store.weekBeforeHistory()).toBeNull();
    expect(localStorage.getItem(WEEK_BEFORE_STORAGE_KEY)).toBe('false');
    reads().forEach((r) => r.flush(HISTORY));
    expect(reads()).toEqual([]);
    watching.unsubscribe();
  });

  it('is offered only from an hour, which steps of a minute line up in, to a week', () => {
    expect(weekBeforeOffered(30 * 60)).toBe(false);
    expect(weekBeforeOffered(3600)).toBe(true);
    expect(weekBeforeOffered(WEEK)).toBe(true);
    expect(weekBeforeOffered(14 * 86400)).toBe(false);
  });

  it('is offered only while the week before is within the retention', () => {
    expect(weekBeforeOffered(WEEK, 30)).toBe(true);
    expect(weekBeforeOffered(WEEK, 14)).toBe(true);
    expect(weekBeforeOffered(WEEK, 7)).toBe(false);
    expect(weekBeforeOffered(3600, 7)).toBe(false);
    expect(weekBeforeOffered(3600, 8)).toBe(true);
  });

  it('reads the week before of another device only once its own range is in', () => {
    store.span.set(3600);
    const watching = store.watch.subscribe();
    tick();
    reads().forEach((r) => r.flush(HISTORY));
    tick();
    reads().forEach((r) => r.flush(HISTORY));

    TestBed.inject(DeviceService).selectedId.set('nas');
    tick();
    const [range, ...early] = reads();
    expect(early).toEqual([]);
    const lastReading = Math.floor(Date.now() / 1000) - 3 * 3600;
    range.flush({ ...HISTORY, from: lastReading - 3600, to: lastReading, lastReading });
    tick();
    const [before] = reads();
    expect(before.request.params.get('device')).toBe('nas');
    expect(Number(before.request.params.get('to'))).toBe(lastReading - WEEK);
    before.flush(HISTORY);
    watching.unsubscribe();
  });

  it('reads the week before only after the new answer when watched again or switched back', () => {
    store.span.set(3600);
    let watching = store.watch.subscribe();
    tick();
    reads().forEach((r) => r.flush(HISTORY));
    tick();
    reads().forEach((r) => r.flush(HISTORY));
    watching.unsubscribe();

    // Watched again: the device has stopped answering meanwhile.
    watching = store.watch.subscribe();
    tick();
    const [range, ...early] = reads();
    expect(early).toEqual([]);
    const lastReading = Math.floor(Date.now() / 1000) - 3 * 3600;
    range.flush({ ...HISTORY, from: lastReading - 3600, to: lastReading, lastReading });
    tick();
    const [before] = reads();
    expect(Number(before.request.params.get('to'))).toBe(lastReading - WEEK);
    before.flush(HISTORY);

    // Switched to another device and back before its answer.
    const devices = TestBed.inject(DeviceService);
    devices.selectedId.set('nas');
    tick();
    devices.selectedId.set('local');
    tick();
    const [back, ...more] = reads().filter((r) => r.request.params.get('device') !== 'nas');
    expect(more).toEqual([]);
    expect(reads().every((r) => r === back || r.request.params.get('device') === 'nas')).toBe(true);
    reads().forEach((r) => r.flush(HISTORY));
    watching.unsubscribe();
  });

  it('ends the week before a week before the last reading of a device that is not answering', () => {
    store.span.set(3600);
    const watching = store.watch.subscribe();
    tick();
    const lastReading = Math.floor(Date.now() / 1000) - 86400;
    reads().forEach((r) =>
      r.flush({ ...HISTORY, from: lastReading - 3600, to: lastReading, lastReading }),
    );
    tick(60_000);
    const before = reads().find((r) => Number(r.request.params.get('to')) < lastReading);
    expect(Number(before?.request.params.get('to'))).toBe(lastReading - WEEK);
    reads().forEach((r) => r.flush(HISTORY));
    watching.unsubscribe();
  });
});

describe('HistoryStore with a short range', () => {
  /** This computer's time when a test starts, in Unix seconds. */
  const NOW = 1_800_000_000;
  const SPAN = 30 * 60;

  let store: HistoryStore;
  let http: HttpTestingController;
  let watching: { unsubscribe(): void };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(HistoryStore);
    http = TestBed.inject(HttpTestingController);
    store.span.set(SPAN);
    watching = store.watch.subscribe();
    TestBed.tick();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    watching.unsubscribe();
    http.verify();
    vi.useRealTimers();
  });

  /** The one read of the history asked for now. */
  function read(): TestRequest {
    return http.expectOne((r) => r.url === '/api/history');
  }

  function range(request: TestRequest): [number, number] {
    const params = request.request.params;
    return [Number(params.get('from')), Number(params.get('to'))];
  }

  /** Answers a read as the backend does, with one CPU reading at each of `times`. */
  function answer(request: TestRequest, times: number[], stepSeconds = 5, to?: number): void {
    const [from, asked] = range(request);
    const points: Point[] = times.map((time) => ({ time, value: time - NOW }));
    request.flush({
      from,
      to: to ?? asked,
      stepSeconds,
      retentionDays: 30,
      series: [{ metric: 'cpu', points }],
    });
  }

  /** The next tick of the poll, 5 seconds on. */
  function next(): TestRequest {
    vi.advanceTimersByTime(5_000);
    return read();
  }

  it('reads only the steps from the newest on, and adds them to the range', () => {
    const first = read();
    expect(range(first)).toEqual([NOW - SPAN, NOW]);
    answer(first, [NOW - 10, NOW - 5]);

    const second = next();
    // From the newest step, which may have had only some of its readings.
    expect(range(second)).toEqual([NOW - 5, NOW + 5]);
    answer(second, [NOW - 5, NOW]);

    const history = store.history()!;
    expect([history.from, history.to]).toEqual([NOW + 5 - SPAN, NOW + 5]);
    expect(history.series[0].points.map((p) => p.time)).toEqual([NOW - 10, NOW - 5, NOW]);
    // The step read again replaces the one read before.
    expect(history.series[0].points[1].value).toBe(-5);
  });

  it('reads the whole range every 12th time', () => {
    answer(read(), [NOW - 5]);
    for (let i = 1; i < 12; i++) {
      const small = next();
      expect(range(small)[0]).toBe(NOW - 5);
      answer(small, []);
    }
    const whole = next();
    expect(range(whole)).toEqual([NOW + 60 - SPAN, NOW + 60]);
    answer(whole, [NOW + 55]);
  });

  it('reads the whole range at once when the newest steps cannot be added', () => {
    answer(read(), [NOW - 5]);

    // Steps of another length, as when the backend now reads the range from the database.
    answer(next(), [NOW], 10);
    const whole = read();
    expect(range(whole)).toEqual([NOW + 5 - SPAN, NOW + 5]);
    answer(whole, [NOW - 5, NOW]);
    expect(store.history()!.series[0].points.length).toBe(2);
  });

  it('reads the whole range again after a read failed', () => {
    answer(read(), [NOW - 5]);

    next().flush('', { status: 500, statusText: 'Server Error' });
    expect(store.unreachable()).toBe(true);

    const whole = next();
    expect(range(whole)).toEqual([NOW + 10 - SPAN, NOW + 10]);
    answer(whole, [NOW + 5]);
    expect(store.unreachable()).toBe(false);
  });

  it("keeps the range a whole span long when this computer's clock is ahead of the hub's", () => {
    // The hub's clock is a minute behind, so it ends the range a minute before what was asked.
    const hub = NOW - 60;
    answer(read(), [hub - 5], 5, hub);
    const whole = store.history()!;
    expect([whole.from, whole.to]).toEqual([hub - SPAN, hub]);

    const small = next();
    expect(range(small)[0]).toBe(hub - 5);
    answer(small, [hub], 5, hub + 5);
    const history = store.history()!;
    expect([history.from, history.to]).toEqual([hub + 5 - SPAN, hub + 5]);
  });
});

describe('refreshIntervalMs', () => {
  it('refreshes short ranges every 5 seconds, a day every minute and longer ranges every 5 minutes', () => {
    expect(refreshIntervalMs(60)).toBe(5_000);
    expect(refreshIntervalMs(30 * 60)).toBe(5_000);
    expect(refreshIntervalMs(60 * 60)).toBe(60_000);
    expect(refreshIntervalMs(86400)).toBe(60_000);
    expect(refreshIntervalMs(7 * 86400)).toBe(300_000);
    expect(refreshIntervalMs(30 * 86400)).toBe(300_000);
  });
});
