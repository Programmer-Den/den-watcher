import { DatePipe, NgTemplateOutlet, formatDate } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { ExtraUnit, formatExtra } from '../metrics/extras';
import { Point } from '../metrics/metrics';
import { CanvasLine, ChartCanvas, PlotPoint } from './chart-canvas';
import { ChartMarker, POINTER_SLACK, markersIn } from './chart-events';
import { ChartMarkers } from './chart-markers';
import { SHORT_SPAN } from './live-history';

/** What the values of a chart are: any unit an extra can have, but text. */
export type ChartUnit = Exclude<ExtraUnit, 'text'>;

/** One line of a chart, such as the CPU usage over time. */
export interface ChartLine {
  label: string;
  points: Point[];
  /**
   * The place the line takes its color by, when that is not its place among the lines: so a line
   * keeps its color in every chart, also where a line before it is left out.
   */
  place?: number;
}

/** What a chart draws, as the history and the comparison make it. */
export interface ChartData {
  /** What the chart shows, such as "CPU and memory", for its text alternative. */
  title: string;
  lines: ChartLine[];
  unit: ChartUnit;
  /** The top of the y axis; when not set, it fits the highest value. */
  max?: number;
}

/** How many colors the lines take in turn; lines after them are dashed. */
export const COLORS = 8;

/**
 * Draws lines over time, from `from` to `to` (Unix seconds), with one point
 * per `step` seconds. Moving the pointer over it shows every line's value at
 * that time. Where values are missing, such as while the machine was off,
 * the line has a gap.
 */
@Component({
  selector: 'app-line-chart',
  imports: [ChartCanvas, ChartMarkers, DatePipe, NgTemplateOutlet],
  templateUrl: './line-chart.html',
  styleUrl: './line-chart.css',
})
export class LineChart {
  protected readonly i18n = inject(I18n);

  readonly chart = input.required<ChartData>();
  readonly from = input.required<number>();
  readonly to = input.required<number>();
  readonly step = input.required<number>();
  /** What happened to the device, marked on the chart and told in the readout. */
  readonly markers = input<ChartMarker[]>([]);

  protected readonly lines = computed(() => this.chart().lines);
  private readonly unit = computed(() => this.chart().unit);

  protected readonly top = computed(() => chartTop(this.lines(), this.unit(), this.chart().max));

  protected readonly canvasLines = computed(() =>
    this.lines().map((line, index): CanvasLine => {
      const place = line.place ?? index;
      return {
        segments: lineSegments(line.points, this.from(), this.to(), this.step(), this.top()),
        series: place % COLORS,
        dashed: place >= COLORS,
      };
    }),
  );

  /** Whether the chart's dates need their year, so dates a year apart are told apart. */
  private readonly withYear = computed(() => needsYear(this.from(), this.to()));

  /**
   * The date format of the time axis: the time of day, with the day for longer
   * ranges and the year when it is needed.
   */
  protected readonly timeFormat = computed(() => {
    const span = this.to() - this.from();
    if (span <= SHORT_SPAN) {
      return this.i18n.t('format.timeSeconds');
    }
    if (span <= 86400) {
      return this.i18n.t('format.time');
    }
    if (span <= 8 * 86400) {
      return this.i18n.t('format.weekdayTime');
    }
    return this.i18n.t(this.withYear() ? 'format.dayMonthYear' : 'format.dayMonth');
  });

  /** For screen readers: what the chart shows, of which time, and each line's latest value. */
  protected readonly summary = computed(() => {
    const language = this.i18n.language();
    const format = this.i18n.t(dateTimeFormat(false, this.withYear()));
    const lines = this.lines().map((line) => {
      const latest = line.points.at(-1);
      return latest
        ? this.i18n.t('history.chartLineLatest', {
            label: line.label,
            value: this.format(latest.value),
          })
        : this.i18n.t('history.chartLineNoData', { label: line.label });
    });
    return this.i18n.t('history.chartSummary', {
      title: this.chart().title,
      from: formatDate(this.from() * 1000, format, language),
      to: formatDate(this.to() * 1000, format, language),
      lines: new Intl.ListFormat(language).format(lines),
    });
  });

  /** The start of the step under the pointer, or null when the pointer is elsewhere. */
  protected readonly hoverTime = signal<number | null>(null);

  /** The date format of the tooltip, with seconds when a step is shorter than a minute. */
  protected readonly readoutFormat = computed(() =>
    this.i18n.t(dateTimeFormat(this.step() < 60, this.withYear())),
  );

