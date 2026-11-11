import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

import { readStored, store } from '../browser';
import { PageLayout } from '../dashboard/page-layout';
import { Device, DeviceService } from './devices';

/** Where the group the list of devices shows is kept between visits, in the browser's localStorage. */
export const SHOWN_GROUP_STORAGE_KEY = 'deviceGroup';

/** The longest name of a group; the host checks it too. */
export const MAX_GROUP_LENGTH = 64;

/**
 * The groups the devices are put in, such as rooms, and the one the list of devices and the
 * comparison show. The groups are part of the page's layout, so every browser shows the same ones;
 * which one is shown is kept in each browser.
 */
@Injectable({ providedIn: 'root' })
export class DeviceGroups {
  private readonly devices = inject(DeviceService);
  private readonly layout = inject(PageLayout);
  private readonly view = inject(DOCUMENT).defaultView;

  /** The group of each device by its id; a device in none is not listed. */
  readonly groups = computed(() => this.layout.layout().groups);

  /** The groups the devices on the list are in, in alphabetical order. */
  readonly names = computed(() => {
    const groups = this.groups();
    const names = new Set(
      this.devices
        .devices()
        .map((d) => groups[d.id])
        .filter((g) => !!g),
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  });

  /** The group picked to show, or null for all devices. */
  private readonly picked = signal<string | null>(readStored(this.view, SHOWN_GROUP_STORAGE_KEY));

  /** The group shown, or null for all devices, as when the picked one has no devices anymore. */
  readonly shown = computed(() => {
    const picked = this.picked();
    return picked !== null && this.names().includes(picked) ? picked : null;
  });

  /** The devices of the group shown, all of them when none is. */
  readonly visible = computed(() => {
    const shown = this.shown();
    const devices = this.devices.devices();
    if (shown === null) {
      return devices;
    }
    const groups = this.groups();
    return devices.filter((d) => groups[d.id] === shown);
  });

  /** The group of a device, empty when it is in none. */
  groupOf(device: Device): string {
    return this.groups()[device.id] ?? '';
  }

  /** Shows only the devices of a group, or all of them for null, also on the next visit. */
  show(group: string | null): void {
    this.picked.set(group);
    store(this.view, SHOWN_GROUP_STORAGE_KEY, group ?? '');
  }

  /** Puts a device in a group, or in none when the group is empty. */
  setGroup(device: Device, group: string): void {
    const name = cleanGroup(group);
    if (name === this.groupOf(device)) {
      return;
    }
    this.layout.change((layout) => {
      const groups = { ...layout.groups };
      // Taken out and put back, so the device is the newest entry and the last to be trimmed.
      delete groups[device.id];
      if (name) {
        groups[device.id] = name;
      }
      return { ...layout, groups };
    });
  }
}

/**
 * A group's name as the host takes it: without spaces around it and runs of spaces inside, without
 * characters that do not print, and not longer than the host keeps.
 */
export function cleanGroup(group: string): string {
  // The host takes no other space than the plain one, and only letters, marks, numbers,
  // punctuation and symbols besides: no control, format, private-use or unassigned characters.
  const printable = group
    .replace(/\p{Cf}/gu, '')
    .replace(/[\s\p{Cc}\p{Z}]+/gu, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\p{P}\p{S} ]/gu, '');
  let name = printable.trim();
  // Cut at a character, not in the middle of one, to fit the host's limit in bytes.
  const encoder = new TextEncoder();
  while (encoder.encode(name).length > MAX_GROUP_LENGTH) {
    name = [...name].slice(0, -1).join('').trimEnd();
  }
  return name;
}
