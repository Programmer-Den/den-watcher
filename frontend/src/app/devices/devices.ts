import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, from, map, switchMap, tap, throwError } from 'rxjs';

import { Alert } from '../alerts/alert';
import { I18n } from '../i18n/i18n';
import { PageVisibility } from '../page-visibility';

/**
 * What another device is used as. The times a server does not answer are
 * outages; a PC or laptop that does not answer is switched off or asleep, so
 * it is just not in use, and so is a phone that is away or asleep. A phone
 * stays one, so the page offers it only when adding a device.
 */
export type DeviceKind = 'server' | 'pc' | 'phone';

/** The kinds in the order the page offers them for a device it has. */
export const DEVICE_KINDS: readonly DeviceKind[] = ['server', 'pc'];

/** The kinds in the order the page offers them for a device to add. */
export const ADD_KINDS: readonly DeviceKind[] = ['server', 'pc', 'phone'];

/** The kinds in the order the list of devices groups them. */
export const DEVICE_GROUPS: readonly DeviceKind[] = ['server', 'pc', 'phone'];

/** Whether the times a device of the kind does not answer are times it was not in use. */
export function switchedOff(kind: DeviceKind | undefined): boolean {
  return kind === 'pc' || kind === 'phone';
}

/** A machine whose usage the website shows, as served by GET /api/devices. */
export interface Device {
  /** Picks the device in the API, as ?device=<id>. */
  id: string;
  /** Empty for the machine the backend runs on when its DEVICE_NAME is not set. */
  name: string;
  /**
   * Where another device is reachable, as host:port; missing for the machine the backend runs on
   * and for a phone, which comes to the hub.
   */
  address?: string;
  /** What another device is used as; missing for the machine the backend runs on. */
  kind?: DeviceKind;
  /** Set for a device added on the page, which can be removed there too. */
  removable?: boolean;
  /** Set for another device that has not answered the backend recently. */
  unreachable?: boolean;
  /** When it stopped answering, as an ISO time, when that is known. */
  unreachableSince?: string;
  /**
   * Set for an unreachable device added on the page that the backend does not connect to, as its
   * address is the hub's own; it can be collected from when listed in HUB_DEVICES instead.
   */
  refused?: boolean;
  /**
   * Set for a device that answers but keeps its usage from the hub until it is given the device's
   * pairing code: `needed` while the hub has none for it, `wrong` while the one it has is another.
   * The hub keeps only its availability meanwhile.
   */
  pairing?: 'needed' | 'wrong';
  /**
   * Set for a router, which the hub reads itself over the local network, as it runs no
   * den-watcher; it is set in HUB_ROUTERS.
   */
  router?: boolean;
  /**
   * Set for a thing the hub only checks for whether it answers, such as a printer, as it runs no
   * den-watcher; it is set in HUB_CHECKS.
   */
  checked?: boolean;
  /** The values of the device that need attention now, most serious first. */
  alerts?: Alert[];
}

/** Whether the hub reads the device itself, as it runs no den-watcher: a router or a check. */
export function readByHub(device: Device): boolean {
  return !!device.router || !!device.checked;
}

/** The body of GET /api/availability: how long another device did not answer since it was added. */
export interface Availability {
  /** Whether the times it did not answer are outages of a server or times a PC was not in use. */
  kind: DeviceKind;
  /**
   * When the device was added, or the start of its first outage when that is earlier, as for a
   * device added again with its history kept: the time the outages are counted since, as an ISO
   * time.
   */
  since: string;
  /** When the device was added, moved on by the time it was removed: the share counts from it. */
  countedSince: string;
  /** All outages added up; time the backend itself was not running is not counted. */
  offlineSeconds: number;
  outages: number;
  /** The newest outage; its end is the newest failed reading while it lasts. */
  lastOutage?: { start: string; end: string };
}

/** The body of GET /api/devices. */
export interface DeviceList {
  devices: Device[];
  /** Whether adding or removing a device asks for the password, or chooses it. */
  passwordSet: boolean;
}

/**
 * The body of GET /api/devices/suggestion: the device the page is open on,
 * which the hub offers to add when it does not collect from it yet.
 */
export interface Suggestion {
  /** Where its den-watcher would be reachable, as host:port. */
  address: string;
  /** What the device calls itself, or its name in the local DNS; empty when neither is known. */
  name: string;
  /** What the device seems to be: a PC when it has a battery or runs Windows. */
  kind: DeviceKind;
}

/**
 * The body of GET /api/status-page: the remote status page, a minimal page on a port of its own
 * for outside the local network, set up with STATUS_ADDR.
 */
export interface StatusPage {
  /** False when the hub has no status page; the rest is missing then. */
  enabled: boolean;
  /** The port it is reachable on. */
  port?: string;
  /** The SHA-256 of its self-signed certificate, as pairs of hex digits split by colons. */
  fingerprint?: string;
  /** Whether its password is set; until it is, the page shows no devices. */
  passwordSet: boolean;
}

