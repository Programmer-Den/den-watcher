import { Component, computed, inject, input } from '@angular/core';

import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { Extra, formatExtra, localized } from '../metrics/extras';
import { Snapshot } from '../metrics/metrics';

/** One list of the line: what it is and its first few names. */
export interface AlsoEntry {
  id: string;
  label: string;
  text: string;
}

/** How many names each list shows before it says how many more there are. */
export const ALSO_NAMES = 4;

/** The lists the line shows, in order: the group of values each is read from and its label. */
const LISTS: readonly {
  group: string;
  label: MessageKey;
  names: (extra: Extra) => Extra['items'];
}[] = [
  // A router's devices online now, by name.
  { group: 'connected', label: 'glance.also.online', names: (e) => e.items },
  // The programs using the most CPU, with how much; only those that use some.
  {
    group: 'processes-cpu',
    label: 'glance.also.programs',
    names: (e) => e.items.filter((i) => (i.value ?? 0) >= 0.05),
  },
  {
    group: 'bluetooth',
    label: 'glance.also.bluetooth',
    names: (e) => e.items.filter((i) => i.id.startsWith('device-')),
  },
  {
    group: 'ports',
    label: 'glance.also.ports',
    names: (e) => e.items.filter((i) => i.unit === 'text'),
  },
];

/**
 * A line under the main values for what does not fit a tile: the devices online on a router, the
 * busiest programs, the Bluetooth devices connected and the open ports, each as its first few
 * names. A device that tells none of them shows no line.
 */
@Component({
  selector: 'app-glance-also',
  template: `
    @for (entry of entries(); track entry.id) {
      <p>
        <span class="label">{{ entry.label }}</span>{{ ' '
        }}<span class="text">{{ entry.text }}</span>
      </p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1.5rem;
      margin: -0.75rem 0 1.5rem;
      font: var(--mat-sys-body-medium);
    }

    :host([hidden]) {
      display: none;
    }

    p {
      margin: 0;
    }

    .label {
      color: var(--mat-sys-on-surface-variant);
    }

    .text {
      font-weight: 500;
    }
  `,
  host: { '[hidden]': 'entries().length === 0' },
})
export class GlanceAlso {
  readonly snapshot = input.required<Snapshot>();

  private readonly i18n = inject(I18n);

  protected readonly entries = computed((): AlsoEntry[] => {
    const extras = this.snapshot().extras ?? [];
    const language = this.i18n.language();
    return LISTS.flatMap((list) => {
      const extra = extras.find((e) => e.id === list.group);
      const items = extra ? list.names(extra) : [];
      if (items.length === 0) {
        return [];
      }
      const names = items.slice(0, ALSO_NAMES).map((item) => {
        const name = localized(item.label, item.labels, language);
        return list.group === 'processes-cpu' && item.value !== undefined
          ? `${name} ${formatExtra(item.value, item.unit, language)}`
          : name;
      });
      const more = items.length - names.length;
      if (more > 0) {
        names.push(this.i18n.t('glance.also.more', { count: more }));
      }
      return [{ id: list.group, label: this.i18n.t(list.label), text: names.join(', ') }];
    });
  });
}
