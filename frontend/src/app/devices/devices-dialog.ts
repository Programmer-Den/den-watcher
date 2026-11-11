import { Component, DOCUMENT, DestroyRef, Injector, computed, inject, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  filter,
  finalize,
  ignoreElements,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { saveFile } from '../browser';
import { EnergyPriceForm } from '../energy/energy-price-form';
import { I18n } from '../i18n/i18n';
import {
  ADD_KINDS,
  DEVICE_KINDS,
  Device,
  DeviceKind,
  DeviceService,
  LOCAL_DEVICE,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  StatusPage,
  Suggestion,
  deviceName,
  kindName,
  problemMessage,
} from './devices';
import { DeviceGroups, MAX_GROUP_LENGTH } from './device-groups';
import { PasswordDialog, PasswordDialogData, PasswordDialogResult } from './password-dialog';
import { qrPath } from './qr-code';

/** The port den-watcher listens on unless it was set up otherwise, as the app assumes. */
const DEFAULT_PORT = 9393;

/**
 * Lists the other devices the hub collects from, adds or removes them and
 * changes what they are used as. Every change asks for the password in a
 * dialog of its own.
 */
@Component({
  selector: 'app-devices-dialog',
  imports: [
    EnergyPriceForm,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './devices-dialog.html',
  styleUrl: './devices-dialog.css',
})
export class DevicesDialog {
  protected readonly i18n = inject(I18n);
  private readonly devices = inject(DeviceService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  /** Every device but the one the website runs on. */
  protected readonly others = computed(() =>
    this.devices.devices().filter((d) => d.id !== LOCAL_DEVICE.id),
  );

  /** Whether the list of devices is shown; it can be folded away by hand. */
  protected readonly listOpen = signal(true);

  protected readonly name = signal('');
  protected readonly address = signal('');
  protected readonly kind = signal<DeviceKind>('server');
  /** The pairing code typed in for the device to add. */
  protected readonly code = signal('');
  /** The pairing codes typed in for the devices that wait for one, by their id. */
  protected readonly codes = signal<Record<string, string>>({});
  /** This device's own pairing code, for a hub that collects from it; empty until it is read. */
  protected readonly ownCode = signal('');
  protected readonly kinds = DEVICE_KINDS;
  protected readonly addKinds = ADD_KINDS;
  /** Whether the device to add is a phone, which has no address but needs its pairing code. */
  protected readonly addsPhone = computed(() => this.kind() === 'phone');
  /** Whether the form holds enough to add the device. */
  protected readonly canAdd = computed(
    () => !!this.name().trim() && !!(this.addsPhone() ? this.code().trim() : this.address().trim()),
  );
  /**
   * The hub's address for a phone's app: the name or address the page was opened with and the
   * port the hub tells, which differs behind a proxy. Empty when the page was opened on the hub
   * itself, whose own name a phone cannot reach.
   */
  protected readonly hubAddress = computed(() =>
    phoneAddress(this.document.location, this.devices.pagePort()),
  );
  /**
   * The QR code a phone's app scans for the hub's address, as the page's address; null without an
   * address to give.
   */
  protected readonly hubCode = computed(() => {
    const address = this.hubAddress();
    return address ? qrPath(`http://${address}/`) : null;
  });
  /** The port a phone's app is given with the hub's address. */
  protected readonly hubPort = computed(
    () => this.devices.pagePort() || this.document.location.port || String(DEFAULT_PORT),
  );
  protected readonly kindName = kindName;
  protected readonly deviceName = deviceName;
  protected readonly groups = inject(DeviceGroups);
  protected readonly maxGroupLength = MAX_GROUP_LENGTH;
  /** The remote status page; null until it is read, and when the hub has none. */
  protected readonly statusPage = signal<StatusPage | null>(null);
  /** The new password typed in for the status page, and typed again. */
  protected readonly statusPassword = signal('');
  protected readonly statusRepeated = signal('');
  protected readonly minLength = MIN_PASSWORD_LENGTH;
  protected readonly maxLength = MAX_PASSWORD_LENGTH;
  protected readonly statusMismatch = computed(
    () => this.statusRepeated() !== '' && this.statusRepeated() !== this.statusPassword(),
  );
  protected readonly canSetStatusPassword = computed(
    () =>
      this.statusPassword().length >= MIN_PASSWORD_LENGTH &&
      this.statusPassword().length <= MAX_PASSWORD_LENGTH &&
      this.statusRepeated() === this.statusPassword(),
  );
  /** Set once the status page's password was set in this dialog. */
  protected readonly statusSaved = signal(false);
  protected readonly problem = signal('');
  protected readonly busy = signal(false);
  /** Emits when a change starts, to stop a failed change's reading of the list. */
  private readonly changeStarted = new Subject<void>();
  /** The device the page is open on, as the hub suggested it. */
  private readonly suggestion = signal<Suggestion | null>(null);
  /** Whether the form holds the suggested device, which is never a phone. */
  protected readonly suggested = computed(
    () => !this.addsPhone() && this.suggestion()?.address === this.address().trim(),
  );

  constructor() {
    this.devices
      .pairingCode()
      .pipe(
        catchError(() => of('')),
        takeUntilDestroyed(),
      )
      .subscribe((code) => this.ownCode.set(code));

    this.loadStatusPage();

    // Filled in only when nothing has been typed yet; a suggestion that
    // cannot be read leaves the form empty, as before.
    this.devices
      .suggestion()
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(),
      )
      .subscribe((suggestion) => {
        if (!suggestion || this.name() || this.address()) {
          return;
        }
        this.suggestion.set(suggestion);
        this.name.set(suggestion.name);
        this.address.set(suggestion.address);
        this.kind.set(suggestion.kind);
      });
  }

  protected toggleList(): void {
    this.listOpen.update((open) => !open);
  }

  protected add(): void {
    if (!this.canAdd()) {
      return;
    }
    const name = this.name().trim();
    const address = this.address().trim();
    const kind = this.kind();
    const code = this.code().trim();
    this.change({ action: 'add', deviceName: name }, (result) =>
      kind === 'phone'
        ? this.devices.addPhone(name, code, result.password)
        : this.devices.add(name, address, kind, code, result.password),
    ).subscribe(() => {
      this.name.set('');
      this.address.set('');
      this.kind.set('server');
      this.code.set('');
    });
  }

  /** The pairing code typed in for a device that waits for one. */
  protected codeFor(device: Device): string {
    return this.codes()[device.id] ?? '';
  }

  protected typeCode(device: Device, code: string): void {
    this.codes.update((codes) => ({ ...codes, [device.id]: code }));
  }

  /** Gives a device that waits for its pairing code the one typed in. */
  protected setCode(device: Device): void {
    const code = this.codeFor(device).trim();
    if (!code) {
      return;
    }
    this.change({ action: 'pairing', deviceName: device.name }, (result) =>
      this.devices.setCode(device.id, code, result.password),
    ).subscribe(() => this.typeCode(device, ''));
  }

  /**
   * Puts a device in the group typed in, or in none when it is left empty. A group is part of the
   * page's layout, so it needs no password; the field shows the name as it was kept.
   */
  protected setGroup(device: Device, event: Event): void {
    const field = event.target as HTMLInputElement;
    this.groups.setGroup(device, field.value);
    field.value = this.groups.groupOf(device);
  }

  protected setKind(device: Device, kind: DeviceKind): void {
    if (device.kind === kind) {
      return;
    }
    this.change({ action: 'kind', deviceName: device.name, kind }, (result) =>
      this.devices.setKind(device.id, kind, result.password),
    ).subscribe();
  }

  protected remove(device: Device): void {
    this.change({ action: 'remove', deviceName: device.name }, (result) =>
      this.devices.remove(device.id, result.password, result.keepHistory),
    ).subscribe();
  }

  /** Lets a phone change its hub for a while; its app keeps it locked otherwise. */
  protected releasePhone(device: Device): void {
    this.change({ action: 'release', deviceName: device.name }, (result) =>
      this.devices.releasePhone(device.id, result.password),
    ).subscribe();
  }

  /** Until when a phone may change its hub, as a time of day; empty while it may not. */
  protected releasedUntil(device: Device): string {
    return device.releasedUntil
      ? formatDate(device.releasedUntil, this.i18n.t('format.time'), this.i18n.language())
      : '';
  }

  /** Asks for the password and downloads a copy of the hub's database. */
  protected backup(): void {
    this.change({ action: 'backup', deviceName: '' }, (result) =>
      this.devices
        .backup(result.password)
        .pipe(tap((backup) => saveFile(this.document, backup.file, backup.name))),
    ).subscribe();
  }

  /** Asks for the password for changing devices and sets the status page's password. */
  protected setStatusPassword(): void {
    if (!this.canSetStatusPassword()) {
      return;
    }
    const newPassword = this.statusPassword();
    this.statusSaved.set(false);
    this.change({ action: 'statusPassword', deviceName: '' }, (result) =>
      this.devices.setStatusPassword(newPassword, result.password),
    ).subscribe(() => {
      this.statusPassword.set('');
      this.statusRepeated.set('');
      this.statusSaved.set(true);
      this.loadStatusPage();
    });
  }

  /** Reads the remote status page; one that cannot be read is left out, as when there is none. */
  private loadStatusPage(): void {
    this.devices
      .statusPage()
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => this.statusPage.set(page?.enabled ? page : null));
  }

  /**
   * Asks for the password, makes the change and reads the list again. Emits
   * once when the change worked; a refused change shows its problem instead,
   * and the list is read again too, as a change that got no answer may still
   * have been made. The buttons work again right away rather than after that
   * read, which can take as long again when the hub is gone; a change started
   * meanwhile stops that read, so it neither frees the buttons too early nor
   * overwrites the list the new change reads. A change still goes on once
   * the dialog is closed, but its read of the list stops: the device picker
   * reads the list again in a few seconds.
   */
  private change(
    ask: Omit<PasswordDialogData, 'passwordSet'>,
    makeChange: (result: PasswordDialogResult) => Observable<unknown>,
  ): Observable<unknown> {
    const data: PasswordDialogData = { ...ask, passwordSet: this.devices.passwordSet() };
    return this.dialog
      .open<PasswordDialog, PasswordDialogData, PasswordDialogResult>(PasswordDialog, { data })
      .afterClosed()
      .pipe(
        filter((result) => result !== undefined),
        tap(() => {
          this.changeStarted.next();
          this.busy.set(true);
          this.problem.set('');
        }),
        // Once the change worked, a list that cannot be read is no failure of
        // the change: the device picker reads the list again in a few seconds.
        switchMap((result) =>
          makeChange(result).pipe(
            switchMap(() =>
              this.devices.load().pipe(
                takeUntilDestroyed(this.destroyRef),
                catchError(() => of(null)),
              ),
            ),
          ),
        ),
        catchError((error: unknown) => {
          this.problem.set(problemMessage(error, this.i18n));
          this.busy.set(false);
          return this.devices.load().pipe(
            takeUntil(this.changeStarted),
            takeUntilDestroyed(this.destroyRef),
            ignoreElements(),
            catchError(() => EMPTY),
          );
        }),
        finalize(() => this.busy.set(false)),
      );
  }
}

/** Opens the list of devices. */
export function openDevicesDialog(injector: Injector): void {
  injector.get(MatDialog).open(DevicesDialog, { autoFocus: 'first-tabbable', injector });
}

/**
 * The hub's address for a phone's app, from where the page was opened and the port the hub tells:
 * empty for a name only this machine knows, such as localhost.
 */
export function phoneAddress(
  location: Pick<Location, 'hostname' | 'port'>,
  pagePort: string,
): string {
  const host = location.hostname;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.startsWith('127.') ||
    host === '[::1]'
  ) {
    return '';
  }
  return `${host}:${pagePort || location.port || DEFAULT_PORT}`;
}
