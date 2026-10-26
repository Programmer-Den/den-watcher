import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { Device, DeviceService, LOCAL_DEVICE } from '../devices/devices';
import { I18n, LANGUAGE_STORAGE_KEY } from '../i18n/i18n';
import { SERVICE_WORKERS } from '../install/install';
import { Alert } from './alert';
import {
  AlertNotifications,
  BROWSER_NOTIFICATIONS,
  NOTIFY_STORAGE_KEY,
  NotifySetting,
} from './alert-notifications';
import { AlertsDialog } from './alerts-dialog';

const disk: Alert = {
  id: 1,
  device: 'nas',
  deviceName: 'NAS',
  kind: 'disk',
  subject: '/',
  level: 'warning',
  value: 91.4,
  started: '2026-10-11T18:00:00Z',
};

/** Stands in for the browser's Notification, and keeps what it was asked to show. */
class FakeNotification {
  static permission: NotificationPermission = 'default';
  static answer: NotificationPermission = 'granted';
  static shown: { title: string; body?: string; tag?: string }[] = [];
  /** Whether only a service worker may show them, as on Chrome on Android. */
  static workerOnly = false;
  static requestPermission = vi.fn(() => {
    FakeNotification.permission = FakeNotification.answer;
    return Promise.resolve(FakeNotification.answer);
  });
  onclick: (() => void) | null = null;

  constructor(title: string, options: NotificationOptions = {}) {
    if (FakeNotification.workerOnly) {
      throw new TypeError('Illegal constructor');
    }
    FakeNotification.shown.push({ title, body: options.body, tag: options.tag });
  }

  close(): void {
    // Nothing to close.
  }
}

describe('AlertNotifications', () => {
  let devices: DeviceService;

  function setUp(
    api: typeof FakeNotification | null = FakeNotification,
    workers: Partial<ServiceWorkerContainer> | null = null,
  ): AlertNotifications {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: BROWSER_NOTIFICATIONS,
          useValue: { secure: true, api: api as unknown as typeof Notification },
        },
        { provide: SERVICE_WORKERS, useValue: workers },
      ],
    });
    TestBed.inject(I18n).use('en-GB');
    devices = TestBed.inject(DeviceService);
    return TestBed.inject(AlertNotifications);
  }

  /** The hub's answer with the NAS having alerts, as a read of the list sets it. */
  function read(alerts: Alert[], others: Device[] = []): void {
    devices.devices.set([LOCAL_DEVICE, { id: 'nas', name: 'NAS', alerts }, ...others]);
    devices.loaded.set(true);
    TestBed.tick();
  }

  beforeEach(() => {
    FakeNotification.permission = 'default';
    FakeNotification.answer = 'granted';
    FakeNotification.shown = [];
    FakeNotification.workerOnly = false;
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(NOTIFY_STORAGE_KEY);
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it('is off until switched on, and asks the browser for leave then', async () => {
    const notifications = setUp();
    expect(notifications.on()).toBe(false);

    await notifications.set('started');

    expect(FakeNotification.requestPermission).toHaveBeenCalled();
    expect(notifications.on()).toBe(true);
    expect(localStorage.getItem(NOTIFY_STORAGE_KEY)).toBe('started');
  });

  it('stays off when the browser does not allow it', async () => {
    FakeNotification.answer = 'denied';
    const notifications = setUp();

    await notifications.set('started');

    expect(notifications.on()).toBe(false);
    expect(notifications.permission()).toBe('denied');
    expect(localStorage.getItem(NOTIFY_STORAGE_KEY)).toBe('off');
  });

  it('tells about new alerts and warnings that became alerts, not the ones there before', async () => {
    const notifications = setUp();
    await notifications.set('started');
    read([disk]);
    expect(FakeNotification.shown).toEqual([]);

    const memory: Alert = { ...disk, id: 2, kind: 'memory', subject: undefined, value: 96 };
    read([disk, { ...memory, level: 'alert' }]);
    read([
      { ...disk, level: 'alert', value: 95.2 },
      { ...memory, level: 'alert' },
    ]);
    read([]);

    expect(FakeNotification.shown).toEqual([
      { title: 'NAS', body: 'Alert: Memory is 96 % used', tag: 'den-watcher-alert-2' },
      { title: 'NAS', body: 'Alert: Disk / is 95 % full', tag: 'den-watcher-alert-1' },
    ]);
  });

  it('tells about the end of an alert when asked to, not about a device removed', async () => {
    const notifications = setUp();
    await notifications.set('startedAndEnded');
    read([disk], [{ id: 'pi', name: 'Pi', alerts: [{ ...disk, id: 3, device: 'pi' }] }]);

    read([]);

    expect(FakeNotification.shown).toEqual([
      { title: 'NAS', body: 'Ended: Disk / is 91 % full', tag: 'den-watcher-alert-1' },
    ]);
  });

  it('tells nothing while the page is in front, or when switched off', async () => {
    const notifications = setUp();
    await notifications.set('started');
    read([]);
    vi.mocked(document.hasFocus).mockReturnValue(true);
    read([disk]);

    vi.mocked(document.hasFocus).mockReturnValue(false);
    await notifications.set('off');
    read([disk, { ...disk, id: 2 }]);

    expect(FakeNotification.shown).toEqual([]);
  });

  it('shows them from the service worker where the page may not show them itself', async () => {
    FakeNotification.workerOnly = true;
    const shown: { title: string; body?: string; tag?: string }[] = [];
    const worker = {
      showNotification: (title: string, options: NotificationOptions) => {
        shown.push({ title, body: options.body, tag: options.tag });
        return Promise.resolve();
      },
    } as ServiceWorkerRegistration;
    const notifications = setUp(FakeNotification, { ready: Promise.resolve(worker) });
    await notifications.set('started');
    read([]);

    read([disk]);
    await new Promise((resolve) => setTimeout(resolve));

    expect(shown).toEqual([
      { title: 'NAS', body: 'Warning: Disk / is 91 % full', tag: 'den-watcher-alert-1' },
    ]);
  });

  it('takes the choice made last time in this browser', () => {
    FakeNotification.permission = 'granted';
    localStorage.setItem(NOTIFY_STORAGE_KEY, 'startedAndEnded' satisfies NotifySetting);
    const notifications = setUp();

    expect(notifications.setting()).toBe('startedAndEnded');
    expect(notifications.on()).toBe(true);
  });

  it('is not available where the browser does not offer it to the page', async () => {
    const notifications = setUp(null);
    await notifications.set('started');

    expect(notifications.available).toBe(false);
    expect(notifications.on()).toBe(false);
  });
});

