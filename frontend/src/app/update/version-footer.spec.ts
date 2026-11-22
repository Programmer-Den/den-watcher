import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { I18n, LANGUAGE_STORAGE_KEY } from '../i18n/i18n';
import { VersionFooter } from './version-footer';

describe('VersionFooter', () => {
  let fixture: ComponentFixture<VersionFooter>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VersionFooter],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VersionFooter);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  function footer(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('footer');
  }

  it('shows the version that serves the page', () => {
    http.expectOne('/api/update').flush({ current: '4.0.1' });
    fixture.detectChanges();
    expect(footer()?.textContent?.trim()).toBe('Den-Watcher · Version 4.0.1');
  });

  it('names it in the chosen language', () => {
    TestBed.inject(I18n).use('es');
    http.expectOne('/api/update').flush({ current: '4.0.1' });
    fixture.detectChanges();
    expect(footer()?.textContent?.trim()).toBe('Den-Watcher · Versión 4.0.1');
  });

  it('shows nothing when the backend cannot tell', () => {
    http.expectOne('/api/update').flush('', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(footer()).toBeNull();
  });
});
