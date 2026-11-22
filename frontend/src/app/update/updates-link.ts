import { Component, inject } from '@angular/core';

import { I18n } from '../i18n/i18n';

/** Where every release is downloaded: the Docker image's tag, the Windows installer, the Linux archives and the phone app. */
export const RELEASES_URL = 'https://github.com/Programmer-Den/den-watcher/releases/latest';

/** Opens the newest release on GitHub, the one place to update every device from. */
@Component({
  selector: 'app-updates-link',
  template: `
    <a
      class="icon-button"
      [href]="url"
      target="_blank"
      rel="noopener noreferrer"
      [attr.aria-label]="i18n.t('update.github')"
      [title]="i18n.t('update.github')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
        />
      </svg>
    </a>
  `,
  styles: `
    a {
      padding: 0.375rem;
    }

    svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: currentColor;
    }
  `,
})
export class UpdatesLink {
  protected readonly i18n = inject(I18n);
  protected readonly url = RELEASES_URL;
}
