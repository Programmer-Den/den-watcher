import { ComponentFixture, TestBed } from '@angular/core/testing';

import { I18n } from '../i18n/i18n';
import { Extra } from '../metrics/extras';
import { Snapshot } from '../metrics/metrics';
import { GlanceAlso } from './glance-also';

const SNAPSHOT: Snapshot = {
  time: '2026-11-27T12:00:00Z',
  uptimeSeconds: 60,
  cpu: { usagePercent: 10, cores: 4 },
  memory: { totalBytes: 8, usedBytes: 3, usedPercent: 38 },
  temperatures: [],
  disks: [],
  network: [],
};

const PROGRAMS: Extra = {
  id: 'processes-cpu',
  title: 'Top processes by CPU',
  items: [
    { id: 'pid-812', label: 'den-watcher', unit: 'percent', value: 3.3 },
    { id: 'pid-655', label: 'dockerd', unit: 'percent', value: 2 },
    { id: 'pid-1', label: 'systemd', unit: 'percent', value: 0 },
  ],
};

const BLUETOOTH: Extra = {
  id: 'bluetooth',
  title: 'Bluetooth',
  items: [
    { id: 'connected', label: 'Connected devices', unit: 'number', value: 2 },
    {
      id: 'device-3f9a61c2',
      label: 'JBL Flip 6',
      unit: 'text',
      text: 'Battery 55%',
    },
    { id: 'device-a40c7e19', label: 'Keychron K3', unit: 'text', text: 'Keyboard' },
  ],
};

const PORTS: Extra = {
  id: 'ports',
  title: 'Listening ports',
  items: [
    { id: 'count', label: 'Listening ports', unit: 'number', value: 2 },
    { id: 'tcp-22', label: 'TCP 22', unit: 'text', text: '0.0.0.0' },
    { id: 'tcp-9393', label: 'TCP 9393', unit: 'text', text: '0.0.0.0' },
  ],
};

describe('GlanceAlso', () => {
  let fixture: ComponentFixture<GlanceAlso>;

  beforeEach(() => {
    TestBed.inject(I18n).language.set('en-GB');
    fixture = TestBed.createComponent(GlanceAlso);
  });

  function show(extras: Extra[] | undefined): string[] {
    fixture.componentRef.setInput('snapshot', { ...SNAPSHOT, extras });
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('p'), (p) =>
      p.textContent!.replace(/\s+/g, ' ').trim(),
    );
  }

  it('lists the busiest programs, the Bluetooth devices and the open ports', () => {
    expect(show([PORTS, BLUETOOTH, PROGRAMS])).toEqual([
      'Busiest programs den-watcher 3.3 %, dockerd 2 %',
      'Bluetooth JBL Flip 6, Keychron K3',
      'Open ports TCP 22, TCP 9393',
    ]);
  });

  it("lists a router's devices online first, and says how many more there are", () => {
    const online: Extra = {
      id: 'connected',
      title: 'Online now',
      items: ['Desktop', 'Laptop', 'NAS', 'Phone', 'Printer', 'Visitor phone'].map((label, i) => ({
        id: `client-${i + 1}`,
        label,
        unit: 'text',
        text: '5 GHz',
      })),
    };
    expect(show([PORTS, online])).toEqual([
      'Online now Desktop, Laptop, NAS, Phone, 2 more',
      'Open ports TCP 22, TCP 9393',
    ]);
  });

  it('hides when the device tells none of them', () => {
    expect(show(undefined)).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).hidden).toBe(true);
  });
});
