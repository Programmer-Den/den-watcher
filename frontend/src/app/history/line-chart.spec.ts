import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ChartCanvas } from './chart-canvas';
import {
  ChartData,
  ChartLine,
  LineChart,
  lineSegments,
  needsYear,
  niceCeiling,
  pointerFraction,
} from './line-chart';

describe('LineChart', () => {
  let fixture: ComponentFixture<LineChart>;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function chart(lines: ChartLine[]): ChartData {
    return { title: 'CPU and memory', lines, unit: 'percent', max: 100 };
  }

  function render(lines: ChartLine[], from = 0, to = 600, step = 60): HTMLElement {
    fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput('chart', chart(lines));
    fixture.componentRef.setInput('from', from);
    fixture.componentRef.setInput('to', to);
    fixture.componentRef.setInput('step', step);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** The lines the chart hands its canvas to draw. */
  function drawn() {
    return fixture.debugElement.query(By.directive(ChartCanvas)).injector.get(ChartCanvas).lines();
  }

  it('draws each line and leaves a gap where values are missing', () => {
    render([
      {
        label: 'CPU',
        points: [
          { time: 0, value: 0 },
          { time: 60, value: 50 },
          { time: 300, value: 100 },
        ],
      },
    ]);

    const lines = drawn();
    expect(lines.length).toBe(1);
    // The first two points are joined; the third starts a new segment after the gap.
    expect(lines[0].segments).toEqual([
      [
        { x: 0.05, y: 1 },
        { x: 0.15, y: 0.5 },
      ],
      [{ x: 0.55, y: 0 }],
    ]);
  });

  it('shows a legend only when there are several lines', () => {
    const single = render([{ label: 'CPU', points: [] }]);
    expect(single.querySelector('.legend')).toBeNull();

    const several = render([
      { label: 'CPU', points: [] },
      { label: 'Memory', points: [] },
    ]);
    expect(several.querySelector('.legend')?.textContent).toContain('Memory');
  });

  it('shows the values at the pointer', () => {
    const element = render([
      { label: 'CPU', points: [{ time: 120, value: 12.5 }] },
      { label: 'Memory', points: [] },
    ]);
    const plot = element.querySelector('.plot') as HTMLElement;
    plot.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect;

    plot.dispatchEvent(new MouseEvent('pointermove', { clientX: 150 }));
    fixture.detectChanges();

    const tooltip = element.querySelector('.tooltip')?.textContent ?? '';
    expect(tooltip).toContain('12.5 %');
    expect(tooltip).toContain('–');

    plot.dispatchEvent(new MouseEvent('pointerleave'));
    fixture.detectChanges();
    expect(element.querySelector('.tooltip')).toBeNull();
  });

  it('marks what happened, and tells it at the pointer', () => {
    const element = render([{ label: 'CPU', points: [{ time: 120, value: 12.5 }] }]);
    fixture.componentRef.setInput('markers', [
      { kind: 'reboot', time: 150, text: 'Restarted' },
      { kind: 'outage', time: 300, end: 450, text: 'Did not answer' },
      { kind: 'update', time: 900, text: 'Outside the range' },
    ]);
    fixture.detectChanges();
    const marks = element.querySelectorAll<HTMLElement>('app-chart-markers .marker');
    expect(marks.length).toBe(2);
    expect(marks[0].classList).toContain('reboot');
    expect(marks[0].style.left).toBe('25%');
    expect(marks[1].classList).toContain('band');
    expect(marks[1].style.width).toBe('25%');

    const plot = element.querySelector('.plot') as HTMLElement;
    plot.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect;
    plot.dispatchEvent(new MouseEvent('pointermove', { clientX: 150 }));
    fixture.detectChanges();
    expect(element.querySelector('.tooltip .event')?.textContent?.trim()).toBe('Restarted');
    plot.dispatchEvent(new MouseEvent('pointermove', { clientX: 30 }));
    fixture.detectChanges();
    expect(element.querySelector('.tooltip .event')).toBeNull();
  });

  it('shows the values of the last step at the right edge', () => {
    const element = render([{ label: 'CPU', points: [{ time: 540, value: 30 }] }]);
    const plot = element.querySelector('.plot') as HTMLElement;
    plot.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect;

    plot.dispatchEvent(new MouseEvent('pointermove', { clientX: 600 }));
    fixture.detectChanges();

    expect(element.querySelector('.tooltip')?.textContent).toContain('30 %');
  });

  it('tells screen readers what the chart shows and the latest values', () => {
    const element = render([
      {
        label: 'CPU',
        points: [
          { time: 60, value: 80 },
          { time: 120, value: 12.5 },
        ],
      },
      { label: 'Memory', points: [] },
    ]);

    const label = element.querySelector('canvas')?.getAttribute('aria-label') ?? '';
    expect(element.querySelector('canvas')?.getAttribute('role')).toBe('img');
    expect(label).toMatch(
      /^Chart of “CPU and memory” from .+ to .+: CPU \(latest 12\.5 %\) and Memory \(no data\)$/,
    );
  });

  it('writes the year on the axis, in the tooltip and for screen readers over long ranges', () => {
    const from = new Date(2025, 0, 10).getTime() / 1000;
    const to = from + 400 * 86400;
    const element = render(
      [{ label: 'CPU', points: [{ time: from, value: 30 }] }],
      from,
      to,
      86400,
    );
    const plot = element.querySelector('.plot') as HTMLElement;
    plot.getBoundingClientRect = () => ({ left: 0, width: 600 }) as DOMRect;

    plot.dispatchEvent(new MouseEvent('pointermove', { clientX: 0 }));
    fixture.detectChanges();

    const axis = element.querySelector('.x-axis')?.textContent ?? '';
    expect(axis).toContain('Jan 10, 2025');
    expect(axis).toContain('2026');
    expect(element.querySelector('.tooltip .time')?.textContent).toContain(', 2025,');
    expect(element.querySelector('canvas')?.getAttribute('aria-label')).toMatch(
      /from Fri, Jan 10, 2025, .+ to .+, 2026, /,
    );
  });

  it('leaves the year out of a month within one year', () => {
    const from = new Date(2026, 4, 1).getTime() / 1000;
    const element = render([{ label: 'CPU', points: [] }], from, from + 30 * 86400, 3600);

    expect(element.querySelector('.x-axis')?.textContent).toContain('May 1');
    expect(element.querySelector('.x-axis')?.textContent).not.toContain('2026');
    expect(element.querySelector('canvas')?.getAttribute('aria-label')).not.toContain('2026');
  });

  it('dashes the lines after the eighth and keeps lines of the same name apart', () => {
    const lines = () => Array.from({ length: 9 }, () => ({ label: 'sda', points: [] }));
    const element = render(lines());
    // Angular warns when a list it updates repeats a key.
    const warn = vi.spyOn(console, 'warn');
    fixture.componentRef.setInput('chart', chart(lines()));
    fixture.detectChanges();
    expect(warn).not.toHaveBeenCalled();

    const swatches = element.querySelectorAll('.legend .swatch');
    expect(swatches.length).toBe(9);
    expect(swatches[0].classList.contains('dashed')).toBe(false);
    expect([...swatches[8].classList].sort()).toEqual(['dashed', 'series-0', 'swatch']);
    expect(drawn().map((line) => line.dashed)).toEqual([...Array(8).fill(false), true]);
    expect(drawn()[8].series).toBe(0);
  });

  it('colors a line by the place it is given instead of its place among the lines', () => {
    const element = render([
      { label: 'Hub', points: [], place: 0 },
      { label: 'Office PC', points: [], place: 9 },
    ]);
    const swatches = element.querySelectorAll('.legend .swatch');
    expect([...swatches[1].classList].sort()).toEqual(['dashed', 'series-1', 'swatch']);
    expect(drawn().map((line) => [line.series, line.dashed])).toEqual([
      [0, false],
      [1, true],
    ]);
  });
});

describe('pointerFraction', () => {
  it('tells where the pointer is across an element, within its edges', () => {
    const element = {
      getBoundingClientRect: () => ({ left: 100, width: 200 }),
    } as unknown as Element;
    const at = (clientX: number) => pointerFraction({ clientX } as PointerEvent, element);

    expect(at(150)).toBe(0.25);
    expect(at(50)).toBe(0);
    expect(at(400)).toBe(1);
  });
});

describe('lineSegments', () => {
  it('draws values below 0 at the bottom and above the top at the top', () => {
    const points = [
      { time: 0, value: -5 },
      { time: 60, value: 50 },
      { time: 120, value: 150 },
    ];
    expect(
      lineSegments(points, 0, 180, 60, 100)
        .flat()
        .map((p) => p.y),
    ).toEqual([1, 0.5, 0]);
  });
});

describe('needsYear', () => {
  const seconds = (date: Date) => date.getTime() / 1000;

  it('is needed over most of a year or into another year', () => {
    const may = seconds(new Date(2026, 4, 1));
    expect(needsYear(may, may + 30 * 86400)).toBe(false);
    expect(needsYear(seconds(new Date(2026, 0, 1)), seconds(new Date(2026, 6, 31)))).toBe(false);
    expect(needsYear(may - 400 * 86400, may)).toBe(true);
    expect(
      needsYear(seconds(new Date(2025, 11, 31, 23, 50)), seconds(new Date(2026, 0, 1, 0, 20))),
    ).toBe(true);
  });
});

describe('niceCeiling', () => {
  it('rounds temperatures up to the next ten degrees', () => {
    expect(niceCeiling(61, 'celsius')).toBe(70);
    expect(niceCeiling(0, 'celsius')).toBe(10);
  });

  it('rounds other values up to 1, 2 or 5 times a power of ten', () => {
    expect(niceCeiling(3.2, 'watts')).toBe(5);
    expect(niceCeiling(140, 'number')).toBe(200);
    expect(niceCeiling(0, 'perSecond')).toBe(1);
  });

  it('rounds network speeds up to a power of two', () => {
    expect(niceCeiling(300 * 1024, 'bytesPerSecond')).toBe(512 * 1024);
    expect(niceCeiling(0, 'bytesPerSecond')).toBe(1024);
  });
});
