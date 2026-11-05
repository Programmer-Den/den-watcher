import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  EnergyPriceService,
  HOURS_PER_MONTH,
  currencyName,
  formatMoney,
  monthlyCost,
} from './energy-price';

describe('monthlyCost', () => {
  it('is what the draw costs in an average month around the clock', () => {
    expect(monthlyCost(10, { perKwh: 0.3, currency: 'EUR' })).toBeCloseTo(
      0.01 * HOURS_PER_MONTH * 0.3,
    );
    expect(monthlyCost(100, { perKwh: 0.3, currency: 'EUR' })).toBeCloseTo(21.915);
  });

  it('is null without a price', () => {
    expect(monthlyCost(10, null)).toBeNull();
    expect(monthlyCost(10, { perKwh: null, currency: 'EUR' })).toBeNull();
  });

  it('counts no power as free, and a value below zero as none', () => {
    expect(monthlyCost(0, { perKwh: 0.3, currency: 'EUR' })).toBe(0);
    expect(monthlyCost(-5, { perKwh: 0.3, currency: 'EUR' })).toBe(0);
  });
});

describe('formatMoney', () => {
  it('shows the amount in the currency and the language of the page', () => {
    expect(formatMoney(2.7, 'EUR', 'en-GB')).toBe('€2.70');
    expect(formatMoney(2.7, 'EUR', 'de')).toBe('2,70 €');
    expect(formatMoney(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
  });
});

describe('currencyName', () => {
  it('names the currency in the language of the page', () => {
    expect(currencyName('EUR', 'en-GB')).toBe('Euro');
    expect(currencyName('CHF', 'de')).toBe('Schweizer Franken');
  });
});

describe('EnergyPriceService', () => {
  let service: EnergyPriceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EnergyPriceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the price once', () => {
    service.load();
    service.load();
    http.expectOne('/api/energy-price').flush({ perKwh: 0.3, currency: 'EUR' });
    service.load();
    expect(service.price()).toEqual({ perKwh: 0.3, currency: 'EUR' });
  });

  it('tries again at the next call when the price could not be read', () => {
    service.load();
    http.expectOne('/api/energy-price').flush('gone', { status: 404, statusText: 'Not Found' });
    expect(service.price()).toBeNull();
    service.load();
    http.expectOne('/api/energy-price').flush({ perKwh: null, currency: 'EUR' });
    expect(service.price()).toEqual({ perKwh: null, currency: 'EUR' });
  });

  it('shows a saved price once the hub took it', () => {
    const price = { perKwh: 0.25, currency: 'CHF' };
    service.save(price).subscribe();
    expect(service.price()).toBeNull();
    const put = http.expectOne('/api/energy-price');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(price);
    put.flush(null);
    expect(service.price()).toEqual(price);
  });
});
