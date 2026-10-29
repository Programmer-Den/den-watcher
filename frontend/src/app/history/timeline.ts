import { DatePipe, formatDate } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { I18n } from '../i18n/i18n';
import { ChartEvents } from './chart-events';
import { HistoryStore } from './history-store';
import { Chart, DeviceCharts } from './history';
import { COLORS, dateTimeFormat, needsYear, pointerFraction, stepCenter } from './line-chart';
import { SHORT_SPAN } from './live-history';
import { TimelineOverview } from './timeline-overview';
import { TimelineLine, TimelineRow } from './timeline-row';
import { CsvDownload } from './csv-download';
import { TimelineMarks } from './timeline-marks';
import { Stretch, TimelineZoom } from './timeline-zoom';

/**
 * Every value of the picked device as one row, all over one time axis: the range picked at the top
 * of the page. Moving the pointer over any row shows a line across all rows and every value at
 * that time, so a CPU spike lines up with a disk write or a temperature rise.
 *
 * Dragging across the rows zooms every row into that stretch, and the trail above them goes back.
 * A strip over the whole range shows where the stretch lies, and moving its window moves the
 * stretch. The timeline opens on the whole range; a zoom lasts until the range or device changes.
 */
@Component({
  selector: 'app-timeline',
  imports: [CsvDownload, DatePipe, TimelineMarks, TimelineOverview, TimelineRow],
  providers: [TimelineZoom],
  template: `
    @if (whole(); as w) {
      @if (shown(); as h) {
        @if (wholeLines().length > 0) {
          <nav class="trail" [attr.aria-label]="i18n.t('timeline.trail')">
            <button
              type="button"
              [attr.aria-current]="zoom.trail().length === 0 ? 'step' : null"
              (click)="zoom.back(zoom.trail().length)"
            >
              {{ i18n.t('timeline.wholeRange') }}
            </button>
            @for (stretch of zoom.trail(); track $index; let last = $last) {
              <span class="next" aria-hidden="true">›</span>
              <button
                type="button"
                [attr.aria-current]="last ? 'step' : null"
                (click)="zoom.back(zoom.trail().length - 1 - $index)"
              >
                {{ stretchLabel(stretch) }}
              </button>
            }
            @if (zoom.trail().length > 0) {
              <button type="button" class="back" (click)="zoom.back()">
                ← {{ i18n.t('timeline.back') }}
              </button>
              @if (zoom.stretch(); as stretch) {
                <app-csv-download [from]="stretch.from" [to]="stretch.to" />
              }
            } @else {
              <span class="hint">{{ i18n.t('timeline.zoomHint') }}</span>
            }
          </nav>
          @if (overviewLine(); as line) {
            <app-timeline-overview
              [line]="line"
              [from]="w.from"
              [to]="w.to"
              [step]="w.stepSeconds"
              [window]="zoom.stretch()"
              (picked)="pick($event)"
            />
          }
          @if (!zoom.failed()) {
            <div class="axis" aria-hidden="true">
              <span>{{ h.from * 1000 | date: dateFormat() : undefined : i18n.language() }}</span>
              @if (brushed(); as stretch) {
                <span class="at" [style.left.%]="brushCenter()">{{ stretchLabel(stretch) }}</span>
              } @else if (shownCursor(); as time) {
                <span class="at">{{
                  time * 1000 | date: dateFormat() : undefined : i18n.language()
                }}</span>
              }
              <span>{{ h.to * 1000 | date: dateFormat() : undefined : i18n.language() }}</span>
            </div>
          }
          <div
            class="rows"
            role="list"
            [attr.aria-label]="i18n.t('timeline.label')"
            (pointerdown)="brushStart($event)"
            (pointermove)="brushMove($event)"
            (pointerup)="brushEnd()"
            (pointercancel)="brush.set(null)"
            (dblclick)="zoom.back()"
          >
            @if (zoom.failed()) {
              <p class="nothing" role="listitem">{{ i18n.t('history.unreachable') }}</p>
            } @else {
              <!-- Always there, also without marks, so the rows never move down when one comes in. -->
              <app-timeline-marks
                [markers]="marked()"
                [from]="h.from"
                [to]="h.to"
                [step]="h.stepSeconds"
                [cursor]="shownCursor()"
                (hover)="cursor.set($event)"
              />
              @for (line of lines(); track $index) {
                <app-timeline-row
                  [line]="line"
                  [from]="h.from"
                  [to]="h.to"
                  [step]="h.stepSeconds"
                  [cursor]="shownCursor()"
                  (hover)="cursor.set($event)"
                />
              } @empty {
                <p class="nothing" role="listitem">{{ i18n.t('timeline.nothingRecorded') }}</p>
              }
            }
          </div>
        }
      }
    }
  `,
  styleUrl: './timeline.css',
  host: {
    '[style.--cursor]': 'cursorLeft()',
    '[style.--cursor-display]': "shownCursor() === null ? 'none' : 'block'",
    '[style.--band-left]': 'bandLeft()',
    '[style.--band-width]': 'bandWidth()',
    '[style.--band-display]': "brushed() === null ? 'none' : 'block'",
  },
})
export class Timeline {
  protected readonly store = inject(HistoryStore);
  protected readonly i18n = inject(I18n);
  protected readonly zoom = inject(TimelineZoom);
  private readonly events = inject(ChartEvents);
  private readonly deviceCharts = inject(DeviceCharts);

