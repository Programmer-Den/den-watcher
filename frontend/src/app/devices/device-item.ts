import { DecimalPipe, formatDate } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';

import { AlertIcon } from '../alerts/alert-icon';
import { worstLevel } from '../alerts/alerts';
import { HubConnection } from '../connection/connection';
import { I18n } from '../i18n/i18n';
import { Summary } from '../metrics/summary';
import {
  Device,
  DeviceService,
  LOCAL_DEVICE,
  deviceName,
  deviceState,
  hubName,
  notInUse,
} from './devices';
import { StatusDot } from './status-dot';

/**
 * One device in the list of devices, as a button that shows it. Open, it names the device and
 * tells its CPU and hottest sensor, or why it does not answer. Compact, it shows the first letters
 * of its name in a ring filled to its CPU usage, and the rest in its tooltip.
 */
@Component({
  selector: 'app-device-item',
  imports: [AlertIcon, DecimalPipe, StatusDot],
  templateUrl: './device-item.html',
  styleUrl: './device-item.css',
  host: { '[class.compact]': 'compact()' },
})
export class DeviceItem {
  readonly device = input.required<Device>();
  /** Its values now; missing while they are on their way or the device does not answer. */
  readonly summary = input<Summary | null>();
  readonly selected = input(false);
  readonly compact = input(false);
  readonly picked = output();

  protected readonly i18n = inject(I18n);
  private readonly devices = inject(DeviceService);
  private readonly connection = inject(HubConnection);

  protected readonly name = computed(() => deviceName(this.device(), this.i18n));
  protected readonly state = computed(() => deviceState(this.device(), this.connection.lost()));
  protected readonly alertLevel = computed(() => worstLevel(this.device().alerts ?? []));
  protected readonly initials = computed(() => initials(this.name()));

  /** Whether the device answers, and since when it does not or is not in use. */
  protected readonly status = computed(() => {
    const device = this.device();
    const lostSince = this.connection.lostSince();
    if (lostSince) {
      if (device.id !== LOCAL_DEVICE.id) {
        return this.i18n.t('devices.unknown', { hub: hubName(this.devices.devices(), this.i18n) });
      }
      const since = formatDate(lostSince, 'short', this.i18n.language());
      return this.i18n.t('devices.unreachableSince', { since });
    }
    // Waiting for its pairing code, the device answers all the same.
    if (device.pairing) {
      return this.i18n.t('home.pairing');
    }
    if (!device.unreachable) {
      return this.i18n.t('devices.reachable');
    }
    const idle = notInUse(device);
    if (!device.unreachableSince) {
      return this.i18n.t(idle ? 'devices.notInUse' : 'devices.unreachable');
    }
    const since = formatDate(device.unreachableSince, 'short', this.i18n.language());
    return this.i18n.t(idle ? 'devices.notInUseSince' : 'devices.unreachableSince', { since });
  });

  /** For screen readers, after the name of a device that does not answer. */
  protected readonly shortStatus = computed(() => {
    const state = this.state();
    return state === 'unknown' ? this.status() : this.i18n.t(`devices.${state}`);
  });
}

/** Up to three first letters of the words of a name, or its first two letters when it is one word. */
export function initials(name: string): string {
  const words = name.split(/[\s_-]+/).filter((w) => w.length > 0);
  const letters =
    words.length > 1 ? words.map((w) => [...w][0]).slice(0, 3) : [...(words[0] ?? '')].slice(0, 2);
  return letters.join('').toUpperCase();
}
