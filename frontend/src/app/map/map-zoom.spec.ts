import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapViewport } from './map-view';
import { HINT_MS, MapZoom } from './map-zoom';

/** A map 640 by 360 units drawn at the same size in pixels, with a place to click. */
@Component({
  imports: [MapZoom],
  template: `<svg [appMapZoom]="map" viewBox="0 0 640 360" style="width: 640px; height: 360px">
    <circle r="10" cx="320" cy="180" (click)="clicks = clicks + 1" />
  </svg>`,
})
class Host {
  readonly map = new MapViewport(640, 360);
  clicks = 0;
}

describe('MapZoom', () => {
  let fixture: ComponentFixture<Host>;
  let svg: SVGSVGElement;
  let map: MapViewport;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    map = fixture.componentInstance.map;
    map.show([
      { lat: 53.55, lon: 10 },
      { lat: 53.57, lon: 10 },
    ]);
    svg = fixture.nativeElement.querySelector('svg');
    svg.getBoundingClientRect = () => new DOMRect(0, 0, 640, 360);
    svg.setPointerCapture = () => undefined;
    svg.hasPointerCapture = () => false;
  });

  afterEach(() => vi.useRealTimers());

  function pointer(type: string, x: number, y: number, pointerId = 1): void {
    svg.dispatchEvent(
      new PointerEvent(type, { clientX: x, clientY: y, pointerId, button: 0, bubbles: true }),
    );
  }

  it('zooms with Ctrl + scroll, and only tells how with a plain scroll', () => {
    const zoom = map.view()!.zoom;
    const plain = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
    svg.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(map.view()!.zoom).toBe(zoom);
    expect(map.hint()).toBe(true);
    vi.advanceTimersByTime(HINT_MS);
    expect(map.hint()).toBe(false);
    const ctrl = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, cancelable: true });
    svg.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(true);
    expect(map.view()!.zoom).toBeGreaterThan(zoom);
  });

  it('zooms in with a double click and moves the map with a drag, without a click', () => {
    const zoom = map.view()!.zoom;
    svg.dispatchEvent(new MouseEvent('dblclick', { clientX: 320, clientY: 180 }));
    expect(map.view()!.zoom).toBe(zoom + 1);
    const place = map.at({ lat: 53.55, lon: 10 });
    pointer('pointerdown', 320, 180);
    pointer('pointermove', 330, 180);
    pointer('pointermove', 350, 170);
    pointer('pointerup', 350, 170);
    svg.querySelector('circle')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fixture.componentInstance.clicks).toBe(0);
    const moved = map.at({ lat: 53.55, lon: 10 });
    expect(moved.x).toBeCloseTo(place.x + 30, 0);
    expect(moved.y).toBeCloseTo(place.y - 10, 0);
    // A press without a drag is a click.
    pointer('pointerdown', 320, 180);
    pointer('pointerup', 320, 180);
    svg.querySelector('circle')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fixture.componentInstance.clicks).toBe(1);
  });

  it('zooms with two fingers moving apart', () => {
    const zoom = map.view()!.zoom;
    pointer('pointerdown', 300, 180, 1);
    pointer('pointerdown', 340, 180, 2);
    pointer('pointermove', 290, 180, 1);
    pointer('pointermove', 370, 180, 2);
    // From 50 to 80 pixels apart, then from 80 to 160: a whole level more.
    pointer('pointermove', 250, 180, 1);
    pointer('pointermove', 410, 180, 2);
    expect(map.view()!.zoom).toBeCloseTo(zoom + Math.log2(160 / 50), 1);
  });

  it('zooms and moves with the keyboard', () => {
    const zoom = map.view()!.zoom;
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    expect(map.view()!.zoom).toBe(zoom + 1);
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(map.zoomed()).toBe(true);
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
    expect(map.zoomed()).toBe(false);
  });
});
