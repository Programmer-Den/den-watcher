import { DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

import { MapViewport, Spot, ZOOM_STEP } from './map-view';

/** How far a pointer must move, in screen pixels, before a press counts as a drag, not a click. */
const DRAG_PIXELS = 4;

/** How many zoom levels one wheel notch (100 pixels of scrolling) zooms. */
const WHEEL_LEVELS = 0.5;

/** How long the hint on how to zoom stays, in milliseconds. */
export const HINT_MS = 1500;

/** How far one press of an arrow key moves the map, in map units. */
const KEY_PAN = 64;

/**
 * Lets the user zoom and move a map drawn in an SVG: drag to move, Ctrl (or ⌘) + scroll, a double
 * click or a pinch to zoom, and the keyboard (arrows, + and −) once the map has the focus. A plain
 * scroll keeps scrolling the page and tells how to zoom, so the map does not catch the page. A click
 * after a drag is swallowed, so moving the map does not pick what the pointer was on.
 */
@Directive({
  selector: 'svg[appMapZoom]',
  host: {
    tabindex: '0',
    class: 'map-zoom',
    // The map takes every drag and pinch; the page scrolls beside it.
    style: 'touch-action: none; cursor: grab',
    '(wheel)': 'wheel($event)',
    '(dblclick)': 'doubleClick($event)',
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'up($event)',
    '(keydown)': 'key($event)',
  },
})
export class MapZoom {
  readonly appMapZoom = input.required<MapViewport>();

  private readonly host = inject<ElementRef<SVGSVGElement>>(ElementRef);

  /** The pointers pressed on the map, by id, where each was last. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private pinch = 0;
  private hintTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // In the capture phase, so the click is swallowed before what is under the pointer gets it.
    const click = (event: MouseEvent) => this.click(event);
    this.host.nativeElement.addEventListener('click', click, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.hintTimer);
      this.host.nativeElement.removeEventListener('click', click, { capture: true });
    });
  }

  /** Where a point of the screen is on the map, in its units. */
  private spot(clientX: number, clientY: number): Spot {
    const map = this.appMapZoom();
    const box = this.host.nativeElement.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      return { x: map.width / 2, y: map.height / 2 };
    }
    return {
      x: ((clientX - box.left) * map.width) / box.width,
      y: ((clientY - box.top) * map.height) / box.height,
    };
  }

  /** How many map units one screen pixel is. */
  private unitsPerPixel(): number {
    const box = this.host.nativeElement.getBoundingClientRect();
    return box.width > 0 ? this.appMapZoom().width / box.width : 1;
  }

  protected wheel(event: WheelEvent): void {
    const map = this.appMapZoom();
    if (!event.ctrlKey && !event.metaKey) {
      map.hint.set(true);
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => map.hint.set(false), HINT_MS);
      return;
    }
    event.preventDefault();
    map.hint.set(false);
    // Lines and pages scroll further than pixels: about 16 and 800 pixels.
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
    map.zoom((-pixels / 100) * WHEEL_LEVELS, this.spot(event.clientX, event.clientY));
  }

  protected doubleClick(event: MouseEvent): void {
    event.preventDefault();
    this.appMapZoom().zoom(
      event.shiftKey ? -ZOOM_STEP : ZOOM_STEP,
      this.spot(event.clientX, event.clientY),
    );
  }

  protected down(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    if (this.pointers.size === 0) {
      this.moved = 0;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pinch = 0;
  }

  protected move(event: PointerEvent): void {
    const last = this.pointers.get(event.pointerId);
    if (!last) {
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const map = this.appMapZoom();
    if (this.pointers.size >= 2) {
      // Two fingers zoom around their middle, by how much further apart they moved.
      const [a, b] = [...this.pointers.values()];
      const apart = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch > 0 && apart > 0) {
        map.zoom(Math.log2(apart / this.pinch), this.spot((a.x + b.x) / 2, (a.y + b.y) / 2));
      }
      this.pinch = apart;
      this.moved = Infinity;
      return;
    }
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.moved >= DRAG_PIXELS) {
      if (!this.host.nativeElement.hasPointerCapture?.(event.pointerId)) {
        this.host.nativeElement.setPointerCapture?.(event.pointerId);
      }
      const units = this.unitsPerPixel();
      map.pan(dx * units, dy * units);
    }
  }

  protected up(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.pinch = 0;
  }

  /** Swallows the click that ends a drag or a pinch, before it reaches what is under the pointer. */
  private click(event: MouseEvent): void {
    if (this.moved >= DRAG_PIXELS) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.moved = 0;
  }

  protected key(event: KeyboardEvent): void {
    const map = this.appMapZoom();
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN, 0],
      ArrowRight: [-KEY_PAN, 0],
      ArrowUp: [0, KEY_PAN],
      ArrowDown: [0, -KEY_PAN],
    };
    if (event.key === '+' || event.key === '=') {
      map.zoom(ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      map.zoom(-ZOOM_STEP);
    } else if (event.key === '0') {
      map.showWhole();
    } else if (moves[event.key]) {
      map.pan(...moves[event.key]);
    } else {
      return;
    }
    event.preventDefault();
  }
}