  protected readonly readout = computed(() => {
    const time = this.hoverTime();
    if (time === null) {
      return null;
    }
    return {
      time,
      left: stepCenter(time, this.from(), this.to(), this.step()),
      values: this.lines().map((line) => line.points.find((p) => p.time === time)?.value ?? null),
      events: markersIn(
        this.markers(),
        time,
        this.step(),
        (this.to() - this.from()) * POINTER_SLACK,
      ),
    };
  });

  /** The color of a line by its place, dashed once every color is taken. */
  protected seriesClass(line: ChartLine, index: number): string {
    const place = line.place ?? index;
    return `series-${place % COLORS}` + (place >= COLORS ? ' dashed' : '');
  }

  /** A value with the chart's unit, in the page's language. */
  protected format(value: number): string {
    return formatExtra(value, this.unit(), this.i18n.language());
  }

  protected onPointerMove(event: PointerEvent): void {
    this.hoverTime.set(stepUnder(event, this.from(), this.to(), this.step()));
  }

  protected onPointerLeave(): void {
    this.hoverTime.set(null);
  }
}

/**
 * The start of the step under the pointer on a time axis that runs across the event's target, from
 * `from` to `to` (Unix seconds) in steps of `step` seconds.
 */
export function stepUnder(event: PointerEvent, from: number, to: number, step: number): number {
  const time = from + pointerFraction(event, event.currentTarget as Element) * (to - from);
  // The right edge belongs to the last step, which starts before `to`.
  return Math.floor(Math.min(time, to - 1) / step) * step;
}

/** Where the pointer is across an element, as a fraction of its width from 0 to 1. */
export function pointerFraction(event: PointerEvent, element: Element): number {
  const area = element.getBoundingClientRect();
  return Math.min(1, Math.max(0, (event.clientX - area.left) / area.width));
}

/** Where the middle of the step that starts at `time` is on a time axis, in percent of its width. */
export function stepCenter(time: number, from: number, to: number, step: number): number {
  return ((time + step / 2 - from) / (to - from)) * 100;
}

/**
 * The points of a line from `from` to `to` (Unix seconds) with one point per `step` seconds, as
 * fractions of the plot with `top` at the top, in runs that a gap in the values splits.
 */
export function lineSegments(
  points: Point[],
  from: number,
  to: number,
  step: number,
  top: number,
): PlotPoint[][] {
  const segments: PlotPoint[][] = [];
  let previous: number | null = null;
  for (const point of points) {
    // Each point is the average of its step, so it is drawn in the step's middle.
    const x = (point.time + step / 2 - from) / (to - from);
    // A value below 0, such as a temperature below freezing, is drawn at the bottom.
    const y = 1 - Math.min(Math.max(point.value, 0), top) / top;
    if (previous === null || point.time - previous > 2 * step) {
      segments.push([]);
    }
    segments[segments.length - 1].push({ x, y });
    previous = point.time;
  }
  return segments;
}

/**
 * Whether dates from `from` to `to` (Unix seconds) need their year: when they
 * span most of a year, or the new year falls between them.
 */
export function needsYear(from: number, to: number): boolean {
  return (
    to - from > 300 * 86400 ||
    new Date(from * 1000).getFullYear() !== new Date(to * 1000).getFullYear()
  );
}

/** The key of the date and time format, with seconds and the year as asked. */
export function dateTimeFormat(seconds: boolean, year: boolean): MessageKey {
  if (year) {
    return seconds ? 'format.dateTimeSecondsYear' : 'format.dateTimeYear';
  }
  return seconds ? 'format.dateTimeSeconds' : 'format.dateTime';
}

/** The top of the y axis: `max` when it is set, else a round number above the highest value. */
export function chartTop(lines: ChartLine[], unit: ChartUnit, max?: number): number {
  if (max !== undefined) {
    return max;
  }
  const highest = Math.max(0, ...lines.flatMap((line) => line.points.map((p) => p.value)));
  return niceCeiling(highest, unit);
}

/**
 * A round number at or above value for the top of the y axis: the next ten
 * percent or degrees; the next power of two bytes so the axis reads 1 MiB/s
 * instead of 0.95 MiB/s; else the next 1, 2 or 5 times a power of ten.
 */
export function niceCeiling(value: number, unit: ChartUnit): number {
  if (unit === 'bytesPerSecond' || unit === 'bytes') {
    return 2 ** Math.ceil(Math.log2(Math.max(value, 1024)));
  }
  if (unit === 'percent' || unit === 'celsius') {
    return Math.max(10, Math.ceil(value / 10) * 10);
  }
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const nice = [1, 2, 5, 10].find((n) => n * power >= value) ?? 10;
  return nice * power;
}
