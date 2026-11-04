import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/**
 * The moment the pointer is on in a chart of the device's page, shared by its card charts and its
 * glance row: every chart marks it, and the chart the pointer is on shows its values. A touch keeps
 * the moment until the next touch outside a chart, as a finger lifts off without leaving it.
 */
@Injectable({ providedIn: 'root' })
export class ChartPointer {
  /** The start of the step the pointer is on (Unix seconds), or null when it is on no chart. */
  readonly time = signal<number | null>(null);
  /** The chart the pointer is on, which shows the readout. */
  readonly source = signal<object | null>(null);

  constructor() {
    inject(DOCUMENT).addEventListener('pointerdown', (event) => {
      const target = event.target as Element | null;
      if (this.time() !== null && !target?.closest?.('.plot')) {
        this.clear();
      }
    });
  }

  /** The pointer is on `time` in the chart `source`. */
  point(source: object, time: number): void {
    this.source.set(source);
    this.time.set(time);
  }

  /** The pointer left the chart `source`; another chart it moved to keeps its moment. */
  leave(source: object): void {
    if (this.source() === source) {
      this.clear();
    }
  }

  clear(): void {
    this.source.set(null);
    this.time.set(null);
  }
}
