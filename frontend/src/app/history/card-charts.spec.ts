import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { CardSlot } from '../dashboard/card-slot';

import { History } from '../metrics/metrics';
import { CardCharts } from './card-charts';
import { Chart } from './history';
import { HistoryStore } from './history-store';
import { RangePicker } from './range-picker';

const HISTORY: History = { from: 0, to: 1800, stepSeconds: 5, retentionDays: 30, series: [] };

const DISKS: Chart = {
  title: 'Disks',
  category: 'storage',
  card: 'disks',
  unit: 'percent',
  max: 100,
  lines: [{ label: '/', points: [{ time: 0, value: 30 }] }],
};

/** A card opened to show all its values, as where no wider card fits. */
@Component({
  imports: [CardCharts, CardSlot],
  template: `<div appCardSlot="disks"><app-card-charts [chart]="chart()" /></div>`,
})
class OpenedCard {
  readonly chart = input<Chart>();
}

describe('CardCharts', () => {
  let fixture: ComponentFixture<CardCharts>;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [CardCharts, RangePicker],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    // The range picker reads the history; the charts only show it.
    TestBed.createComponent(RangePicker).detectChanges();
    fixture = TestBed.createComponent(CardCharts);
  });

  afterEach(() => {
    // The marks of the charts are read alongside the history; these tests leave them unanswered.
    http.match((r) => r.url === '/api/events');
    http.verify();
    vi.useRealTimers();
  });

  function show(chart: Chart | undefined): HTMLElement {
    fixture.componentRef.setInput('chart', chart);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    http.expectOne((r) => r.url === '/api/history').flush(HISTORY);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the chart without a title, as the card names it', () => {
    const element = show(DISKS);
    expect(element.querySelectorAll('app-line-chart').length).toBe(1);
    expect(element.querySelector('h4')).toBeNull();
  });

  it('has no width button outside a grid of cards', () => {
    const element = show(DISKS);
    expect(element.querySelector('button.widen')).toBeNull();
  });

  it('shows nothing, not even the button, without a chart', () => {
    const element = show(undefined);
    expect(element.querySelector('app-line-chart')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
  });

  it('lets the zoom of a card showing all its values go when another range is picked', () => {
    const host = TestBed.createComponent(OpenedCard);
    host.componentRef.setInput('chart', DISKS);
    const slot = host.debugElement.query(By.directive(CardSlot)).injector.get(CardSlot);
    slot.opened.set(true);
    host.detectChanges();
    vi.advanceTimersByTime(0);
    http.expectOne((r) => r.url === '/api/history').flush(HISTORY);
    host.detectChanges();
    expect(slot.full()).toBe(true);

    slot.zoom.set({ from: 600, to: 1200 });
    host.detectChanges();
    expect(slot.zoom()).toEqual({ from: 600, to: 1200 });

    TestBed.inject(HistoryStore).span.set(7 * 86400);
    host.detectChanges();
    vi.advanceTimersByTime(0);
    http.match((r) => r.url === '/api/history').forEach((r) => r.flush(HISTORY));
    expect(slot.zoom()).toBeNull();
    // The card's width is read from the layout; this test leaves it unanswered.
    http.match((r) => r.url === '/api/layout');
  });
});