/** The machine the backend runs on. The API answers for it when a request names no device. */
export const LOCAL_DEVICE: Device = { id: 'local', name: '' };

/** How the page names a device, in the page's language. */
export function deviceName(device: Device, i18n: I18n): string {
  return device.name || i18n.t('devices.hostHub');
}

/** How the page names the hub, the machine the backend runs on, from the list of devices. */
export function hubName(devices: Device[], i18n: I18n): string {
  return deviceName(devices.find((d) => d.id === LOCAL_DEVICE.id) ?? LOCAL_DEVICE, i18n);
}

/** How the page names a kind of device, in the page's language. */
export function kindName(kind: DeviceKind, i18n: I18n): string {
  return i18n.t(`devices.kind.${kind}`);
}

/** Whether a device that does not answer is just not in use rather than having an outage. */
export function notInUse(device: Device): boolean {
  return switchedOff(device.kind) && !!device.unreachable;
}

/**
 * Whether a device answers, for the dot before its name. While the hub does not answer, nothing is
 * known about the devices it collects from.
 */
export type DeviceState = 'reachable' | 'unreachable' | 'notInUse' | 'unknown';

/** The state of a device; `hubLost` tells that the hub, which reads all of them, does not answer. */
export function deviceState(device: Device, hubLost = false): DeviceState {
  if (hubLost) {
    return device.id === LOCAL_DEVICE.id ? 'unreachable' : 'unknown';
  }
  // Waiting for its pairing code, the device answers all the same.
  if (!device.unreachable || device.pairing) {
    return 'reachable';
  }
  return notInUse(device) ? 'notInUse' : 'unreachable';
}

/** How often the list is read again, so the page shows which devices answer. */
export const DEVICES_REFRESH_MS = 5000;

/**
 * How often the list is read while the tab is hidden: it carries the alerts that last, so the
 * tab's title and the browser's notifications can tell about new ones.
 */
export const DEVICES_HIDDEN_REFRESH_MS = 30_000;

/** The shortest password that can be chosen; the backend checks it too. */
export const MIN_PASSWORD_LENGTH = 8;

