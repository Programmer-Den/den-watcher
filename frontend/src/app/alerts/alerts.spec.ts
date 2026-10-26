import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DeviceService, LOCAL_DEVICE } from '../devices/devices';
import { I18n, LANGUAGE_STORAGE_KEY } from '../i18n/i18n';
import { MissingParts } from '../update/missing-part';
import { Alert } from './alert';
import { AlertsButton } from './alerts-button';
import { AlertService, alertDeviceName, alertText, worstLevel } from './alerts';

const disk: Alert = {
  id: 1,
  device: 'nas',
  deviceName: 'NAS',
  kind: 'disk',
  subject: '/srv/data',
  level: 'warning',
  value: 91.6,
  started: '2026-10-11T18:00:00Z',
};

describe('alerts', () => {
  let i18n: I18n;
  let devices: DeviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    i18n = TestBed.inject(I18n);
    i18n.use('en-GB');
    devices = TestBed.inject(DeviceService);
  });

  afterEach(() => localStorage.removeItem(LANGUAGE_STORAGE_KEY));

  it('says what an alert is about in the page language', () => {
    expect(alertText(disk, i18n)).toBe('Disk /srv/data is 92 % full');
    expect(
      alertText({ ...disk, kind: 'temperature', subject: 'cpu_thermal', value: 86.2 }, i18n),
    ).toBe('cpu_thermal is at 86 °C');
    expect(
      alertText({ ...disk, kind: 'throttling', subject: 'undervoltage,throttled' }, i18n),
    ).toBe('Power supply or cooling: Undervoltage, Throttled');
    expect(alertText({ ...disk, kind: 'offline', subject: undefined }, i18n)).toBe(
      'Does not answer',
    );
    expect(
      alertText({ ...disk, kind: 'wifi-lookalike', subject: 'Den', value: undefined }, i18n),
    ).toBe('A network named like Den but secured otherwise is nearby');
    expect(alertText({ ...disk, kind: 'fan' as Alert['kind'] }, i18n)).toBe(
      'Something needs attention',
    );
    i18n.use('de');
    expect(alertText(disk, i18n)).toBe('Datenträger /srv/data ist zu 92 % voll');
  });

  it('takes the worst level', () => {
    expect(worstLevel([])).toBeNull();
    expect(worstLevel([disk])).toBe('warning');
    expect(worstLevel([disk, { ...disk, level: 'alert' }])).toBe('alert');
  });

  it('names the device as the page does now, or as it was named when it is gone', () => {
    devices.devices.set([LOCAL_DEVICE, { id: 'nas', name: 'Basement NAS' }]);
    expect(alertDeviceName(disk, devices, i18n)).toBe('Basement NAS');
    expect(alertDeviceName({ ...disk, device: 'local', deviceName: '' }, devices, i18n)).toBe(
      'Host Hub',
    );
    expect(
      alertDeviceName({ ...disk, device: 'old-pi', deviceName: 'Old Pi' }, devices, i18n),
    ).toBe('Old Pi');
  });

  it('collects the active alerts of every device', () => {
    devices.devices.set([
      { ...LOCAL_DEVICE, alerts: [{ ...disk, device: 'local' }] },
      { id: 'nas', name: 'NAS', alerts: [disk, { ...disk, id: 2, subject: '/' }] },
    ]);
    expect(TestBed.inject(AlertService).active().length).toBe(3);
  });
});

describe('AlertsButton', () => {
  it('is big and red with the number of alerts, and quiet without any', () => {
    TestBed.configureTestingModule({
      imports: [AlertsButton],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(I18n).use('en-GB');
    const devices = TestBed.inject(DeviceService);
    const fixture = TestBed.createComponent(AlertsButton);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('button.quiet')?.textContent).toContain('Alert log');

    devices.devices.set([
      LOCAL_DEVICE,
      { id: 'nas', name: 'NAS', alerts: [disk, { ...disk, id: 2, level: 'alert' }] },
    ]);
    fixture.detectChanges();
    const button = element.querySelector('button.active');
    expect(button?.textContent).toContain('2 alerts');
    expect(button?.classList).not.toContain('warning');
    expect(button?.querySelector('app-alert-icon')).not.toBeNull();
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it('loads the log through MissingParts, so one that is missing is not just ignored', async () => {
    TestBed.configureTestingModule({
      imports: [AlertsButton],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const openAlertsDialog = vi.fn();
    const load = vi
      .spyOn(TestBed.inject(MissingParts), 'load')
      .mockResolvedValue({ openAlertsDialog } as never);
    const fixture = TestBed.createComponent(AlertsButton);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(load).toHaveBeenCalledTimes(1);
    expect(openAlertsDialog).toHaveBeenCalledTimes(1);
  });
});
