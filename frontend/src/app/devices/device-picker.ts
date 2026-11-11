import { Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { I18n } from '../i18n/i18n';
import { DeviceGroups } from './device-groups';
import { DeviceItem } from './device-item';
import { DEVICE_GROUPS, DeviceService } from './devices';
import { FleetValues } from './fleet-values';
import { GroupFilter } from './group-filter';
import { ManageButton } from './manage-button';

/**
 * The list of devices to pick the one whose usage is shown, once the hub collects from other
 * devices, grouped into servers, PCs and phones, with the comparison of all of them first and the button to
 * add or remove devices last. Once devices are put in groups such as rooms, it can show one group
 * only. Compact, it shows the devices as rings.
 */
@Component({
  selector: 'app-device-picker',
  imports: [DeviceItem, GroupFilter, ManageButton],
  templateUrl: './device-picker.html',
  styleUrl: './device-picker.css',
  host: { '[class.compact]': 'compact()' },
})
export class DevicePicker {
  readonly compact = input(false);

  protected readonly devices = inject(DeviceService);
  protected readonly fleet = inject(FleetValues);
  private readonly shown = inject(DeviceGroups).visible;
  protected readonly i18n = inject(I18n);

  /**
   * The devices of the group shown by kind, servers first and phones last; the hub and things
   * without a kind count as servers.
   */
  protected readonly groups = computed(() =>
    DEVICE_GROUPS.map((kind) => ({
      kind,
      devices: this.shown().filter((d) => (d.kind ?? 'server') === kind),
    })).filter((group) => group.devices.length > 0),
  );

  constructor() {
    this.fleet.watch.pipe(takeUntilDestroyed()).subscribe();
  }
}
