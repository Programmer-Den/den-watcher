import { formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { DeviceService } from './devices';

/** What was done with the password, as GET /api/changes names it. */
export type ChangeAction =
  | 'add'
  | 'addPhone'
  | 'remove'
  | 'rename'
  | 'kind'
  | 'pairing'
  | 'release'
  | 'backup'
  | 'statusPassword'
  | 'deleteRoute'
  | 'password'
  | 'wrongPassword';

/** One change made with the password, or a try with a wrong one. */
export interface Change {
  /** Unix seconds. */
  time: number;
  /** The address of the browser it came from. */
  address: string;
  action: ChangeAction;
  /** The id of the device it was made to. */
  device?: string;
  /**
   * The new name or kind, the name of an added device, keepHistory on removing, or the stretch of a
   * route deleted, as from-to in Unix seconds.
   */
  detail?: string;
}

/**
 * The changes made to the hub with the password, newest first, with when and from which address,
 * and the tries with a wrong password; read when it is opened, as most visits do not need it.
 */
@Component({
  selector: 'app-change-log',
  template: `
    <details (toggle)="toggled($event)">
      <summary>
        <h3>{{ i18n.t('changeLog.title') }}</h3>
      </summary>
      <p class="hint">{{ i18n.t('changeLog.hint') }}</p>
      @if (failed()) {
        <p class="hint" role="alert">{{ i18n.t('changeLog.failed') }}</p>
      } @else if (changes(); as changes) {
        @if (changes.length === 0) {
          <p class="hint">{{ i18n.t('changeLog.empty') }}</p>
        } @else {
          <ul>
            @for (change of changes; track $index) {
              <li [class.wrong]="change.action === 'wrongPassword'">
                <span class="what">{{ text(change) }}</span>
                <span class="hint">{{
                  i18n.t('changeLog.when', { time: when(change), address: change.address })
                }}</span>
              </li>
            }
          </ul>
        }
      } @else {
        <p class="hint">{{ i18n.t('dashboard.loading') }}</p>
      }
    </details>
  `,
  styles: `
    summary {
      cursor: pointer;
    }
    summary h3 {
      display: inline;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      flex-direction: column;
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    li .hint {
      font: var(--mat-sys-body-small);
    }
    li.wrong .what {
      color: var(--mat-sys-error);
    }
    .hint {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ChangeLog {
  protected readonly i18n = inject(I18n);
  private readonly http = inject(HttpClient);
  private readonly devices = inject(DeviceService);

  /** Null until read. */
  protected readonly changes = signal<Change[] | null>(null);
  protected readonly failed = signal(false);

  /** Reads the changes each time the list is opened, so it shows the ones made meanwhile. */
  protected toggled(event: Event): void {
    if (!(event.target as HTMLDetailsElement).open) {
      return;
    }
    this.failed.set(false);
    this.http.get<{ changes: Change[] }>('/api/changes').subscribe({
      next: (answer) => this.changes.set(answer.changes),
      error: () => this.failed.set(true),
    });
  }

  /** What was done, with the device's name as the page shows it now, or its id once it is gone. */
  protected text(change: Change): string {
    const name =
      this.devices.devices().find((d) => d.id === change.device)?.name ?? change.device ?? '';
    const detail = change.detail ?? '';
    switch (change.action) {
      case 'add':
      case 'addPhone':
        return this.i18n.t(`changeLog.${change.action}`, { name: detail });
      case 'remove':
        return this.i18n.t(detail === 'keepHistory' ? 'changeLog.removeKept' : 'changeLog.remove', {
          name,
        });
      case 'rename':
        return this.i18n.t('changeLog.rename', { name: detail });
      case 'kind':
        return this.i18n.t('changeLog.kind', {
          name,
          kind: this.i18n.t(detail === 'pc' ? 'devices.kind.pc' : 'devices.kind.server'),
        });
      case 'pairing':
      case 'release':
        return this.i18n.t(`changeLog.${change.action}`, { name });
      case 'deleteRoute': {
        const from = Number(detail.split('-')[0]);
        return this.i18n.t('changeLog.deleteRoute', {
          name,
          day: formatDate(from * 1000, 'mediumDate', this.i18n.language()),
        });
      }
      case 'wrongPassword':
        return this.i18n.t(name ? 'changeLog.wrongPasswordFor' : 'changeLog.wrongPassword', {
          name,
        });
      default:
        return this.i18n.t(`changeLog.${change.action}`);
    }
  }

  protected when(change: Change): string {
    return formatDate(change.time * 1000, 'short', this.i18n.language());
  }
}
