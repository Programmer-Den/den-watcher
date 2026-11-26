import { DecimalPipe, formatDate } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { bandText, securityText, signalLevel, wifiBand } from '../compare/wifi';
import { DeviceService } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { MetricsService, PositionNetwork, WiFiPosition } from '../metrics/metrics';
import { phoneName, REMOVED_PHONE_PREFIX } from './phone-name';
import { SameSuggestion, heardIn, sameAs, yourNetwork } from './places';

/** The bands of a network's frequencies, such as "2.4 GHz · 5 GHz". */
export function bandsText(frequencies: number[] | undefined, i18n: I18n): string {
  const bands = [...new Set((frequencies ?? []).map(wifiBand))]
    .filter((b) => b !== undefined)
    .sort((a, b) => a - b);
  return bands.map((b) => bandText(b, i18n)).join(' · ');
}

/**
 * The picked place: its name, which the user can change, the places that are likely the same,
 * which the user can merge into one or keep apart, and every network heard there, the best heard
 * first, with in how many of the scans, which phones heard it how well and when last.
 */
@Component({
  selector: 'app-place-detail',
  imports: [DecimalPipe],
  templateUrl: './place-detail.html',
  styleUrl: './place-detail.css',
})
export class PlaceDetail {
  readonly places = input.required<WiFiPosition[]>();
  readonly labels = input.required<string[]>();
  readonly index = input.required<number>();
  /** The index of another place the user picked. */
  readonly pick = output<number>();
  /** The user changed a place on the hub, so the places are read again. */
  readonly changed = output<void>();

  private readonly metrics = inject(MetricsService);
  private readonly devices = inject(DeviceService);
  protected readonly i18n = inject(I18n);
  protected readonly signalLevel = signalLevel;

  protected readonly place = computed(() => this.places()[this.index()]);
  protected readonly label = computed(() => this.labels()[this.index()]);
  protected readonly yours = computed(() => yourNetwork(this.place()));
  protected readonly same = computed(() => sameAs(this.places(), this.index()));

  /** The name being typed, or null while the place is not renamed. */
  protected readonly renaming = signal<string | null>(null);
  /** What went wrong with the last change, or ''. */
  protected readonly problem = signal('');
  protected readonly busy = signal(false);

  protected rename(): void {
    this.problem.set('');
    this.renaming.set(this.place().name ?? '');
  }

  protected saveName(name: string): void {
    this.change(this.metrics.renamePosition(this.place().id, name.trim()), () =>
      this.renaming.set(null),
    );
  }

  /**
   * Merges two places that are the same: the one with fewer scans into the other, or the one
   * without a name into the named one, which keeps its name.
   */
  protected merge(s: SameSuggestion): void {
    const [from, into] = this.mergeOrder(s);
    this.change(this.metrics.mergePosition(from.id, into.id));
  }

  /** The place merged and the one it is merged into. */
  protected mergeOrder(s: SameSuggestion): [WiFiPosition, WiFiPosition] {
    const here = this.place();
    const other = this.places()[s.place];
    const keepOther = !!other.name !== !!here.name ? !!other.name : other.scans > here.scans;
    return keepOther ? [here, other] : [other, here];
  }

  protected mergeInto(s: SameSuggestion): string {
    const into = this.mergeOrder(s)[1];
    return this.labels()[this.places().indexOf(into)];
  }

  protected keepApart(s: SameSuggestion): void {
    this.change(this.metrics.keepPositionsApart(this.place().id, this.places()[s.place].id));
  }

  protected split(id: number): void {
    this.change(this.metrics.mergePosition(id, null));
  }

  private change(request: Observable<void>, done?: () => void): void {
    this.busy.set(true);
    this.problem.set('');
    request.subscribe({
      next: () => {
        this.busy.set(false);
        done?.();
        this.changed.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.problem.set(
          this.i18n.t(error.status === 400 ? 'wifiMap.refused' : 'wifiMap.changeFailed'),
        );
      },
    });
  }

  /** The names of the phones that scanned at the place; the removed ones share one name, given once. */
  protected phones(): string {
    const devices = this.place().devices;
    const removed = devices.find((id) => id.startsWith(REMOVED_PHONE_PREFIX));
    return devices
      .filter((id) => id === removed || !id.startsWith(REMOVED_PHONE_PREFIX))
      .map((id) => this.name(id))
      .join(', ');
  }

  /** A phone's name, or "A removed phone" (see phoneName). */
  protected name(id: string): string {
    return phoneName(id, this.devices.devices(), this.i18n);
  }

  protected heardIn(network: PositionNetwork): string {
    return this.i18n.t('wifiMap.heardIn', {
      count: Math.min(heardIn(network), this.place().scans),
      scans: this.place().scans,
    });
  }

  /** A time, with the weekday and date, in the page's language. */
  protected time(seconds: number): string {
    return formatDate(seconds * 1000, this.i18n.t('format.dateTime'), this.i18n.language());
  }

  /**
   * A network's bands, security and access points, such as "2.4 GHz · 5 GHz · WPA2/WPA3 · 2 access
   * points"; one access point is not told.
   */
  protected meta(network: PositionNetwork): string {
    const accessPoints = network.accessPoints ?? 0;
    return [
      bandsText(network.frequenciesMHz, this.i18n),
      securityText(this.i18n, network.security),
      accessPoints > 1
        ? this.i18n.plural(
            accessPoints,
            'wifiPositions.accessPoints.one',
            'wifiPositions.accessPoints.other',
          )
        : '',
    ]
      .filter((part) => part)
      .join(' · ');
  }
}
