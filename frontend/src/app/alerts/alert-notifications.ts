import { DOCUMENT } from '@angular/common';
import {
  Injectable,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';

import { readStored, store } from '../browser';
import { DeviceService } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { SERVICE_WORKERS } from '../install/install';
import { Alert } from './alert';
import { AlertService, alertDeviceName, alertText } from './alerts';

/** Which alerts the browser tells about with a notification: none, new ones, or also ended ones. */
export type NotifySetting = 'off' | 'started' | 'startedAndEnded';

/** Where the choice of notifications is kept between visits, in this browser's localStorage. */
export const NOTIFY_STORAGE_KEY = 'alertNotifications';

/** The browser's notifications as the page may use them; a token so tests can replace them. */
export interface BrowserNotifications {
  /** Whether the page is opened over https or on localhost, which notifications need. */
  secure: boolean;
  /** The browser's Notification, or null where the page may not use it. */
  api: typeof Notification | null;
}

export const BROWSER_NOTIFICATIONS = new InjectionToken<BrowserNotifications>(
  'browser notifications',
  {
    factory: () => {
      const window = inject(DOCUMENT).defaultView;
      const secure = !!window?.isSecureContext;
      const api = secure && window && 'Notification' in window ? window.Notification : null;
      return { secure, api };
    },
  },
);

/**
 * Tells about a new alert with a notification from the browser, and about one that ended when
 * asked to, while the page is open in a tab but not in front. It is switched on in each browser
 * on its own, and the browser asks for leave first. Browsers allow notifications only for a page
 * opened over https or on localhost, so a page opened at a local address over plain http has none.
 */
@Injectable({ providedIn: 'root' })
export class AlertNotifications {
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(BROWSER_NOTIFICATIONS).api;
  private readonly workers = inject(SERVICE_WORKERS);
  private readonly alerts = inject(AlertService);
  private readonly devices = inject(DeviceService);
  private readonly i18n = inject(I18n);

  /** Whether the page is opened over https or on localhost. */
  readonly secure = inject(BROWSER_NOTIFICATIONS).secure;
  /** Whether this browser can show the page's notifications. */
  readonly available = this.api !== null;

  readonly setting = signal<NotifySetting>(this.read());
  readonly permission = signal<NotificationPermission>(this.api?.permission ?? 'denied');

  /** Whether notifications are switched on and the browser allows them. */
  readonly on = computed(() => this.setting() !== 'off' && this.permission() === 'granted');

  /** The alerts that lasted at the last read, by id; null until the list of devices is read. */
  private known: Map<number, Alert> | null = null;

  constructor() {
    effect(() => {
      if (!this.devices.loaded()) {
        return;
      }
      const active = this.alerts.active();
      untracked(() => this.compare(active));
    });
  }

  /** Switches notifications on or off; switching them on asks the browser for leave first. */
  async set(setting: NotifySetting): Promise<void> {
    if (!this.api) {
      return;
    }
    let permission = this.api.permission;
    if (setting !== 'off' && permission === 'default') {
      permission = await this.api.requestPermission();
    }
    this.permission.set(permission);
    this.setting.set(permission === 'granted' ? setting : 'off');
    store(this.document.defaultView, NOTIFY_STORAGE_KEY, this.setting());
  }

  /** Reads again whether the browser allows notifications, as it may be changed in its settings. */
  refresh(): void {
    if (this.api) {
      this.permission.set(this.api.permission);
    }
  }

  /** Tells about the alerts that started, and those that ended, since the last read. */
  private compare(active: readonly Alert[]): void {
    const previous = this.known;
    this.known = new Map(active.map((a) => [a.id, a]));
    // The alerts that lasted when the page was opened are on the page already.
    if (previous === null || !this.on() || this.document.hasFocus()) {
      return;
    }
    for (const alert of active) {
      const before = previous.get(alert.id);
      // A warning that became an alert is told about again.
      if (!before || (before.level === 'warning' && alert.level === 'alert')) {
        this.show(alert, false);
      }
    }
    if (this.setting() === 'startedAndEnded') {
      const devices = this.devices.devices();
      for (const [id, alert] of previous) {
        // The alerts of a device removed from the page are gone with it, not ended.
        if (!this.known.has(id) && devices.some((d) => d.id === alert.device)) {
          this.show(alert, true);
        }
      }
    }
  }

  private show(alert: Alert, ended: boolean): void {
    const text = alertText(alert, this.i18n);
    const level = this.i18n.t(`alerts.level.${alert.level}`);
    const body = ended
      ? this.i18n.t('alerts.notify.endedBody', { text })
      : this.i18n.t('alerts.notify.startedBody', { level, text });
    const title = alertDeviceName(alert, this.devices, this.i18n);
    const options: NotificationOptions = {
      body,
      lang: this.i18n.language(),
      // One alert has one notification, also over several tabs: its end replaces its start.
      tag: `den-watcher-alert-${alert.id}`,
    };
    try {
      const notification = new this.api!(title, options);
      notification.onclick = () => {
        this.document.defaultView?.focus();
        notification.close();
      };
    } catch {
      // Some browsers, such as Chrome on Android, show notifications only from a service worker,
      // which runs where the page is opened over https; its sw.js brings the page to the front.
      // Right after the first visit it may still be starting, so this waits until it runs.
      this.workers?.ready
        .then((worker) => worker.showNotification(title, options))
        .catch(() => undefined);
    }
  }

  private read(): NotifySetting {
    const stored = readStored(this.document.defaultView, NOTIFY_STORAGE_KEY);
    return stored === 'started' || stored === 'startedAndEnded' ? stored : 'off';
  }
}