  /** The history of the whole range picked at the top of the page. */
  protected readonly whole = this.store.history;

  /** The history the rows show: of the stretch zoomed into, or else of the whole range. */
  protected readonly shown = computed(() =>
    this.zoom.stretch() ? (this.zoom.history() ?? this.whole()) : this.whole(),
  );

  /** What happened to the device within the shown history, for the row of marks. */
  protected readonly marked = computed(() => {
    const history = this.shown();
    return history
      ? this.events
          .markers()
          .filter((m) => (m.end ?? m.time) >= history.from && m.time <= history.to)
      : [];
  });

  /** The step under the pointer, or null while the pointer is elsewhere. */
  protected readonly cursor = signal<number | null>(null);

  /** Where a drag across the rows started and is now, as fractions of the time axis. */
  protected readonly brush = signal<{ start: number; end: number } | null>(null);

  /**
   * Each line of each chart, in the order of the categories; a chart of several names each line,
   * unless the line is named as the chart, such as the memory line of the memory chart.
   * Every strip fits its own values, without the chart's top, so a change shows in each row.
   */
  protected readonly lines = computed(() => linesOf(this.deviceCharts.categoriesOf(this.shown())));

  /**
   * The lines over the whole range. While it has any, the timeline shows with its trail, also for a
   * stretch zoomed into that has none, such as a night a PC was switched off.
   */
  protected readonly wholeLines = computed(() => linesOf(this.deviceCharts.byCategory()));

  /** The first value over the whole range, usually the CPU, for the strip above the rows. */
  protected readonly overviewLine = computed((): TimelineLine | undefined => this.wholeLines()[0]);

  /**
   * The step under the pointer while it is a step of the shown history; one left from before the
   * range or the device changed is not.
   */
  protected readonly shownCursor = computed(() => {
    const time = this.cursor();
    const history = this.shown();
    const shown =
      time !== null &&
      history !== null &&
      time % history.stepSeconds === 0 &&
      time > history.from - history.stepSeconds &&
      time < history.to;
    return shown ? time : null;
  });

  /** Where the crosshair is, in the middle of the step under the pointer. */
  protected readonly cursorLeft = computed(() => {
    const time = this.shownCursor();
    const history = this.shown();
    return time === null || !history
      ? null
      : `${stepCenter(time, history.from, history.to, history.stepSeconds)}%`;
  });

