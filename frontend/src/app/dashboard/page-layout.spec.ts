import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { EMPTY_LAYOUT, LAYOUT_RETRY_MS, Layout, PageLayout } from './page-layout';

describe('PageLayout', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    // jsdom's own value, from its prototype.
    delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
  });

  const pin = (id: string) => (layout: Layout) => ({ ...layout, pinned: [...layout.pinned, id] });
  const away = { status: 503, statusText: 'Service Unavailable' };

  it('reads the layout again a while after the host did not answer, and sends the changes then', () => {
    const page = TestBed.inject(PageLayout);
    reads()[0].flush('away', away);
    page.change(pin('cpu'));
    expect(page.layout().pinned).toEqual(['cpu']);

    vi.advanceTimersByTime(LAYOUT_RETRY_MS - 1);
    expect(reads()).toEqual([]);
    vi.advanceTimersByTime(1);
    reads()[0].flush({ ...EMPTY_LAYOUT, pinned: ['memory'] });

    expect(page.layout().pinned).toEqual(['memory', 'cpu']);
    expect(writes().map((w) => w.request.body.pinned)).toEqual([['memory', 'cpu']]);
  });

  it('reads the groups of the devices, without any that are not text, as from an older host', () => {
    const page = TestBed.inject(PageLayout);
    reads()[0].flush({ ...EMPTY_LAYOUT, groups: { pi: 'Rack', nas: 3, pc: null } });
    expect(page.layout().groups).toEqual({ pi: 'Rack' });
  });

  it('reads no groups from a host that keeps none', () => {
    const page = TestBed.inject(PageLayout);
    reads()[0].flush({ folded: ['storage'] });
    expect(page.layout().groups).toEqual({});
  });

  it('does not read again while the page is hidden, and reads at once when it is shown', () => {
    TestBed.inject(PageLayout);
    reads()[0].flush('away', away);
    show('hidden');
    vi.advanceTimersByTime(LAYOUT_RETRY_MS * 2);
    expect(reads()).toEqual([]);

    show('visible');
    reads()[0].flush(EMPTY_LAYOUT);
    vi.advanceTimersByTime(LAYOUT_RETRY_MS * 2);
    expect(reads()).toEqual([]);
  });

  it('keeps a change the host did not save over the next read, and sends it again', () => {
    const page = TestBed.inject(PageLayout);
    reads()[0].flush(EMPTY_LAYOUT);
    page.change(pin('cpu'));
    writes()[0].flush('away', away);
    expect(page.layout().pinned).toEqual(['cpu']);

    // The page is shown again before the read after the failure.
    show('hidden');
    show('visible');
    reads()[0].flush({ ...EMPTY_LAYOUT, pinned: ['memory'] });
    expect(page.layout().pinned).toEqual(['memory', 'cpu']);
    const [again] = writes();
    expect(again.request.body.pinned).toEqual(['memory', 'cpu']);
    again.flush(null);

    // Once the host kept it, the change is not made again over the next read.
    show('hidden');
    show('visible');
    reads()[0].flush({ ...EMPTY_LAYOUT, pinned: ['disks'] });
    expect(page.layout().pinned).toEqual(['disks']);
    expect(writes()).toEqual([]);
  });

  it('keeps a change made while another was being sent until it is sent too', () => {
    const page = TestBed.inject(PageLayout);
    reads()[0].flush(EMPTY_LAYOUT);
    page.change(pin('cpu'));
    const [first] = writes();
    page.change(pin('memory'));
    first.flush(null);
    writes()[0].flush('away', away);

    vi.advanceTimersByTime(LAYOUT_RETRY_MS);
    reads()[0].flush({ ...EMPTY_LAYOUT, pinned: ['cpu'] });
    expect(page.layout().pinned).toEqual(['cpu', 'memory']);
    expect(writes().map((w) => w.request.body.pinned)).toEqual([['cpu', 'memory']]);
  });

  function reads(): TestRequest[] {
    return http.match((r) => r.method === 'GET' && r.url === '/api/layout');
  }

  function writes(): TestRequest[] {
    return http.match((r) => r.method === 'PUT' && r.url === '/api/layout');
  }

  function show(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }
});
