import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FoldedCategories, byCategory, extraCategory } from './categories';
import { EMPTY_LAYOUT } from './page-layout';

describe('categories', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // The marks of the charts are read alongside the history; these tests leave them unanswered.
    http.match((r) => r.url === '/api/events');
    http.verify();
    // jsdom's own value, from its prototype.
    delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
  });

  it('puts the extras the page knows in their category, and the others under other', () => {
    expect(extraCategory('smart-checks')).toBe('storage');
    expect(extraCategory('wifi')).toBe('network');
    expect(extraCategory('containers-memory')).toBe('programs');
    expect(extraCategory('den-watcher')).toBe('programs');
    expect(extraCategory('weather')).toBe('other');
    expect(extraCategory('toString')).toBe('other');
  });

  it('groups items in the order of the categories, leaving out empty ones', () => {
    const items = [
      { name: 'time', category: 'device' as const },
      { name: 'cpu', category: 'system' as const },
      { name: 'disks', category: 'storage' as const },
      { name: 'memory', category: 'system' as const },
    ];
    expect(
      byCategory(items, (i) => i.category).map((g) => [g.category, g.items.map((i) => i.name)]),
    ).toEqual([
      ['system', ['cpu', 'memory']],
      ['storage', ['disks']],
      ['device', ['time']],
    ]);
  });

  it("reads the folded categories from the host's layout, leaving out what is not one", () => {
    const folded = TestBed.inject(FoldedCategories);
    expect(folded.folded().size).toBe(0);
    http.expectOne('/api/layout').flush({ folded: ['network', 'nonsense', 3] });
    expect([...folded.folded()]).toEqual(['network']);
  });

  it("keeps the folds made before the host answers, over the host's own", () => {
    const folded = TestBed.inject(FoldedCategories);
    const read = http.expectOne('/api/layout');

    folded.toggle('storage');
    folded.toggle('network');
    folded.toggle('storage');
    expect([...folded.folded()]).toEqual(['network']);
    expect(writes()).toEqual([]);

    read.flush({ folded: ['system'] });
    expect([...folded.folded()]).toEqual(['system', 'network']);
    expect(writes().map((w) => w.request.body)).toEqual([
      { ...EMPTY_LAYOUT, folded: ['system', 'network'] },
    ]);
  });

  it('keeps a fold the host kept although its answer was lost, instead of undoing it', () => {
    const folded = TestBed.inject(FoldedCategories);
    http.expectOne('/api/layout').flush({ folded: [] });
    folded.toggle('storage');
    writes()[0].flush('lost', { status: 504, statusText: 'Gateway Timeout' });

    show('hidden');
    show('visible');
    http.expectOne('/api/layout').flush({ folded: ['storage'] });
    expect([...folded.folded()]).toEqual(['storage']);
    expect(writes().map((w) => w.request.body.folded)).toEqual([['storage']]);
  });

  it('sends one layout at a time, the newest last', () => {
    const folded = TestBed.inject(FoldedCategories);
    http.expectOne('/api/layout').flush({ folded: [] });

    folded.toggle('storage');
    folded.toggle('storage');
    folded.toggle('network');
    const first = writes();
    expect(first.map((w) => w.request.body)).toEqual([{ ...EMPTY_LAYOUT, folded: ['storage'] }]);

    first[0].flush(null, { status: 204, statusText: 'No Content' });
    expect(writes().map((w) => w.request.body)).toEqual([{ ...EMPTY_LAYOUT, folded: ['network'] }]);
  });

  it('reads the layout again when the page is shown, to take changes made elsewhere', () => {
    const folded = TestBed.inject(FoldedCategories);
    http.expectOne('/api/layout').flush({ folded: [] });

    show('hidden');
    show('visible');
    http.expectOne('/api/layout').flush({ folded: ['programs'] });
    expect([...folded.folded()]).toEqual(['programs']);

    folded.toggle('storage');
    expect(writes().map((w) => w.request.body)).toEqual([
      { ...EMPTY_LAYOUT, folded: ['programs', 'storage'] },
    ]);
  });

  it('starts with none folded when the host has no layout', () => {
    const folded = TestBed.inject(FoldedCategories);
    http.expectOne('/api/layout').flush('not found', { status: 404, statusText: 'Not Found' });
    expect(folded.folded().size).toBe(0);
  });

  function writes(): TestRequest[] {
    return http.match((r) => r.method === 'PUT' && r.url === '/api/layout');
  }

  function show(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }
});
