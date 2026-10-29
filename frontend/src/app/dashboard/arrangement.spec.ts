import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Arrangement } from './arrangement';
import { EMPTY_LAYOUT, Layout, MAX_LAYOUT_ENTRIES, PageLayout } from './page-layout';

describe('Arrangement', () => {
  let http: HttpTestingController;
  let arrangement: Arrangement;

  const cards = (...ids: string[]) => ids.map((id) => ({ id }));
  const ids = (list: { id: string }[]) => list.map((card) => card.id);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    arrangement = TestBed.inject(Arrangement);
  });

  afterEach(() => {
    // The marks of the charts are read alongside the history; these tests leave them unanswered.
    http.match((r) => r.url === '/api/events');
    http.verify();
  });

  function answer(layout: Partial<Layout>): void {
    http.expectOne('/api/layout').flush({ ...EMPTY_LAYOUT, ...layout });
  }

  /** The layouts sent to the host, each answered, which lets the next one go. */
  function sent(): Layout[] {
    const layouts: Layout[] = [];
    for (;;) {
      const [write] = http.match((r) => r.method === 'PUT' && r.url === '/api/layout');
      if (!write) {
        return layouts;
      }
      layouts.push(write.request.body as Layout);
      write.flush(null, { status: 204, statusText: 'No Content' });
    }
  }

  it('puts the arranged cards first, in their order, and the others after as they came', () => {
    answer({ order: ['gpus', 'cpu'] });
    expect(ids(arrangement.sort(cards('cpu', 'memory', 'gpus', 'extra:wifi')))).toEqual([
      'gpus',
      'cpu',
      'memory',
      'extra:wifi',
    ]);
  });

  it('sorts several categories as one, keeping each card never moved after the card before it', () => {
    // Arranged while grouped, only the later category has an order.
    answer({ order: ['uptime', 'time'] });
    const across = () =>
      ids(
        arrangement.sortAcross([cards('cpu', 'memory'), cards('disks'), cards('time', 'uptime')]),
      );
    expect(across()).toEqual(['cpu', 'memory', 'disks', 'uptime', 'time']);
    // Arranged while not grouped, every card has its place across the categories.
    arrangement.move(['cpu', 'memory', 'disks', 'uptime', 'time'], 4, 0);
    sent();
    expect(across()).toEqual(['time', 'cpu', 'memory', 'disks', 'uptime']);
  });

  it("keeps a moved category's whole order, after the other categories' cards", () => {
    answer({ order: ['disks', 'memory'] });
    arrangement.move(['cpu', 'memory', 'gpus'], 2, 0);
    expect(sent().map((l) => l.order)).toEqual([['disks', 'gpus', 'cpu', 'memory']]);
  });

  it('keeps no more cards in the order than the host does, dropping the ones moved longest ago', () => {
    const old = Array.from({ length: MAX_LAYOUT_ENTRIES }, (_, i) => `gone-${i}`);
    answer({ order: old });
    arrangement.move(['cpu', 'memory'], 1, 0);
    const [order] = sent().map((l) => l.order);
    expect(order.length).toBe(MAX_LAYOUT_ENTRIES);
    expect(order.slice(0, 1)).toEqual(['gone-2']);
    expect(order.slice(-2)).toEqual(['memory', 'cpu']);
  });

  it('keeps no more hidden cards than the host does, dropping the ones hidden longest ago', () => {
    answer({ hidden: Array.from({ length: MAX_LAYOUT_ENTRIES }, (_, i) => `gone-${i}`) });
    arrangement.hide('cpu');
    const [hidden] = sent().map((l) => l.hidden);
    expect(hidden.length).toBe(MAX_LAYOUT_ENTRIES);
    expect(hidden.slice(0, 1)).toEqual(['gone-1']);
    expect(hidden.at(-1)).toBe('cpu');
  });

  it('moves no card past the ends of its category', () => {
    answer({});
    arrangement.move(['cpu', 'memory'], 0, -1);
    arrangement.move(['cpu', 'memory'], 1, 2);
    arrangement.move(['cpu', 'memory'], 1, 1);
    expect(sent()).toEqual([]);
  });

  it('hides a card once and shows it again', () => {
    answer({ hidden: ['fans'] });
    arrangement.hide('cpu');
    arrangement.hide('cpu');
    expect([...arrangement.hidden()]).toEqual(['fans', 'cpu']);
    arrangement.show('fans');
    expect([...arrangement.hidden()]).toEqual(['cpu']);
    // One layout is sent at a time, the newest after the first.
    expect(sent().map((l) => l.hidden)).toEqual([['fans', 'cpu'], ['cpu']]);
  });

  it('pins a card after the others, unpins it, and orders the shown pinned cards', () => {
    answer({ pinned: ['fans', 'extra:wifi'] });
    arrangement.togglePin('cpu');
    expect(arrangement.pinned()).toEqual(['fans', 'extra:wifi', 'cpu']);
    arrangement.togglePin('fans');
    expect(arrangement.pinned()).toEqual(['extra:wifi', 'cpu']);
    // This device has no Wi-Fi, so only the CPU is shown; Wi-Fi keeps its place after it.
    arrangement.togglePin('fans');
    arrangement.movePinned(['cpu', 'fans'], 1, 0);
    expect(arrangement.pinned()).toEqual(['fans', 'cpu', 'extra:wifi']);
    expect(sent().at(-1)!.pinned).toEqual(['fans', 'cpu', 'extra:wifi']);
  });

  it('pins a card as the page showed it, also when the host had it pinned already', () => {
    arrangement.togglePin('cpu');
    answer({ pinned: ['cpu', 'fans'] });
    expect(arrangement.pinned()).toEqual(['fans', 'cpu']);
    expect(sent().map((l) => l.pinned)).toEqual([['fans', 'cpu']]);
  });

  it('makes a value of the details a card once and puts it back', () => {
    answer({
      made: ['value:kernel/forks'],
      pinned: ['value:kernel/forks', 'cpu'],
      order: ['value:kernel/forks', 'memory'],
      widths: { 'value:kernel/forks': 4, cpu: 2 },
    });
    arrangement.make('value:pressure/cpu');
    arrangement.make('value:pressure/cpu');
    expect([...arrangement.made()]).toEqual(['value:kernel/forks', 'value:pressure/cpu']);
    // A value put back loses its pin and its place, so made again it comes after the other cards.
    arrangement.unmake('value:kernel/forks');
    expect([...arrangement.made()]).toEqual(['value:pressure/cpu']);
    expect(sent().at(-1)).toEqual({
      ...EMPTY_LAYOUT,
      made: ['value:pressure/cpu'],
      pinned: ['cpu'],
      order: ['memory'],
      widths: { cpu: 2 },
    });
  });

  it('groups the cards by category unless the host says otherwise, and keeps it through Reset', () => {
    answer({ ungrouped: 'yes' } as unknown as Partial<Layout>);
    expect(arrangement.grouped()).toBe(true);
    arrangement.group(false);
    expect(arrangement.grouped()).toBe(false);
    expect(arrangement.arranged()).toBe(false);
    arrangement.reset();
    expect(sent().at(-1)).toEqual({ ...EMPTY_LAYOUT, ungrouped: true });
  });

  it('takes only the widths of 2 and 4 cards from the host', () => {
    answer({ widths: { cpu: 2, memory: 3, fans: 4, disks: '2' } as unknown as Layout['widths'] });
    expect(TestBed.inject(PageLayout).layout().widths).toEqual({ cpu: 2, fans: 4 });
  });

  it('resets the order, the hidden, the pinned and the made cards and the widths, keeping the folded categories', () => {
    answer({
      folded: ['storage'],
      order: ['memory'],
      hidden: ['cpu'],
      pinned: ['fans'],
      made: ['value:kernel/forks'],
      widths: { cpu: 2 },
    });
    expect(arrangement.arranged()).toBe(true);
    arrangement.reset();
    expect(arrangement.arranged()).toBe(false);
    expect(sent()).toEqual([{ ...EMPTY_LAYOUT, folded: ['storage'] }]);
  });
});
