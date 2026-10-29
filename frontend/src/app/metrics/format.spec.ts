import { TestBed } from '@angular/core/testing';

import { BROWSER_LANGUAGES, I18n, LANGUAGE_STORAGE_KEY } from '../i18n/i18n';
import { cpuDetail, formatDuration, formatUptime, loadAverageText, usedOfTotal } from './format';

describe('format', () => {
  let i18n: I18n;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: BROWSER_LANGUAGES, useValue: ['en-GB'] }],
    });
    i18n = TestBed.inject(I18n);
  });

  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));

  it('tells how much of a total is used', () => {
    expect(usedOfTotal(2 * 1024 ** 3, 8 * 1024 ** 3, i18n)).toBe('2.0 GiB of 8.0 GiB');
  });

  it('tells the cores of a CPU and its clock where it is known', () => {
    expect(cpuDetail({ cores: 4, clockMHz: 1700 } as never, i18n)).toBe('4 cores · 1.7 GHz');
    expect(cpuDetail({ cores: 1 } as never, i18n)).toBe('1 core');
  });

  it('tells the load average', () => {
    expect(loadAverageText({ one: 0.34, five: 0.3, fifteen: 1 }, i18n)).toBe(
      'Load 0.34 · 0.30 · 1.00',
    );
  });

  it('tells an uptime in days and hours, or hours and minutes below a day', () => {
    expect(formatUptime(2 * 86400 + 3 * 3600 + 59, i18n)).toBe('2 d 3 h');
    expect(formatUptime(3 * 3600 + 5 * 60, i18n)).toBe('3 h 5 min');
  });

  it('tells a length of time in seconds, minutes or as an uptime', () => {
    expect(formatDuration(42.4, i18n)).toBe('42 s');
    expect(formatDuration(59.6, i18n)).toBe('1 min');
    expect(formatDuration(150, i18n)).toBe('2 min');
    expect(formatDuration(3 * 3600, i18n)).toBe('3 h 0 min');
  });
});
