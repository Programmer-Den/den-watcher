import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Alert } from '../alerts/alert';
import { Device, DeviceService } from '../devices/devices';
import { I18n } from '../i18n/i18n';
import { Snapshot } from '../metrics/metrics';
import { DeviceHeader, deviceIcon, deviceStatus, hostOf } from './device-header';

const SNAPSHOT: Snapshot = {
  time: '2026-11-26T12:00:00Z',
  uptimeSeconds: 12 * 86400 + 3 * 3600,
  cpu: { usagePercent: 11, cores: 4 },
  memory: { totalBytes: 8, usedBytes: 3, usedPercent: 38 },
  temperatures: [],
  disks: [],
  network: [],
  system: { os: 'Debian GNU/Linux 13 (trixie)', model: 'Raspberry Pi 5 Model B Rev 1.0' },
};

function alert(level: Alert['level'], id: number): Alert {
  return { id, device: 'nas', deviceName: 'NAS', kind: 'disk', level, started: SNAPSHOT.time };
}

describe('deviceIcon', () => {
  it('draws each kind of device', () => {
    expect(deviceIcon({ id: 'local', name: '' })).toBe('server');
    expect(deviceIcon({ id: 'a', name: 'A', kind: 'server' })).toBe('server');
    expect(deviceIcon({ id: 'b', name: 'B', kind: 'pc' })).toBe('pc');
    expect(deviceIcon({ id: 'c', name: 'C', kind: 'phone' })).toBe('phone');
    expect(deviceIcon({ id: 'd', name: 'D', kind: 'server', router: true })).toBe('router');
    expect(deviceIcon({ id: 'e', name: 'E', kind: 'server', checked: true })).toBe('checked');
  });
});

describe('hostOf', () => {
  it('leaves out the port', () => {
    expect(hostOf('192.168.1.21:9393')).toBe('192.168.1.21');
    expect(hostOf('192.168.1.1')).toBe('192.168.1.1');
    expect(hostOf('nas.local:9393')).toBe('nas.local');
    expect(hostOf('[fd00::5]:9393')).toBe('fd00::5');
    expect(hostOf('fd00::5')).toBe('fd00::5');
  });
});

describe('deviceStatus', () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = TestBed.inject(I18n);
    i18n.language.set('en-GB');
  });

  it('is fine without alerts', () => {
    expect(deviceStatus({ id: 'a', name: 'A' }, false, i18n)).toEqual({
      level: 'fine',
      text: 'All fine',
    });
  });

  it('counts the warnings, or only the alerts when there is one', () => {
    const warnings: Device = {
      id: 'a',
      name: 'A',
      alerts: [alert('warning', 1), alert('warning', 2)],
    };
    expect(deviceStatus(warnings, false, i18n)).toEqual({ level: 'warning', text: '2 warnings' });
    const mixed: Device = { id: 'a', name: 'A', alerts: [alert('warning', 1), alert('alert', 2)] };
    expect(deviceStatus(mixed, false, i18n)).toEqual({ level: 'alert', text: '1 alert' });
  });

  it('tells a device that does not answer by its kind', () => {
    expect(deviceStatus({ id: 'a', name: 'A', kind: 'server' }, true, i18n)).toEqual({
      level: 'alert',
      text: 'Not answering',
    });
    expect(deviceStatus({ id: 'b', name: 'B', kind: 'pc' }, true, i18n)).toEqual({
      level: 'off',
      text: 'Not in use',
    });
    expect(deviceStatus({ id: 'c', name: 'C', kind: 'phone' }, true, i18n)).toEqual({
      level: 'off',
      text: 'Away',
    });
  });
});

describe('DeviceHeader', () => {
  let fixture: ComponentFixture<DeviceHeader>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DeviceHeader],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(I18n).language.set('en-GB');
    fixture = TestBed.createComponent(DeviceHeader);
  });

  function text(selector: string): string {
    return (
      (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? ''
    );
  }

  it('names the hub and tells what it is', () => {
    fixture.componentRef.setInput('snapshot', SNAPSHOT);
    fixture.detectChanges();
    expect(text('h2')).toBe('Host Hub');
    expect(text('.facts')).toContain('Raspberry Pi 5 Model B Rev 1.0');
    expect(text('.facts')).toContain('Debian GNU/Linux 13 (trixie)');
    expect(text('.facts')).toContain('up 12 d 3 h');
    expect(text('.status')).toBe('All fine');
  });

  it('tells a router and its address before it has a reading', () => {
    const devices = TestBed.inject(DeviceService);
    devices.devices.set([
      { id: 'local', name: '' },
      { id: 'router', name: 'Home router', address: '192.168.1.1', kind: 'server', router: true },
    ]);
    devices.selectedId.set('router');
    fixture.componentRef.setInput('unanswered', true);
    fixture.detectChanges();
    expect(text('h2')).toBe('Home router');
    expect(text('.facts')).toContain('Router');
    expect(text('.facts')).toContain('192.168.1.1');
    expect(text('.status')).toBe('Not answering');
  });
});
