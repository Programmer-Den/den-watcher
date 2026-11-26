import { TestBed } from '@angular/core/testing';

import { I18n } from '../i18n/i18n';
import { phoneName } from './phone-name';

describe('phoneName', () => {
  it("names a phone by its own name, a removed phone's data without one, and an unknown id as it is", () => {
    const i18n = TestBed.inject(I18n);
    const devices = [{ id: 'pixel', name: 'Pixel', kind: 'phone' as const }];
    expect(phoneName('pixel', devices, i18n)).toBe('Pixel');
    expect(phoneName('removed:0123456789abcdef', devices, i18n)).toBe('A removed phone');
    expect(phoneName('galaxy', devices, i18n)).toBe('galaxy');
  });
});
