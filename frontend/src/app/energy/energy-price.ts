import { formatNumber } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { LanguageCode } from '../i18n/i18n';
import { Point } from '../metrics/metrics';

/** What a kilowatt-hour costs, as GET and PUT /api/energy-price carry it. */
export interface EnergyPrice {
  /** The price of a kilowatt-hour; null while none was entered, and no costs show then. */
  perKwh: number | null;
  /** The price's currency as its ISO 4217 code, such as "EUR". */
  currency: string;
}

/** The currencies the price can be entered in, the euro first, as the hub assumes it. */
export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'CAD',
  'AUD',
  'JPY',
] as const;

/** The highest price per kilowatt-hour the hub takes, so a price in cents is caught. */
export const MAX_PER_KWH = 1000;

/** How long a price that could not be read waits before it is asked for again: 5 minutes. */
export const RETRY_MILLIS = 5 * 60 * 1000;

/** The hours of an average month: a year, leap days included, in twelve. */
export const HOURS_PER_MONTH = (365.25 * 24) / 12;

/**
 * The price of energy entered on the hub, read once and kept for every page
 * that shows costs. A hub without it, such as one of a version from before
 * it, leaves it null, and the page shows no costs then.
 */
@Injectable({ providedIn: 'root' })
export class EnergyPriceService {
  private readonly http = inject(HttpClient);
  private loading = false;
  /** When the price could not be read last, in Unix milliseconds; 0 until then. */
  private failedAt = 0;

  readonly price = signal<EnergyPrice | null>(null);

  /**
   * Reads the price once. One that cannot be read is tried again at a call
   * from RETRY_MILLIS on, so a hub without it is not asked at every reading.
   */
  load(): void {
    if (this.loading || this.price() || Date.now() - this.failedAt < RETRY_MILLIS) {
      return;
    }
    this.loading = true;
    this.http.get<EnergyPrice>('/api/energy-price').subscribe({
      next: (price) => {
        this.loading = false;
        this.price.set(price);
      },
      error: () => {
        this.loading = false;
        this.failedAt = Date.now();
      },
    });
  }

  /** Keeps a new price on the hub, and shows it once the hub took it. */
  save(price: EnergyPrice): Observable<unknown> {
    return this.http.put('/api/energy-price', price).pipe(tap(() => this.price.set(price)));
  }
}

/** What drawing `watts` for a month around the clock costs; null without a price. */
export function monthlyCost(watts: number, price: EnergyPrice | null): number | null {
  if (price?.perKwh === null || price?.perKwh === undefined || !Number.isFinite(watts)) {
    return null;
  }
  return (Math.max(watts, 0) / 1000) * HOURS_PER_MONTH * price.perKwh;
}

/** An amount of money in the page's language, with two decimals, such as "€2.70". */
export function formatMoney(amount: number, currency: string, language: LanguageCode): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** The name of a currency in the page's language, such as "Euro"; its code where none is known. */
export function currencyName(currency: string, language: LanguageCode): string {
  try {
    return new Intl.DisplayNames([language], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

/**
 * The energy a value of the power add-on used from `from` to `to`, in watt-hours, from its history:
 * each point is the average power of a step of `stepSeconds` that starts at its time, counted as far
 * as the step lies in the range. A step without a point, while the device was off or not read, used
 * nothing that was measured, and a value below zero counts as none.
 */
export function energyUsed(points: Point[], stepSeconds: number, from: number, to: number): number {
  let wattSeconds = 0;
  for (const point of points) {
    const seconds = Math.min(point.time + stepSeconds, to) - Math.max(point.time, from);
    if (seconds > 0 && Number.isFinite(point.value)) {
      wattSeconds += Math.max(point.value, 0) * seconds;
    }
  }
  return wattSeconds / 3600;
}

/** What `wattHours` of energy cost at the price; null without a price. */
export function energyCost(wattHours: number, price: EnergyPrice | null): number | null {
  if (price?.perKwh === null || price?.perKwh === undefined) {
    return null;
  }
  return (wattHours / 1000) * price.perKwh;
}

/** An amount of energy in the page's language: in Wh below 1 kWh, such as "350 Wh", else "1.25 kWh". */
export function formatEnergy(wattHours: number, language: LanguageCode): string {
  return wattHours < 1000
    ? `${formatNumber(wattHours, language, '1.0-0')} Wh`
    : `${formatNumber(wattHours / 1000, language, '1.0-2')} kWh`;
}
