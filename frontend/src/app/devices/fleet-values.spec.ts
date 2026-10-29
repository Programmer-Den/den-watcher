import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DeviceService } from './devices';
import { FLEET_REFRESH_MS, FleetValues } from './fleet-values';

describe('FleetValues', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('reads the answering devices in one request for all watchers, and none while nobody watches', () => {
    TestBed.inject(DeviceService).devices.set([
      { id: 'local', name: '' },
      { id: 'pi', name: 'Pi' },
      { id: 'laptop', name: 'Laptop', kind: 'pc', unreachable: true },
    ]);
    const fleet = TestBed.inject(FleetValues);
    const first = fleet.watch.subscribe();
    const second = fleet.watch.subscribe();
    vi.advanceTimersByTime(0);

    http.expectOne('/api/devices/metrics').flush({
      pi: {
        time: '2026-10-11T12:00:00Z',
        uptimeSeconds: 60,
        cpu: { usagePercent: 20, cores: 4 },
        memory: { totalBytes: 100, usedBytes: 50, usedPercent: 50 },
        temperatures: [],
        disks: [],
        network: [],
      },
    });
    expect(fleet.summaries().get('local')).toBeNull();
    expect(fleet.summaries().get('pi')?.cpu).toBe(20);
    expect(fleet.summaries().has('laptop')).toBe(false);

    first.unsubscribe();
    second.unsubscribe();
    vi.advanceTimersByTime(60_000);
    http.expectNone('/api/devices/metrics');
  });

  it('keeps the values read before when a read fails', () => {
    TestBed.inject(DeviceService).devices.set([
      { id: 'local', name: '' },
      { id: 'pi', name: 'Pi' },
    ]);
    const fleet = TestBed.inject(FleetValues);
    const watching = fleet.watch.subscribe();
    vi.advanceTimersByTime(0);
    http.expectOne('/api/devices/metrics').flush({
      pi: {
        time: '2026-10-11T12:00:00Z',
        uptimeSeconds: 60,
        cpu: { usagePercent: 20, cores: 4 },
        memory: { totalBytes: 100, usedBytes: 50, usedPercent: 50 },
        temperatures: [],
        disks: [],
        network: [],
      },
    });

    vi.advanceTimersByTime(FLEET_REFRESH_MS);
    http.expectOne('/api/devices/metrics').flush('no', { status: 500, statusText: 'Server Error' });
    expect(fleet.summaries().get('pi')?.cpu).toBe(20);
    watching.unsubscribe();
  });
});
