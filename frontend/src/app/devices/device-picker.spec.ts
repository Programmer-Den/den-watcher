import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HubConnection } from '../connection/connection';
import { EMPTY_LAYOUT } from '../dashboard/page-layout';
import { Snapshot } from '../metrics/metrics';
import { DevicePicker } from './device-picker';
import { Device, DeviceService } from './devices';

describe('DevicePicker', () => {
  let fixture: ComponentFixture<DevicePicker>;
  let http: HttpTestingController;

  beforeEach(() => {
    // The group the list shows is kept in the browser.
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [DevicePicker],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // The groups of the devices come with the page's layout; device-groups.spec.ts covers them.
    http.match('/api/layout');
    http.verify();
    vi.useRealTimers();
  });

  /** Shows the list with these devices, and answers the first read of their values with `cpu`. */
  function show(devices: Device[], cpu: Record<string, number> = {}): void {
    TestBed.inject(DeviceService).devices.set(devices);
    fixture = TestBed.createComponent(DevicePicker);
    fixture.detectChanges();
    vi.advanceTimersByTime(0);
    for (const request of http.match('/api/devices/metrics')) {
      request.flush(
        Object.fromEntries(
          devices.filter((d) => !d.unreachable).map((d) => [d.id, snapshot(cpu[d.id] ?? 0)]),
        ),
      );
    }
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function items(): HTMLButtonElement[] {
    return Array.from(element().querySelectorAll('app-device-item button'));
  }

  function text(node: Element): string {
    return node.textContent!.replace(/\s+/g, ' ').trim();
  }

  it('groups the devices into servers and PCs, between the comparison and the devices button', () => {
    show([
      { id: 'local', name: '' },
      { id: 'laptop', name: 'Laptop', kind: 'pc' },
      { id: 'nas', name: 'NAS', kind: 'server' },
      { id: 'printer', name: 'Printer', checked: true },
    ]);

    expect(Array.from(element().querySelectorAll('h2'), text)).toEqual([
      'Servers and IoT',
      'PCs and laptops',
    ]);
    expect(items().map((b) => text(b.querySelector('.name')!))).toEqual([
      'Host Hub',
      'NAS',
      'Printer',
      'Laptop',
    ]);
    expect(text(element().querySelector('.compare')!)).toBe('Compare devices');
    expect(text(element().querySelector('app-manage-button')!)).toBe('Devices');
  });

  it('offers no groups to pick until a device is put in one', () => {
    show([
      { id: 'local', name: '' },
      { id: 'nas', name: 'NAS' },
    ]);
    http.expectOne('/api/layout').flush(EMPTY_LAYOUT);
    fixture.detectChanges();

    expect(element().querySelector('app-group-filter button')).toBeNull();
  });

  it('shows only the devices of the group picked', () => {
    show([
      { id: 'local', name: '' },
      { id: 'nas', name: 'NAS' },
      { id: 'laptop', name: 'Laptop', kind: 'pc' },
    ]);
    http
      .expectOne('/api/layout')
      .flush({ ...EMPTY_LAYOUT, groups: { nas: 'Rack', laptop: 'Office' } });
    fixture.detectChanges();
    const choices = () => Array.from(element().querySelectorAll('app-group-filter button'));
    expect(choices().map(text)).toEqual(['All', 'Office', 'Rack']);
    expect(choices()[0].getAttribute('aria-pressed')).toBe('true');

    (choices()[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(choices()[2].getAttribute('aria-pressed')).toBe('true');
    expect(items().map((b) => text(b.querySelector('.name')!))).toEqual(['NAS']);
    expect(Array.from(element().querySelectorAll('h2'), text)).toEqual(['Servers and IoT']);
  });

  it('lists phones last, in a group of their own', () => {
    show([
      { id: 'local', name: '' },
      { id: 'phone', name: 'Phone', kind: 'phone', unreachable: true },
      { id: 'laptop', name: 'Laptop', kind: 'pc' },
    ]);

    expect(Array.from(element().querySelectorAll('h2'), text)).toEqual([
      'Servers and IoT',
      'PCs and laptops',
      'Phones',
    ]);
    expect(items().map((b) => text(b.querySelector('.name')!))).toEqual([
      'Host Hub',
      'Laptop',
      'Phone',
    ]);
  });

  it('tells the CPU and hottest sensor of each device that answers', () => {
    show(
      [
        { id: 'local', name: '' },
        { id: 'pi', name: 'Pi' },
      ],
      { local: 12.4, pi: 80 },
    );

    expect(items().map((b) => text(b.querySelector('.detail')!))).toEqual([
      'CPU 12 % 45 °C',
      'CPU 80 % 45 °C',
    ]);
  });

  it('shows the picked device, or the comparison until a device is picked', () => {
    show([
      { id: 'local', name: '' },
      { id: 'pi', name: 'Pi' },
    ]);
    const devices = TestBed.inject(DeviceService);
    const compare = element().querySelector<HTMLButtonElement>('.compare')!;
    const pressed = () =>
      [compare, ...items()].map((b) => b.getAttribute('aria-pressed') === 'true');

    expect(pressed()).toEqual([false, true, false]);

    compare.click();
    fixture.detectChanges();
    expect(devices.comparing()).toBe(true);
    expect(pressed()).toEqual([true, false, false]);

    items()[1].click();
    fixture.detectChanges();
    expect(devices.comparing()).toBe(false);
    expect(devices.selected().name).toBe('Pi');
    expect(pressed()).toEqual([false, false, true]);
  });

  it('shows the home page until a device or the comparison is picked', () => {
    show([
      { id: 'local', name: '' },
      { id: 'pi', name: 'Pi' },
    ]);
    const devices = TestBed.inject(DeviceService);
    const home = element().querySelector<HTMLButtonElement>('.home')!;
    const compare = element().querySelector<HTMLButtonElement>('.compare')!;
    const pressed = () =>
      [home, compare, ...items()].map((b) => b.getAttribute('aria-pressed') === 'true');
    expect(text(home)).toBe('Home');

    home.click();
    fixture.detectChanges();
    expect(devices.home()).toBe(true);
    expect(pressed()).toEqual([true, false, false, false]);

    compare.click();
    fixture.detectChanges();
    expect(pressed()).toEqual([false, true, false, false]);
  });

  it('tells why a device does not answer, and a PC that is off is just not in use', () => {
    show([
      { id: 'local', name: '' },
      { id: 'pi', name: 'Pi', unreachable: true },
      {
        id: 'laptop',
        name: 'Laptop',
        kind: 'pc',
        unreachable: true,
        unreachableSince: '2026-10-02T11:00:00Z',
      },
    ]);
    const [hub, pi, laptop] = items();

    expect(hub.getAttribute('title')).toBe('Reachable');
    expect(pi.getAttribute('title')).toBe('Not reachable');
    expect(text(pi.querySelector('.detail')!)).toBe('Not reachable');
    expect(pi.querySelector('app-status-dot')?.classList).toContain('unreachable');
    expect(text(laptop.querySelector('.detail')!)).toMatch(/^Not in use since /);
    expect(laptop.querySelector('app-status-dot')?.classList).toContain('notInUse');
  });

  it('marks the hub unreachable and the other devices unknown while the hub does not answer', () => {
    show([
      { id: 'local', name: '' },
      { id: 'pi', name: 'Pi' },
    ]);

    TestBed.inject(HubConnection).failed();
    fixture.detectChanges();

    const [hub, pi] = items();
    expect(hub.querySelector('app-status-dot')?.classList).toContain('unreachable');
    expect(hub.getAttribute('title')).toMatch(/^Not reachable since /);
    expect(pi.querySelector('app-status-dot')?.classList).toContain('unknown');
    expect(pi.getAttribute('title')).toBe('Unknown while Host Hub is not answering');

    TestBed.inject(HubConnection).answered();
    fixture.detectChanges();
    expect(hub.querySelector('app-status-dot')?.classList).toContain('reachable');
    expect(pi.querySelector('app-status-dot')?.classList).toContain('reachable');
  });

  it('compact, shows each device as its initials, with its name and state for screen readers', () => {
    show(
      [
        { id: 'local', name: '' },
        { id: 'nas', name: 'Linux NAS', unreachable: true },
      ],
      { local: 30 },
    );
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    const [hub, nas] = items();
    expect(text(hub.querySelector('.avatar')!)).toBe('HH');
    expect(hub.querySelector('.usage')?.getAttribute('stroke-dasharray')).toBe('30 100');
    expect(hub.getAttribute('title')).toBe('Host Hub · Reachable');
    expect(text(nas)).toBe('LN Linux NAS (Not reachable)');
    expect(nas.querySelector('.usage')).toBeNull();
  });
});

function snapshot(cpu: number): Snapshot {
  return {
    time: '2026-10-11T12:00:00Z',
    uptimeSeconds: 60,
    cpu: { usagePercent: cpu, cores: 4 },
    memory: { totalBytes: 100, usedBytes: 50, usedPercent: 50 },
    temperatures: [{ sensor: 'cpu', celsius: 45 }],
    disks: [],
    network: [],
  };
}
