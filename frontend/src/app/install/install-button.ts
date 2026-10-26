import { Component, inject } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { InstallService } from './install';

/** Installs the page as an app, shown while the browser offers that. */
@Component({
  selector: 'app-install-button',
  template: `
    @if (install.available()) {
      <button
        type="button"
        class="icon-button"
        [attr.aria-label]="i18n.t('app.install')"
        [title]="i18n.t('app.install')"
        (click)="install.install()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20h14v-2H5zM11 3v9.2L7.4 8.6 6 10l6 6 6-6-1.4-1.4-3.6 3.6V3z" />
        </svg>
      </button>
    }
  `,
  styles: `
    button {
      padding: 0.375rem;
    }

    svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: currentColor;
    }
  `,
})
export class InstallButton {
  protected readonly install = inject(InstallService);
  protected readonly i18n = inject(I18n);
}
