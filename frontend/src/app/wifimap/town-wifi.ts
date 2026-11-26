import { DecimalPipe, formatDate } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import { HubConnection } from '../connection/connection';
import { DeviceService } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { MapViewport } from '../map/map-view';
import { MetricsService, TownWiFi, nowSeconds } from '../metrics/metrics';
import { PageVisibility } from '../page-visibility';
import { phoneName } from './phone-name';
import { MAP_HEIGHT, MAP_WIDTH } from './places-map';
import { TownDay, accessPointMatches, quantile, townDays, townLines } from './town';
import { TownMap } from './town-map';

/** How often the town's Wi-Fi is read again: the phones send their scans every few minutes. */
export const TOWN_REFRESH_MS = 5 * 60_000;

/** How many access points or days the list shows until all are asked for. */
export const LIST_TOWN = 12;

/**
 * The Wi-Fi around town: where the hub learned each access point is from the phones' scans with a
 * GPS position, and a phone's way placed by those access points alone, next to its GPS to compare.
 * All of it is worked out on the hub; no outside location service is asked.
 */
@Component({
  selector: 'app-town-wifi',
  imports: [DecimalPipe, TownMap],
  templateUrl: './town-wifi.html',
  styleUrls: ['./wifi-map.css', './town-wifi.css'],
})
export class TownWifi {
  /** The range the ways are shown for, in seconds up to now. */
  readonly seconds = input.required<number>();
  readonly search = input('');

  private readonly metrics = inject(MetricsService);
  private readonly page = inject(PageVisibility);
  private readonly devices = inject(DeviceService);
  protected readonly i18n = inject(I18n);
  protected readonly connection = inject(HubConnection);
  protected readonly LIST_TOWN = LIST_TOWN;

  protected readonly viewport = new MapViewport(MAP_WIDTH, MAP_HEIGHT);
  protected readonly answer = signal<TownWiFi | null>(null);
  protected readonly failed = signal(false);
  protected readonly showAll = signal(false);

  /** Whether the access points around town are shown, or a phone's way placed by them. */
  protected readonly view = signal<'networks' | 'track'>('networks');

  protected readonly accessPoints = computed(() => this.answer()?.accessPoints ?? []);
  private readonly found = computed(() =>
    this.accessPoints()
      .map((ap, index) => ({ ap, index }))
      .filter((f) => accessPointMatches(f.ap, this.search())),
  );
  protected readonly foundCount = computed(() => this.found().length);
  protected readonly listed = computed(() =>
    this.showAll() ? this.found() : this.found().slice(0, LIST_TOWN),
  );

  /** The id of the picked access point, which stays picked as the town is read again. */
  private readonly pickedId = signal<string | null>(null);
  protected readonly selected = computed(() => {
    const index = this.accessPoints().findIndex((a) => a.id === this.pickedId());
    return index >= 0 || this.accessPoints().length === 0 ? index : 0;
  });
  protected readonly accessPoint = computed(() => this.accessPoints()[this.selected()]);

  protected readonly days = computed(() => townDays(this.answer()?.tracks ?? []));
  protected readonly listedDays = computed(() =>
    this.showAll() ? this.days() : this.days().slice(0, LIST_TOWN),
  );
  private readonly pickedDay = signal<string | null>(null);
  protected readonly day = computed(
    (): TownDay | undefined =>
      this.days().find((d) => d.key === this.pickedDay()) ?? this.days()[0],
  );
  protected readonly wifiLines = computed(() =>
    this.view() === 'track' ? townLines(this.day()?.points ?? []) : [],
  );
  protected readonly gpsLines = computed(() =>
    this.view() === 'track' ? townLines(this.day()?.points ?? [], true) : [],
  );
  /** How far the Wi-Fi placed the picked day's scans from their GPS: in the middle and for 9 of 10. */
  protected readonly off = computed(() => {
    const off = this.day()?.off ?? [];
    const middle = quantile(off, 0.5);
    const most = quantile(off, 0.9);
    return middle === undefined || most === undefined ? null : { middle, most };
  });

  protected showView(view: 'networks' | 'track'): void {
    this.view.set(view);
    this.showAll.set(false);
    this.fit(true);
  }

  protected pick(index: number): void {
    const ap = this.accessPoints()[index];
    if (ap) {
      this.pickedId.set(ap.id);
      if (this.viewport.zoomed()) {
        this.viewport.centerOn(ap);
      }
    }
  }

  protected pickDay(day: TownDay): void {
    this.pickedDay.set(day.key);
    this.fit(true);
  }

  /** Shows what the view draws on the map: all access points, or the picked day's way. */
  private fit(again: boolean): void {
    if (this.view() === 'networks') {
      this.viewport.show(this.accessPoints(), again);
    } else {
      this.viewport.show([...this.wifiLines(), ...this.gpsLines()].flat(), again);
    }
  }

  /** A phone's name, or "A removed phone" (see phoneName). */
  protected name(id: string): string {
    return phoneName(id, this.devices.devices(), this.i18n);
  }

  protected time(seconds: number, format: MessageKey = 'format.dateTime'): string {
    return formatDate(seconds * 1000, this.i18n.t(format), this.i18n.language());
  }

  constructor() {
    toObservable(this.seconds)
      .pipe(
        switchMap((seconds) => {
          this.answer.set(null);
          this.failed.set(false);
          this.viewport.show([], true);
          return this.page.poll(TOWN_REFRESH_MS, () => {
            const to = nowSeconds();
            return this.metrics.townWifi(to - seconds, to).pipe(
              catchError(() => {
                this.failed.set(true);
                return of(null);
              }),
            );
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((answer) => {
        if (answer) {
          this.failed.set(false);
          this.answer.set(answer);
          this.fit(false);
        }
      });
    // A search picks the first access point it finds, unless the picked one is among them, so the
    // map shows what the list does.
    effect(() => {
      const found = this.found();
      if (this.search().trim() && found.length > 0) {
        untracked(() => {
          if (!found.some((f) => f.index === this.selected())) {
            this.pick(found[0].index);
          }
        });
      }
    });
  }
}
