import { DecimalPipe, formatDate } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';

import { securityText, signalLevel } from '../compare/wifi';
import { I18n } from '../i18n/i18n';
import { WiFiPosition } from '../metrics/metrics';
import { MapNetwork, reachMeters } from './networks';
import { bandsText } from './place-detail';
import { metersApart } from './places';

/**
 * The picked network: where it was heard best, how far it reaches, and every place it was heard
 * at, the best heard first, with in how many of the scans there and how far from the best place.
 */
@Component({
  selector: 'app-network-detail',
  imports: [DecimalPipe],
  templateUrl: './network-detail.html',
  styleUrl: './network-detail.css',
})
export class NetworkDetail {
  readonly network = input.required<MapNetwork>();
  readonly places = input.required<WiFiPosition[]>();
  readonly labels = input.required<string[]>();
  /** The index of a place the user picked, to see it among the places. */
  readonly pick = output<number>();

  protected readonly i18n = inject(I18n);
  protected readonly signalLevel = signalLevel;

  protected readonly reach = computed(() => reachMeters(this.network(), this.places()));
  protected readonly best = computed(() => this.network().at[0]);

  protected meta(): string {
    const n = this.network();
    return [bandsText(n.frequenciesMHz, this.i18n), securityText(this.i18n, n.security)]
      .filter((part) => part)
      .join(' · ');
  }

  /** How far a place is from the one the network was heard best at, in meters. */
  protected away(place: number): number {
    const best = this.places()[this.best()?.place ?? -1];
    return best ? metersApart(best, this.places()[place]) : 0;
  }

  /** A time, with the weekday and date, in the page's language. */
  protected time(seconds: number): string {
    return formatDate(seconds * 1000, this.i18n.t('format.dateTime'), this.i18n.language());
  }
}