describe('AlertsDialog', () => {
  let fixture: ComponentFixture<AlertsDialog>;

  afterEach(() => {
    FakeNotification.answer = 'granted';
    localStorage.removeItem(NOTIFY_STORAGE_KEY);
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  function open(secure: boolean, api: typeof FakeNotification | null): HTMLElement {
    TestBed.configureTestingModule({
      imports: [AlertsDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: BROWSER_NOTIFICATIONS,
          useValue: { secure, api: api as unknown as typeof Notification },
        },
      ],
    });
    TestBed.inject(I18n).use('en-GB');
    fixture = TestBed.createComponent(AlertsDialog);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/alerts').flush([]);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers notifications where the browser has them', () => {
    FakeNotification.permission = 'default';
    const element = open(true, FakeNotification);

    const boxes = element.querySelectorAll('mat-checkbox');
    expect(boxes.length).toBe(2);
    expect(boxes[0].textContent).toContain('Notify me of new alerts');
    expect(element.textContent).not.toContain('https');
  });

  it('unticks the box again when the browser refuses notifications', async () => {
    FakeNotification.permission = 'default';
    FakeNotification.answer = 'denied';
    const element = open(true, FakeNotification);
    const box = element.querySelector<HTMLInputElement>('mat-checkbox input')!;

    box.click();
    expect(box.checked).toBe(true);
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(box.checked).toBe(false);
    expect(TestBed.inject(AlertNotifications).on()).toBe(false);
  });

  it('says why there are none on a page opened over plain http', () => {
    const element = open(false, null);

    expect(element.querySelector('mat-checkbox')).toBeNull();
    expect(element.textContent).toContain('need the page opened over https or on localhost');
  });
});
