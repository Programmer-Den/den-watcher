import { TestBed } from '@angular/core/testing';

import { I18n, LANGUAGE_STORAGE_KEY } from '../i18n/i18n';
import { RELEASES_URL, UpdatesLink } from './updates-link';

describe('UpdatesLink', () => {
  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));

  it('opens the newest release on GitHub in a new tab', () => {
    const fixture = TestBed.createComponent(UpdatesLink);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(link.href).toBe('https://github.com/Programmer-Den/den-watcher/releases/latest');
    expect(link.href).toBe(RELEASES_URL);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toBe('Updates on GitHub');
    expect(link.title).toBe('Updates on GitHub');
  });

  it('names the link in the chosen language', () => {
    const fixture = TestBed.createComponent(UpdatesLink);
    TestBed.inject(I18n).use('de');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('a')!.title).toBe(
      'Updates auf GitHub',
    );
  });
});
