import { Component, inject } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { DeviceGroups } from './device-groups';

/**
 * Buttons to show the devices of one group, such as a room, or all of them, once a device is put in
 * a group; nothing otherwise.
 */
@Component({
  selector: 'app-group-filter',
  template: `
    @if (groups.names().length) {
      <div class="choices" role="group" [attr.aria-label]="i18n.t('groups.label')">
        <button
          type="button"
          [attr.aria-pressed]="groups.shown() === null"
          (click)="groups.show(null)"
        >
          {{ i18n.t('groups.all') }}
        </button>
        @for (group of groups.names(); track group) {
          <button
            type="button"
            [attr.aria-pressed]="groups.shown() === group"
            (click)="groups.show(group)"
          >
            {{ group }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host:empty {
      display: none;
    }

    .choices > button {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class GroupFilter {
  protected readonly groups = inject(DeviceGroups);
  protected readonly i18n = inject(I18n);
}
