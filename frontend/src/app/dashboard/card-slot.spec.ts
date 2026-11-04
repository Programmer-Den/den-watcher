import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { EvenColumns } from '../layout/even-columns';
import { ArrangeControls } from './arrange-controls';
import { Arrangement } from './arrangement';
import { CardSlot } from './card-slot';
import { EMPTY_LAYOUT, Layout } from './page-layout';

/** Stands in for the browser's ResizeObserver, which jsdom lacks; tests report sizes by hand. */
class FakeResizeObserver {
  static last: FakeResizeObserver | undefined;
  constructor(readonly callback: (entries: { contentRect: { width: number } }[]) => void) {
    FakeResizeObserver.last = this;
  }
  observe = vi.fn();
  disconnect = vi.fn();
  resize(width: number): void {
    this.callback([{ contentRect: { width } }]);
  }
}

@Component({
  imports: [ArrangeControls, CardSlot, EvenColumns],
  template: `
    <div appEvenColumns keepCardWidth style="--min-card: 14rem">
      <div appCardSlot="cpu"><app-arrange-controls card="CPU" [charts]="true" /></div>
      <div appCardSlot="memory"></div>
    </div>
  `,
})
class Host {}

describe('CardSlot', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  /** A grid `width` pixels wide over the host's `layout`; jsdom has no gap, so 1000 fits 4 cards. */
  function grid(width: number, layout: Partial<Layout> = {}) {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    http.expectOne('/api/layout').flush({ ...EMPTY_LAYOUT, ...layout });
    FakeResizeObserver.last?.resize(width);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const cpu = element.querySelector<HTMLElement>('[appCardSlot="cpu"]')!;
    const button = () => cpu.querySelector<HTMLButtonElement>('app-arrange-controls .width');
    const step = () => {
      button()!.click();
      fixture.detectChanges();
    };
    return { fixture, cpu, button, step };
  }

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

  it('steps a card to 2 and 4 cards wide and back, only until the page loads again', () => {
    const { cpu, button, step } = grid(1000);
    expect(cpu.style.gridColumn).toBe('');
    expect(button()!.getAttribute('aria-label')).toBe('Make CPU wider');

    step();
    expect(cpu.style.gridColumn).toBe('span 2');
    expect(cpu.dataset['width']).toBe('2');
    expect(button()!.getAttribute('aria-pressed')).toBe('true');
    step();
    expect(cpu.style.gridColumn).toBe('span 4');
    expect(button()!.getAttribute('aria-label')).toBe('Make CPU narrow again');
    step();
    expect(cpu.style.gridColumn).toBe('');
    expect(sent()).toEqual([]);
  });

  it('keeps a width set while arranging on the host', () => {
    const { fixture, cpu, step } = grid(1000, { widths: { memory: 4 } });
    TestBed.inject(Arrangement).arranging.set(true);
    fixture.detectChanges();
    step();
    expect(cpu.style.gridColumn).toBe('span 2');
    expect(sent().at(-1)!.widths).toEqual({ memory: 4, cpu: 2 });
    step();
    step();
    expect(sent().at(-1)!.widths).toEqual({ memory: 4 });
  });

  it('shows the kept widths while arranging, without the ones set only in this tab', () => {
    const { fixture, cpu, step } = grid(1000, { widths: { cpu: 2 } });
    step();
    expect(cpu.style.gridColumn).toBe('span 4');
    TestBed.inject(Arrangement).arranging.set(true);
    fixture.detectChanges();
    expect(cpu.style.gridColumn).toBe('span 2');
    TestBed.inject(Arrangement).reset();
    fixture.detectChanges();
    expect(cpu.style.gridColumn).toBe('');
    expect(sent().at(-1)!.widths).toEqual({});
    // Reset also drops the width set in this tab, so the card stays narrow after arranging.
    TestBed.inject(Arrangement).arranging.set(false);
    fixture.detectChanges();
    expect(cpu.style.gridColumn).toBe('');
  });

  it('offers only the widths that fit, and shows a wider card as wide as the grid', () => {
    // 600 pixels fit 2 cards side by side: 4 is not offered, and a card kept at 4 fills the row.
    const { fixture, cpu, button, step } = grid(600, { widths: { cpu: 4 } });
    expect(cpu.style.gridColumn).toBe('span 2');
    expect(button()!.getAttribute('aria-label')).toBe('Make CPU narrow again');
    step();
    expect(cpu.style.gridColumn).toBe('');
    step();
    expect(cpu.style.gridColumn).toBe('span 2');

    // A grid narrower than two cards, as on a phone, has no width button.
    FakeResizeObserver.last?.resize(300);
    fixture.detectChanges();
    expect(cpu.style.gridColumn).toBe('');
    expect(button()).toBeNull();
  });

  it('shows all values while wider, or opened where no wider card fits', () => {
    const { fixture, cpu } = grid(1000);
    const slot = fixture.debugElement.query(By.css('[appCardSlot="cpu"]')).injector.get(CardSlot);
    const toggle = () => {
      slot.toggle();
      fixture.detectChanges();
    };
    expect(cpu.classList).not.toContain('full');
    toggle();
    expect(cpu.style.gridColumn).toBe('span 2');
    expect(cpu.classList).toContain('full');
    toggle();
    toggle();
    expect(cpu.classList).not.toContain('full');

    // On a phone the card opens in place instead, and closes again.
    FakeResizeObserver.last?.resize(300);
    fixture.detectChanges();
    toggle();
    expect(cpu.style.gridColumn).toBe('');
    expect(cpu.classList).toContain('full');
    toggle();
    expect(cpu.classList).not.toContain('full');
    expect(sent()).toEqual([]);
  });
});