/** The longest password that can be chosen; the backend checks it too. */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * The devices the backend shows and the one picked on the page. The backend
 * collects from other devices on the local network too when they are added on
 * the page or set in its HUB_DEVICES setting.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly http = inject(HttpClient);

  /** Only this device until the list has been read. */
  readonly devices = signal<Device[]>([LOCAL_DEVICE]);
  readonly passwordSet = signal(false);
  /** Whether the list has been read from the backend at least once. */
  readonly loaded = signal(false);
  readonly selectedId = signal(LOCAL_DEVICE.id);
  /** Whether the page compares all devices instead of showing the picked one. */
  readonly comparing = signal(false);
  /** Whether the page shows the home page of all devices instead of the picked one. */
  readonly home = signal(false);
  readonly selected = computed(
    () => this.devices().find((d) => d.id === this.selectedId()) ?? LOCAL_DEVICE,
  );

  /** Shows the device on its own, also when the devices were being compared. */
  show(id: string): void {
    this.selectedId.set(id);
    this.comparing.set(false);
    this.home.set(false);
  }

  /** Compares all devices, also when the home page was shown. */
  compare(): void {
    this.comparing.set(true);
    this.home.set(false);
  }

  /** Shows the home page of all devices. */
  goHome(): void {
    this.home.set(true);
    this.comparing.set(false);
  }

  /**
   * Reads the list again and again while it is subscribed to, slowly while the page is hidden;
   * without the list only this device is shown. A failed read is skipped.
   */
  readonly polling = inject(PageVisibility).poll(
    DEVICES_REFRESH_MS,
    () => this.load().pipe(catchError(() => EMPTY)),
    DEVICES_HIDDEN_REFRESH_MS,
  );

  /** Reads the list of devices from the backend. */
  load(): Observable<DeviceList> {
    return this.http.get<DeviceList>('/api/devices').pipe(
      tap((list) => {
        this.devices.set(list.devices);
        this.passwordSet.set(list.passwordSet);
        this.loaded.set(true);
        if (!list.devices.some((d) => d.id === this.selectedId())) {
          this.selectedId.set(LOCAL_DEVICE.id);
        }
      }),
    );
  }

  /**
   * Adds a device, with the pairing code it shows, empty for one that asks for none; without a
   * password yet, `password` becomes the password.
   */
  add(
    name: string,
    address: string,
    kind: DeviceKind,
    code: string,
    password: string,
  ): Observable<Device> {
    return this.http.post<Device>('/api/devices', { name, address, kind, code, password });
  }

  /**
   * Adds a phone, with the pairing code its app shows; it has no address, as it sends its usage
   * to the hub itself. Without a password yet, `password` becomes the password.
   */
  addPhone(name: string, code: string, password: string): Observable<Device> {
    return this.http.post<Device>('/api/phones', { name, code, password });
  }

  /** Changes the pairing code the hub sends a device, one from the hub's .env file too. */
  setCode(id: string, code: string, password: string): Observable<void> {
    return this.http.put<void>(`/api/devices/${encodeURIComponent(id)}/pairing`, {
      code,
      password,
    });
  }

  /**
   * Reads this device's own pairing code, which a hub asks for when this device is added there.
   * Emits an empty code when the backend keeps none.
   */
  pairingCode(): Observable<string> {
    return this.http.get<{ code: string }>('/api/pairing').pipe(map((answer) => answer.code));
  }

  /** Changes what a device is used as, one from the hub's .env file too. */
  setKind(id: string, kind: DeviceKind, password: string): Observable<void> {
    return this.http.put<void>(`/api/devices/${encodeURIComponent(id)}/kind`, { kind, password });
  }

  /**
   * Asks the hub which device the page is open on, to offer adding it. Emits
   * null when there is none to offer, as when it is added already.
   */
  suggestion(): Observable<Suggestion | null> {
    return this.http.get<Suggestion | null>('/api/devices/suggestion');
  }

  /** Reads how long another device did not answer since it was added. */
  availability(id: string): Observable<Availability> {
    return this.http.get<Availability>('/api/availability', { params: { device: id } });
  }

  /**
   * Asks for a copy of the hub's database, guarded by the password like a change; without a
   * password yet, `password` becomes the password. Emits the file and the name the hub gave it.
   */
  backup(password: string): Observable<Backup> {
    return this.http
      .post('/api/backup', { password }, { observe: 'response', responseType: 'blob' })
      .pipe(
        map((response) => ({
          file: response.body ?? new Blob(),
          name: backupName(response.headers.get('Content-Disposition')),
        })),
        // A refusal comes as a blob too; problemMessage reads the problem from its JSON.
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.error instanceof Blob
            ? from(error.error.text()).pipe(
                switchMap((text) => throwError(() => withJSONBody(error, text))),
              )
            : throwError(() => error),
        ),
      );
  }

  /** Reads whether the hub has a remote status page, and where. */
  statusPage(): Observable<StatusPage> {
    return this.http.get<StatusPage>('/api/status-page');
  }

  /**
   * Sets or changes the password of the remote status page, guarded by the password for changing
   * devices; without that one yet, `password` becomes it.
   */
  setStatusPassword(newPassword: string, password: string): Observable<void> {
    return this.http.post<void>('/api/status-page/password', { password, newPassword });
  }

  /** Removes a device added on the page, and its history unless `keepHistory` is set. */
  remove(id: string, password: string, keepHistory: boolean): Observable<void> {
    return this.http.delete<void>(`/api/devices/${encodeURIComponent(id)}`, {
      body: { password, keepHistory },
    });
  }
}

/** A copy of the hub's database, as POST /api/backup sends it. */
export interface Backup {
  file: Blob;
  /** The name to save it under, such as den-watcher-2026-10-13.db. */
  name: string;
}

/** The file name in a Content-Disposition header, or a name of its own when there is none. */
export function backupName(disposition: string | null): string {
  return /filename="([^"/\\]+)"/.exec(disposition ?? '')?.[1] ?? 'den-watcher.db';
}

/** The error with its body read as JSON, or as the text it is when it is no JSON. */
function withJSONBody(error: HttpErrorResponse, text: string): HttpErrorResponse {
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not every answer is JSON, such as a 500 in plain text.
  }
  return new HttpErrorResponse({
    error: body,
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined,
  });
}

/** The problems the backend names that have a message of their own, besides passwordLength. */
const KNOWN_PROBLEMS = [
  'wrongPassword',
  'name',
  'nameTaken',
  'addressTaken',
  'address',
  'addressOwn',
  'kind',
  'unreachable',
  'hostUnknown',
  'fixed',
  'notFound',
  'removing',
  'pairingNeeded',
  'pairingWrong',
  'pairingNone',
  'pairingTaken',
  // Only the demo on GitHub Pages refuses every change with this, and a backup with demoBackup.
  'demo',
  'demoBackup',
] as const;

/** Explains why adding or removing a device was refused, from the problem the backend names. */
export function problemMessage(error: unknown, i18n: I18n): string {
  const problem =
    error instanceof HttpErrorResponse
      ? (error.error as { problem?: string } | null)?.problem
      : undefined;
  if (problem === 'passwordLength') {
    return i18n.t('devices.problem.passwordLength', {
      count: MIN_PASSWORD_LENGTH,
      max: MAX_PASSWORD_LENGTH,
    });
  }
  const known = KNOWN_PROBLEMS.find((p) => p === problem);
  return i18n.t(known ? `devices.problem.${known}` : 'devices.problem.other');
}