  /** The stretch a drag across the rows marks, once it is long enough to be more than a click. */
  protected readonly brushed = computed((): Stretch | null => {
    const brush = this.brush();
    const history = this.shown();
    if (!brush || !history || Math.abs(brush.end - brush.start) < MIN_BRUSH) {
      return null;
    }
    const at = (fraction: number) => history.from + fraction * (history.to - history.from);
    return {
      from: at(Math.min(brush.start, brush.end)),
      to: at(Math.max(brush.start, brush.end)),
    };
  });

  protected readonly bandLeft = computed(() => {
    const brush = this.brush();
    return brush ? `${Math.min(brush.start, brush.end) * 100}%` : null;
  });

  protected readonly bandWidth = computed(() => {
    const brush = this.brush();
    return brush ? `${Math.abs(brush.end - brush.start) * 100}%` : null;
  });

  protected readonly brushCenter = computed(() => {
    const brush = this.brush();
    return brush ? ((brush.start + brush.end) / 2) * 100 : 0;
  });

  protected readonly dateFormat = computed(() => {
    const history = this.shown();
    const year = history !== null && needsYear(history.from, history.to);
    return this.i18n.t(dateTimeFormat(history !== null && history.stepSeconds < 60, year));
  });

  constructor() {
    this.store.watch.pipe(takeUntilDestroyed()).subscribe();
    this.events.watch.pipe(takeUntilDestroyed()).subscribe();
  }

  /**
   * A stretch as its start and end; the end without its day when both are on the same day.
   */
  protected stretchLabel({ from, to }: Stretch): string {
    const language = this.i18n.language();
    const seconds = to - from <= SHORT_SPAN;
    const year = needsYear(from, to);
    const start = formatDate(from * 1000, this.i18n.t(dateTimeFormat(seconds, year)), language);
    const sameDay = new Date(from * 1000).toDateString() === new Date(to * 1000).toDateString();
    const endFormat = sameDay
      ? this.i18n.t(seconds ? 'format.timeSeconds' : 'format.time')
      : this.i18n.t(dateTimeFormat(seconds, year));
    return `${start} – ${formatDate(to * 1000, endFormat, language)}`;
  }

  /** A stretch picked on the strip; one covering the whole range shows the whole range. */
  protected pick(stretch: Stretch): void {
    const whole = this.whole();
    if (whole && stretch.from <= whole.from && stretch.to >= whole.to) {
      this.zoom.back(this.zoom.trail().length);
    } else {
      this.zoom.move(stretch);
    }
  }

  protected brushStart(event: PointerEvent): void {
    const strip = (event.target as Element).closest('.strip');
    if (event.button !== 0 || !strip) {
      return;
    }
    // A drag zooms in instead of selecting the labels' text.
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const fraction = this.fractionAt(event);
    this.brush.set({ start: fraction, end: fraction });
  }

  protected brushMove(event: PointerEvent): void {
    const brush = this.brush();
    if (brush) {
      this.cursor.set(null);
      this.brush.set({ ...brush, end: this.fractionAt(event) });
    }
  }

  protected brushEnd(): void {
    const stretch = this.brushed();
    this.brush.set(null);
    if (stretch) {
      this.zoom.zoomIn(stretch);
    }
  }

  /** Where the pointer is on the rows' time axis, as a fraction of it. */
  private fractionAt(event: PointerEvent): number {
    const rows = event.currentTarget as HTMLElement;
    return pointerFraction(event, rows.querySelector('.strip')!);
  }
}

/** A drag across the rows shorter than this fraction of the time axis is a click. */
const MIN_BRUSH = 0.01;

/** Each line of each chart as a row of the timeline, in the order of the categories. */
function linesOf(byCategory: Map<string, Chart[]>): TimelineLine[] {
  return [...byCategory.values()].flat().flatMap((chart) =>
    chart.lines.map((line, index) => ({
      label:
        chart.lines.length > 1 && line.label !== chart.title
          ? `${chart.title} · ${line.label}`
          : chart.title,
      unit: chart.unit,
      points: line.points,
      series: (line.place ?? index) % COLORS,
    })),
  );
}
