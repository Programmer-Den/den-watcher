import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnergyPriceForm } from './energy-price-form';

describe('EnergyPriceForm', () => {
  let fixture: ComponentFixture<EnergyPriceForm>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EnergyPriceForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EnergyPriceForm);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function price(): HTMLInputElement {
    return element().querySelector<HTMLInputElement>('input[name="energy-price"]')!;
  }

  function currency(): HTMLSelectElement {
    return element().querySelector<HTMLSelectElement>('select[name="energy-currency"]')!;
  }

  function button(): HTMLButtonElement {
    return element().querySelector<HTMLButtonElement>('button[type="submit"]')!;
  }

  async function shown(answer: object): Promise<void> {
    http.expectOne('/api/energy-price').flush(answer);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(value: string): Promise<void> {
    price().value = value;
    price().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows the stored price and what 100 W cost at it', async () => {
    await shown({ perKwh: 0.3, currency: 'CHF' });
    expect(price().value).toBe('0.3');
    expect(currency().value).toBe('CHF');
    expect(element().textContent).toContain('100 W around the clock cost CHF');
  });

  it('saves the typed price in the picked currency', async () => {
    await shown({ perKwh: null, currency: 'EUR' });
    await type('0.28');
    currency().value = 'USD';
    currency().dispatchEvent(new Event('change'));
    fixture.detectChanges();
    button().click();
    const put = http.expectOne('/api/energy-price');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ perKwh: 0.28, currency: 'USD' });
    put.flush(null);
    fixture.detectChanges();
    expect(element().textContent).toContain('The energy price is saved.');
  });

  it('takes the price away when the field is emptied', async () => {
    await shown({ perKwh: 0.3, currency: 'EUR' });
    await type('');
    button().click();
    const put = http.expectOne('/api/energy-price');
    expect(put.request.body).toEqual({ perKwh: null, currency: 'EUR' });
    put.flush(null);
    fixture.detectChanges();
    expect(element().textContent).toContain('No price is set, so no costs are shown.');
  });

  it('refuses a price that is out of range', async () => {
    await shown({ perKwh: null, currency: 'EUR' });
    await type('1500');
    expect(button().disabled).toBe(true);
    expect(element().textContent).toContain('Enter a price from 0 to 1000.');
  });

  it('tells when the price could not be saved', async () => {
    await shown({ perKwh: null, currency: 'EUR' });
    await type('0.3');
    button().click();
    http
      .expectOne('/api/energy-price')
      .flush('no', { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();
    expect(element().querySelector('[role="alert"]')?.textContent).toContain(
      'The price could not be saved.',
    );
  });
});
