import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';

import { I18n } from '../i18n/i18n';
import {
  DEVICES_HIDDEN_REFRESH_MS,
  DEVICES_REFRESH_MS,
  DeviceService,
  backupName,
  deviceState,
  notInUse,
  problemMessage,
} from './devices';

describe('DeviceService', () => {
  let http: HttpTestingController;
  let devices: DeviceService;
  let polling: Subscription;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    devices = TestBed.inject(DeviceService);
    polling = devices.polling.subscribe();
    vi.advanceTimersByTime(0);
  });

  afterEach(() => {
    polling.unsubscribe();
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a device on its own, also while comparing', () => {
    http.expectOne('/api/devices').flush({ devices: [{ id: 'local', name: '' }] });
    devices.comparing.set(true);

    devices.show('nas');

    expect(devices.selectedId()).toBe('nas');
    expect(devices.comparing()).toBe(false);
  });

  it('shows the home page or the comparison, one at a time, until a device is picked', () => {
    http.expectOne('/api/devices').flush({ devices: [{ id: 'local', name: '' }] });

    devices.goHome();
    expect([devices.home(), devices.comparing()]).toEqual([true, false]);
    devices.compare();
    expect([devices.home(), devices.comparing()]).toEqual([false, true]);
    devices.goHome();
    devices.show('local');
    expect([devices.home(), devices.comparing()]).toEqual([false, false]);
  });

  it('reads the list again every few seconds, and only now and then while the page is hidden', () => {
    let visibilityState: DocumentVisibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    http.expectOne('/api/devices').flush({ devices: [{ id: 'local', name: '' }] });

    vi.advanceTimersByTime(DEVICES_REFRESH_MS);
    http.expectOne('/api/devices').flush({ devices: [{ id: 'local', name: '' }] });

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(DEVICES_HIDDEN_REFRESH_MS - 1);
    http.expectNone('/api/devices');
    vi.advanceTimersByTime(1);
    http.expectOne('/api/devices').flush({ devices: [{ id: 'local', name: '' }] });

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(0);
    http.expectOne('/api/devices').flush({
      devices: [
        { id: 'local', name: '' },
        { id: 'pi', name: 'Pi' },
      ],
    });
    expect(devices.devices().map((d) => d.id)).toEqual(['local', 'pi']);
    expect(devices.loaded()).toBe(true);
  });

  it('keeps only this device when the list cannot be read, and tries again', () => {
    http.expectOne('/api/devices').flush('down', { status: 502, statusText: 'Bad Gateway' });

    expect(devices.devices().map((d) => d.id)).toEqual(['local']);
    expect(devices.selected().id).toBe('local');

    vi.advanceTimersByTime(DEVICES_REFRESH_MS);
    http.expectOne('/api/devices').flush({ devices: [{ id: 'local', name: '' }] });
  });

  it('shows this device again when the picked one is removed', () => {
    devices.selectedId.set('pi');
    http.expectOne('/api/devices').flush({ devices: [{ id: 'local', name: '' }] });

    expect(devices.selectedId()).toBe('local');
  });
});

describe('backupName', () => {
  it('names a backup as the hub does, or with a name of its own', () => {
    expect(backupName('attachment; filename="den-watcher-2026-10-13.db"')).toBe(
      'den-watcher-2026-10-13.db',
    );
    expect(backupName('attachment; filename="../etc/passwd"')).toBe('den-watcher.db');
    expect(backupName(null)).toBe('den-watcher.db');
  });
});

describe('deviceState', () => {
  it('counts a device that waits for its pairing code as answering', () => {
    expect(deviceState({ id: 'nas', name: 'NAS', unreachable: true, pairing: 'needed' })).toBe(
      'reachable',
    );
    expect(deviceState({ id: 'nas', name: 'NAS', unreachable: true })).toBe('unreachable');
  });
});

describe('notInUse', () => {
  it('takes a PC or phone that does not answer for one not in use, and a server for an outage', () => {
    expect(notInUse({ id: 'phone', name: 'Phone', kind: 'phone', unreachable: true })).toBe(true);
    expect(notInUse({ id: 'laptop', name: 'Laptop', kind: 'pc', unreachable: true })).toBe(true);
    expect(notInUse({ id: 'nas', name: 'NAS', kind: 'server', unreachable: true })).toBe(false);
    expect(notInUse({ id: 'phone', name: 'Phone', kind: 'phone' })).toBe(false);
  });
});

describe('problemMessage', () => {
  it('names both lengths a password may have', () => {
    const i18n = TestBed.inject(I18n);
    i18n.language.set('en-GB');
    const refused = new HttpErrorResponse({ status: 400, error: { problem: 'passwordLength' } });
    expect(problemMessage(refused, i18n)).toBe('The password needs 8 to 128 characters.');
  });
});
