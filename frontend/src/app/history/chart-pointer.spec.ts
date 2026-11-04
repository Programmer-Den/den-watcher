import { TestBed } from '@angular/core/testing';

import { ChartPointer } from './chart-pointer';

describe('ChartPointer', () => {
  it('keeps the moment of the chart the pointer is on until it leaves that chart', () => {
    const pointer = TestBed.inject(ChartPointer);
    const cpu = {};
    const memory = {};

    pointer.point(cpu, 60);
    pointer.point(memory, 120);
    // Leaving the chart it came from keeps the one it moved to.
    pointer.leave(cpu);
    expect(pointer.time()).toBe(120);
    expect(pointer.source()).toBe(memory);
    pointer.leave(memory);
    expect(pointer.time()).toBeNull();
  });

  it('forgets the moment at a touch outside a chart', () => {
    const pointer = TestBed.inject(ChartPointer);
    const plot = document.createElement('div');
    plot.className = 'plot';
    document.body.append(plot);

    pointer.point({}, 60);
    plot.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(pointer.time()).toBe(60);
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(pointer.time()).toBeNull();
    plot.remove();
  });
});
