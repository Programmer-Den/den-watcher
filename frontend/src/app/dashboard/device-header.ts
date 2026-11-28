import { Component, computed, inject, input } from '@angular/core';

import { worstLevel } from '../alerts/alerts';
import { Device, DeviceService, deviceName, switchedOff } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';
import { formatUptime } from '../metrics/format';
import { Snapshot } from '../metrics/metrics';
import { modelName } from '../metrics/system';

/** How the device is doing as one word or two, and the color it is told in. */
export interface DeviceStatus {
  level: 'fine' | 'warning' | 'alert' | 'off';
  text: string;
}

/** The kinds of device the header draws an icon for. */
export type DeviceIcon = 'server' | 'pc' | 'phone' | 'router' | 'checked';

/** The outline of each kind of device, drawn in a 24 × 24 box. */
const ICONS: Record<DeviceIcon, string> = {
  server: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 5v6h6V9z',
  pc: 'M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6v2h3v2H8v-2h3v-2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  phone:
    'M9 2h6a2.5 2.5 0 0 1 2.5 2.5v15A2.5 2.5 0 0 1 15 22H9a2.5 2.5 0 0 1-2.5-2.5v-15A2.5 2.5 0 0 1 9 2zm2 16v1.5h2V18z',
  router:
    'M5 13h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm1.6-2L4.7 5.3l1.9-.6L8.7 11zm10.8 0l2.1-6.3 1.9.6-1.9 5.7zM7 16v2h2v-2z',
  checked: 'M7 3h10v5h2a2 2 0 0 1 2 2v7h-4v4H7v-4H3v-7a2 2 0 0 1 2-2h2zm2 2v3h6V5zm0 10v4h6v-4z',
};

/** Which icon the header draws for a device. */
export function deviceIcon(device: Device): DeviceIcon {
  if (device.router) {
    return 'router';
  }
  if (device.checked) {
    return 'checked';
  }
  if (device.kind === 'phone') {
    return 'phone';
  }
  return device.kind === 'pc' ? 'pc' : 'server';
}

/**
 * How a device is doing: not in use or not answering while it does not answer, else by its worst
 * alert, with how many it has of that level, else fine.
 */
export function deviceStatus(device: Device, unanswered: boolean, i18n: I18n): DeviceStatus {
  if (unanswered) {
    // A phone reports only while it is on the home Wi-Fi, so it is away rather than off.
    if (device.kind === 'phone') {
      return { level: 'off', text: i18n.t('deviceHeader.away') };
    }
    return switchedOff(device.kind)
      ? { level: 'off', text: i18n.t('deviceHeader.notInUse') }
      : { level: 'alert', text: i18n.t('deviceHeader.notAnswering') };
  }
  const alerts = device.alerts ?? [];
  const level = worstLevel(alerts);
  if (level === 'alert') {
    const count = alerts.filter((a) => a.level === 'alert').length;
    return { level, text: i18n.plural(count, 'alerts.count.one', 'alerts.count.other') };
  }
  if (level === 'warning') {
    return {
      level,
      text: i18n.plural(alerts.length, 'deviceHeader.warnings.one', 'deviceHeader.warnings.other'),
    };
  }
  return { level: 'fine', text: i18n.t('deviceHeader.fine') };
}

/** The address of a device as people know it: its host, without the port Den-Watcher answers on. */
export function hostOf(address: string): string {
  // An IPv6 address is written in brackets before its port.
  if (address.startsWith('[')) {
    const end = address.indexOf(']');
    return end > 0 ? address.slice(1, end) : address;
  }
  const colon = address.lastIndexOf(':');
  return colon > 0 && address.indexOf(':') === colon ? address.slice(0, colon) : address;
}

/**
 * Which device the page is on, at one look: its icon and name, a line of what it is (model,
 * operating system, address and how long it has been up) and how it is doing, as a badge.
 */
@Component({
  selector: 'app-device-header',
  template: `
    <span class="icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path fill-rule="evenodd" [attr.d]="iconPath()" /></svg>
    </span>
    <div class="who">
      <h2>{{ name() }}</h2>
      @if (facts().length > 0) {
        <p class="facts">
          @for (fact of facts(); track $index) {
            <span>{{ fact }}</span>
          }
        </p>
      }
    </div>
    <span class="status" [class]="status().level" role="status">{{ status().text }}</span>
  `,
  styleUrl: './device-header.css',
})
export class DeviceHeader {
  /** The device's last reading; null while it loads or does not answer. */
  readonly snapshot = input<Snapshot | null>(null);
  /** Whether the device does not answer the hub. */
  readonly unanswered = input(false);

  private readonly devices = inject(DeviceService);
  private readonly i18n = inject(I18n);

  protected readonly name = computed(() => deviceName(this.devices.selected(), this.i18n));
  protected readonly iconPath = computed(() => ICONS[deviceIcon(this.devices.selected())]);
  protected readonly status = computed(() =>
    deviceStatus(this.devices.selected(), this.unanswered(), this.i18n),
  );

  /** What the device is, in the order people name it; each one only where it is known. */
  protected readonly facts = computed((): string[] => {
    const device = this.devices.selected();
    const s = this.snapshot();
    const facts: string[] = [];
    const add = (fact: string | undefined) => {
      if (fact) {
        facts.push(fact);
      }
    };
    const kind: MessageKey | undefined = device.router
      ? 'deviceHeader.router'
      : device.checked
        ? 'deviceHeader.checked'
        : undefined;
    if (kind) {
      add(this.i18n.t(kind));
    }
    if (s?.system) {
      add(modelName(s.system));
      add(s.system.os);
    }
    if (device.address) {
      add(hostOf(device.address));
    }
    if (s && s.uptimeSeconds > 0) {
      add(this.i18n.t('deviceHeader.up', { uptime: formatUptime(s.uptimeSeconds, this.i18n) }));
    }
    return facts;
  });
}
