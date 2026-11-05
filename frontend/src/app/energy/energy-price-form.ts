import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { I18n } from '../i18n/i18n';
import {
  CURRENCIES,
  EnergyPriceService,
  MAX_PER_KWH,
  currencyName,
  formatMoney,
  monthlyCost,
} from './energy-price';

/**
 * Where the price of a kilowatt-hour is entered, which the Power cards turn
 * into what each value costs in a month. Like the layout it needs no
 * password, as it changes only what the page shows.
 */
@Component({
  selector: 'app-energy-price-form',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <form class="energy-price" (ngSubmit)="save()">
      <h3>{{ i18n.t('energy.title') }}</h3>
      <p class="hint">{{ i18n.t('energy.hint') }}</p>
      <mat-form-field class="price">
        <mat-label>{{ i18n.t('energy.perKwh') }}</mat-label>
        <input
          matInput
          type="number"
          name="energy-price"
          inputmode="decimal"
          min="0"
          [max]="max"
          step="any"
          [ngModel]="perKwh()"
          (ngModelChange)="edit($event)"
        />
      </mat-form-field>
      <mat-form-field class="currency">
        <mat-label>{{ i18n.t('energy.currency') }}</mat-label>
        <select
          matNativeControl
          name="energy-currency"
          [ngModel]="currency()"
          (ngModelChange)="pick($event)"
        >
          @for (code of currencies(); track code) {
            <option [value]="code">{{ code }} · {{ name(code) }}</option>
          }
        </select>
      </mat-form-field>
      <!-- Below the fields, where a hint of any length has room. -->
      @if (outOfRange()) {
        <p class="error">{{ i18n.t('energy.range', { max: max }) }}</p>
      } @else if (example(); as text) {
        <p class="hint">{{ text }}</p>
      }
      <button mat-stroked-button type="submit" [disabled]="busy() || !canSave()">
        {{ i18n.t('energy.save') }}
      </button>
      @if (saved()) {
        <p class="hint" role="status">
          {{ i18n.t(perKwh() === null ? 'energy.removed' : 'energy.saved') }}
        </p>
      }
      @if (failed()) {
        <p class="error" role="alert">{{ i18n.t('energy.failed') }}</p>
      }
    </form>
  `,
  styles: `
    /* Laid out like the other forms of the list of devices, its button on a line of its own. */
    form.energy-price {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 0.75rem;
      margin-top: 1.25rem;
    }
    h3 {
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-small);
    }
    p {
      margin: 0 0 0.75rem;
    }
    h3,
    p {
      flex-basis: 100%;
    }
    mat-form-field {
      flex: 1 1 12rem;
    }
    button {
      flex-basis: 100%;
      max-width: max-content;
    }
    button + p {
      margin-top: 0.75rem;
    }
  `,
})
export class EnergyPriceForm {
  protected readonly i18n = inject(I18n);
  private readonly energy = inject(EnergyPriceService);

  protected readonly max = MAX_PER_KWH;
  /** What was typed, until it is saved; null while the field is empty. */
  private readonly typed = signal<number | null | undefined>(undefined);
  private readonly picked = signal<string | undefined>(undefined);
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly failed = signal(false);

  protected readonly perKwh = computed(() => {
    const typed = this.typed();
    return typed !== undefined ? typed : (this.energy.price()?.perKwh ?? null);
  });
  protected readonly currency = computed(
    () => this.picked() ?? this.energy.price()?.currency ?? CURRENCIES[0],
  );
  /** The listed currencies, and the stored one too when it is not among them. */
  protected readonly currencies = computed((): readonly string[] => {
    const stored = this.energy.price()?.currency;
    return stored && !(CURRENCIES as readonly string[]).includes(stored)
      ? [...CURRENCIES, stored]
      : CURRENCIES;
  });
  protected readonly outOfRange = computed(() => {
    const price = this.perKwh();
    return price !== null && (price < 0 || price > MAX_PER_KWH);
  });
  protected readonly canSave = computed(() => !this.outOfRange());
  /** What 100 W cost in a month at the typed price, so a price in the wrong unit stands out. */
  protected readonly example = computed(() => {
    const perKwh = this.perKwh();
    const cost = monthlyCost(100, { perKwh, currency: this.currency() });
    return cost === null || this.outOfRange()
      ? null
      : this.i18n.t('energy.example', {
          cost: formatMoney(cost, this.currency(), this.i18n.language()),
        });
  });

  constructor() {
    this.energy.load();
  }

  protected name(code: string): string {
    return currencyName(code, this.i18n.language());
  }

  /** Takes what was typed; an empty field or one that is not a number takes the price away. */
  protected edit(value: number | string | null): void {
    const number = typeof value === 'number' ? value : value ? Number(value) : NaN;
    this.typed.set(Number.isFinite(number) ? number : null);
    this.saved.set(false);
  }

  protected pick(code: string): void {
    this.picked.set(code);
    this.saved.set(false);
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    this.saved.set(false);
    this.energy.save({ perKwh: this.perKwh(), currency: this.currency() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.saved.set(true);
      },
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}
