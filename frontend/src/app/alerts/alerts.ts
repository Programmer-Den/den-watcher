import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DeviceService, LOCAL_DEVICE, deviceName, hubName } from '../devices/devices';
import { Alert, AlertKind, AlertLevel } from './alert';
import { I18n } from '../i18n/i18n';
import { MessageKey } from '../i18n/messages/en';

const KNOWN_KINDS: readonly AlertKind[] = [
  'offline',
  'disk',
  'memory',
  'cpu',
  'temperature',
  'throttling',
  'smart',
  'wifi-lookalike',
];

/** The conditions of a Raspberry Pi's power supply and cooling that have a name on the page. */
const THROTTLING_CONDITIONS = [
  'undervoltage',
  'frequencyCapped',
  'throttled',
  'softTemperatureLimit',
];

/** The active alerts of every device, and the log of the ones before. */
@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly http = inject(HttpClient);
  private readonly devices = inject(DeviceService);

  /** The alerts that last now, of every device, from the list of devices. */
  readonly active = computed(() => this.devices.devices().flatMap((d) => d.alerts ?? []));

  /** Reads the newest alerts of every device, the ones that last and the ones that ended. */
  log(): Observable<Alert[]> {
    return this.http.get<Alert[]>('/api/alerts');
  }
}

/** Whether any of alerts is an alert rather than a warning. */
export function worstLevel(alerts: readonly Alert[]): AlertLevel | null {
  if (alerts.length === 0) {
    return null;
  }
  return alerts.some((a) => a.level === 'alert') ? 'alert' : 'warning';
}

/** What an alert is about, in the page's language, such as "Disk / is 96 % full". */
export function alertText(alert: Alert, i18n: I18n): string {
  if (!KNOWN_KINDS.includes(alert.kind)) {
    return i18n.t('alerts.kind.other');
  }
  const value =
    alert.value === undefined
      ? ''
      : alert.kind === 'temperature'
        ? `${Math.round(alert.value)} °C`
        : `${Math.round(alert.value)} %`;
  let subject = alert.subject ?? '';
  if (alert.kind === 'throttling') {
    subject = subject
      .split(',')
      .map((c) => throttlingText(c, i18n))
      .join(', ');
  }
  return i18n.t(`alerts.kind.${alert.kind}` as MessageKey, { subject, value });
}

/**
 * A condition of a Raspberry Pi's power supply and cooling by its name on the page; one the page
 * does not know, which a newer backend may send, by its own name.
 */
export function throttlingText(condition: string, i18n: I18n): string {
  return THROTTLING_CONDITIONS.includes(condition)
    ? i18n.t(`dashboard.throttling.${condition}` as MessageKey)
    : condition;
}

/** The name of the device of an alert, as the page names it now where it still exists. */
export function alertDeviceName(alert: Alert, devices: DeviceService, i18n: I18n): string {
  const device = devices.devices().find((d) => d.id === alert.device);
  if (device) {
    return deviceName(device, i18n);
  }
  if (alert.device === LOCAL_DEVICE.id) {
    return hubName(devices.devices(), i18n);
  }
  return alert.deviceName;
}
