import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AlertNotifications } from './alerts/alert-notifications';
import { AlertTab } from './alerts/alert-tab';
import { AlertsButton } from './alerts/alerts-button';
import { Compare } from './compare/compare';
import { ConnectionBanner } from './connection/connection-banner';
import { Dashboard } from './dashboard/dashboard';
import { DevicePicker } from './devices/device-picker';
import { DeviceService, deviceName } from './devices/devices';
import { ManageButton } from './devices/manage-button';
import { Home } from './home/home';
import { I18n } from './i18n/i18n';
import { InstallService } from './install/install';
import { InstallButton } from './install/install-button';
import { KioskAlerts } from './kiosk/kiosk-alerts';
import { KioskMode } from './kiosk/kiosk';
import { LanguageSwitcher } from './language/language-switcher';
import { Sidebar, SidebarState } from './layout/sidebar';
import { Mascot } from './mascot/mascot';
import { ThemeToggle } from './theme/theme-toggle';
import { MissingPart, MissingParts } from './update/missing-part';
import { UpdateNotice } from './update/update-notice';

@Component({
  selector: 'app-root',
  imports: [
    AlertsButton,
    Compare,
    ConnectionBanner,
    Dashboard,
    DevicePicker,
    Home,
    InstallButton,
    KioskAlerts,
    LanguageSwitcher,
    ManageButton,
    Mascot,
    MissingPart,
    Sidebar,
    ThemeToggle,
    UpdateNotice,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly devices = inject(DeviceService);
  protected readonly sidebar = inject(SidebarState);
  protected readonly i18n = inject(I18n);
  protected readonly kiosk = inject(KioskMode);
  protected readonly parts = inject(MissingParts);

  /** The name of the device shown, which a wall display shows in the header instead of a list. */
  protected readonly selectedName = computed(() => deviceName(this.devices.selected(), this.i18n));

  constructor() {
    this.devices.polling.pipe(takeUntilDestroyed()).subscribe();
    // They tell about alerts in the tab's title and favicon and in the browser's notifications.
    inject(AlertTab);
    inject(AlertNotifications);
    // It starts the service worker, also on a wall display, which then opens while the hub is down.
    inject(InstallService);
    this.kiosk.cycle.pipe(takeUntilDestroyed()).subscribe();
  }
}
