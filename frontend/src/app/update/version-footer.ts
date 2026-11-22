import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { I18n } from '../i18n/i18n';
import { UpdateStatus } from './update-notice';

/**
 * The version of Den-Watcher that serves the page, at its foot. It is asked once,
 * as it only changes with an update, which restarts the backend and reloads the page.
 */
@Component({
  selector: 'app-version-footer',
  template: `
    @if (version(); as version) {
      <footer>Den-Watcher · {{ i18n.t('dashboard.version', { version }) }}</footer>
    }
  `,
  styles: `
    footer {
      margin-top: 2rem;
      text-align: center;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class VersionFooter {
  protected readonly i18n = inject(I18n);
  // Older backends have no /api/update; then nothing is shown.
  protected readonly version = toSignal(
    inject(HttpClient)
      .get<UpdateStatus>('/api/update')
      .pipe(
        map((status) => status.current || null),
        catchError(() => of(null)),
      ),
    { initialValue: null },
  );
}
