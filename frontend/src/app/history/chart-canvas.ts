import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';

import { ThemeService } from '../theme/theme';

/** A point of a line, as a fraction of the plot: 0 is the left and the top, 1 the right and the bottom. */
export interface PlotPoint {
  x: number;
  y: number;
}

/** One line to draw: its runs of joined points, split where values are missing. */
export interface CanvasLine {
  segments: PlotPoint[][];
  /** The color, by its place in the charts' palette (the `series-N` classes). */
  series: number;
  dashed: boolean;
  /** Drawn thin and faint behind the others, as the same line a week before. */
  faint?: boolean;
}

/**
 * How far the canvas reaches past the plot on every side, in CSS pixels, so a line at the very
 * top or bottom is drawn whole instead of cut in half.
 */
const BLEED = 4;

/** How opaque a faint line is. */
export const FAINT_ALPHA = 0.45;

/**
 * Draws lines on a canvas with Canvas 2D, sharp on high-density screens: the canvas takes as many
 * device pixels as it covers and is redrawn when its size, the lines or the color scheme change.
 * With `grid`, it also draws dotted lines at the top and middle and a solid baseline. The colors
 * come from the page's styles, so they follow light and dark mode.
 */
@Directive({
  selector: 'canvas[appChartCanvas]',
  host: {
    // Over the whole of the plot, which is the nearest positioned box, and past it by BLEED. It
    // takes no pointer, so the part past the plot does not act as the chart.
    style: `position: absolute; display: block; top: ${-BLEED}px; left: ${-BLEED}px;
      width: calc(100% + ${2 * BLEED}px); height: calc(100% + ${2 * BLEED}px);
      pointer-events: none;`,
  },
})
export class ChartCanvas {
  private readonly canvas = inject<ElementRef<HTMLCanvasElement>>(ElementRef).nativeElement;
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lines = input.required<CanvasLine[]>({ alias: 'appChartCanvas' });
  readonly grid = input(false);

  /** The canvas's size in CSS pixels, once it is laid out. */
  private size: { width: number; height: number } | null = null;

  /**
   * The colors read from the page's styles, by the class and value they were read with. Reading
   * them makes the browser work out the styles, so they are read again only when the color
   * scheme changes.
   */
  private readonly colors = new Map<string, string>();
  private colorsScheme: string | null = null;

  constructor() {
    effect(() => {
      // Redraws when the page switches between light and dark, as the colors change with it.
      this.theme.scheme();
      this.draw(this.lines(), this.grid());
    });

    afterNextRender(() => {
      // jsdom, which the tests run in, has no ResizeObserver; there is nothing to draw on there.
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(([entry]) => {
        const box = entry.contentRect;
        this.size = { width: box.width, height: box.height };
        this.draw(this.lines(), this.grid());
      });
      observer.observe(this.canvas);
      this.destroyRef.onDestroy(() => observer.disconnect());
      this.watchPixelRatio();
    });
  }

  /**
   * Draws again when the screen's pixel density changes, as when the window moves to another
   * screen, which leaves the canvas's size in CSS pixels as it was.
   */
  private watchPixelRatio(): void {
    const query = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (!query) {
      return;
    }
    const changed = () => {
      this.draw(this.lines(), this.grid());
      this.watchPixelRatio();
    };
    query.addEventListener('change', changed, { once: true });
    const stop = this.destroyRef.onDestroy(() => query.removeEventListener('change', changed));
    query.addEventListener('change', stop, { once: true });
  }

  private draw(lines: CanvasLine[], grid: boolean): void {
    const size = this.size;
    const context = size && this.canvas.getContext('2d');
    if (!size || !context) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const pixels = {
      width: Math.round(size.width * ratio),
      height: Math.round(size.height * ratio),
    };
    // Setting the size clears the canvas but also makes a new one, so it is set only when it changes.
    if (this.canvas.width !== pixels.width || this.canvas.height !== pixels.height) {
      this.canvas.width = pixels.width;
      this.canvas.height = pixels.height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    const width = size.width - 2 * BLEED;
    const height = size.height - 2 * BLEED;
    if (width <= 0 || height <= 0) {
      return;
    }
    const colors = this.readColors([
      ['', 'var(--mat-sys-outline-variant)'],
      ['', 'var(--mat-sys-outline)'],
      ...lines.map((line): [string, string] => [`series-${line.series}`, 'var(--color)']),
    ]);

    if (grid) {
      // Thin lines sit in the middle of a device pixel, so they stay one pixel wide and sharp.
      const crisp = (y: number) => (Math.floor(y * ratio) + 0.5) / ratio;
      context.lineWidth = 1 / ratio;
      context.setLineDash([2, 4]);
      context.strokeStyle = colors[0];
      context.beginPath();
      for (const y of [BLEED, BLEED + height / 2]) {
        context.moveTo(BLEED, crisp(y));
        context.lineTo(BLEED + width, crisp(y));
      }
      context.stroke();
      context.setLineDash([]);
      context.strokeStyle = colors[1];
      context.beginPath();
      context.moveTo(BLEED, crisp(BLEED + height - 1 / ratio));
      context.lineTo(BLEED + width, crisp(BLEED + height - 1 / ratio));
      context.stroke();
    }

    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    lines.forEach((line, index) => {
      context.globalAlpha = line.faint ? FAINT_ALPHA : 1;
      context.lineWidth = line.faint ? 1.5 : 2;
      context.setLineDash(line.dashed ? [6, 5] : []);
      context.strokeStyle = colors[index + 2];
      context.fillStyle = colors[index + 2];
      context.beginPath();
      for (const segment of line.segments) {
        segment.forEach((point, i) => {
          const x = BLEED + point.x * width;
          const y = BLEED + point.y * height;
          if (i === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
      }
      context.stroke();
      // A lone point is a dot as wide as the line; a line of no length is not drawn at all.
      context.beginPath();
      for (const segment of line.segments) {
        if (segment.length === 1) {
          const x = BLEED + segment[0].x * width;
          const y = BLEED + segment[0].y * height;
          context.moveTo(x + 1, y);
          context.arc(x, y, 1, 0, 2 * Math.PI);
        }
      }
      context.fill();
    });
    context.globalAlpha = 1;
  }

  /** The colors asked for, from the ones read before while the color scheme is the same. */
  private readColors(wanted: [className: string, value: string][]): string[] {
    const scheme = this.theme.scheme();
    if (scheme !== this.colorsScheme) {
      this.colors.clear();
      this.colorsScheme = scheme;
    }
    const key = ([className, value]: [string, string]) => `${className} ${value}`;
    const missing = wanted.filter((color) => !this.colors.has(key(color)));
    if (missing.length > 0) {
      readColors(this.canvas, missing).forEach((color, i) =>
        this.colors.set(key(missing[i]), color),
      );
    }
    return wanted.map((color) => this.colors.get(key(color))!);
  }
}

/**
 * Reads colors from the page's styles as they apply at `element`: each a CSS color, such as a
 * variable, with a class that sets it or none. They follow light and dark mode as the page does.
 */
function readColors(element: HTMLElement, wanted: [className: string, value: string][]): string[] {
  const probe = element.ownerDocument.createElement('span');
  probe.style.display = 'none';
  (element.parentElement ?? element).append(probe);
  try {
    return wanted.map(([className, value]) => {
      probe.className = className;
      probe.style.color = value;
      return getComputedStyle(probe).color;
    });
  } finally {
    probe.remove();
  }
}
