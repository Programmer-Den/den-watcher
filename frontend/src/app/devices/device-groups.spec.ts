import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { EMPTY_LAYOUT } from '../dashboard/page-layout';
import { DeviceGroups, SHOWN_GROUP_STORAGE_KEY, cleanGroup } from './device-groups';
import { Device, DeviceService } from './devices';

const DEVICES: Device[] = [
  { id: 'local', name: '' },
  { id: 'nas', name: 'NAS' },
  { id: 'office-pc', name: 'Office PC', kind: 'pc' },
  { id: 'printer', name: 'Printer', checked: true },
];

describe('DeviceGroups', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  /** The groups with the devices on the list and the layout the host answers with `groups`. */
  function groupsWith(groups: Record<string, string>): DeviceGroups {
    TestBed.inject(DeviceService).devices.set(DEVICES);
    const service = TestBed.inject(DeviceGroups);
    TestBed.tick();
    http.expectOne('/api/layout').flush({ ...EMPTY_LAYOUT, groups });
    return service;
  }

  function ids(devices: Device[]): string[] {
    return devices.map((d) => d.id);
  }

  it('lists the groups of the devices on the list in alphabetical order, each once', () => {
    const groups = groupsWith({
      nas: 'Rack',
      'office-pc': 'Office',
      printer: 'Office',
      gone: 'Attic',
    });

    expect(groups.names()).toEqual(['Office', 'Rack']);
    expect(groups.groupOf(DEVICES[1])).toBe('Rack');
    expect(groups.groupOf(DEVICES[0])).toBe('');
  });

  it('shows every device until a group is picked, then only that group', () => {
    const groups = groupsWith({ nas: 'Rack', 'office-pc': 'Office', printer: 'Office' });
    expect(groups.shown()).toBeNull();
    expect(ids(groups.visible())).toEqual(['local', 'nas', 'office-pc', 'printer']);

    groups.show('Office');

    expect(groups.shown()).toBe('Office');
    expect(ids(groups.visible())).toEqual(['office-pc', 'printer']);
    expect(localStorage.getItem(SHOWN_GROUP_STORAGE_KEY)).toBe('Office');

    groups.show(null);

    expect(ids(groups.visible())).toEqual(['local', 'nas', 'office-pc', 'printer']);
    expect(localStorage.getItem(SHOWN_GROUP_STORAGE_KEY)).toBe('');
  });

  it('shows the group picked on the last visit', () => {
    localStorage.setItem(SHOWN_GROUP_STORAGE_KEY, 'Rack');

    const groups = groupsWith({ nas: 'Rack' });

    expect(ids(groups.visible())).toEqual(['nas']);
  });

  it('shows every device once the group picked has none left', () => {
    localStorage.setItem(SHOWN_GROUP_STORAGE_KEY, 'Attic');

    const groups = groupsWith({ nas: 'Rack' });

    expect(groups.shown()).toBeNull();
    expect(ids(groups.visible())).toEqual(['local', 'nas', 'office-pc', 'printer']);
  });

  it('keeps a device put in a group, or taken out of one, with the layout on the host', () => {
    const groups = groupsWith({ nas: 'Rack' });

    groups.setGroup(DEVICES[0], '  Living   room ');
    let sent = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/layout');
    expect(sent.request.body.groups).toEqual({ nas: 'Rack', local: 'Living room' });
    sent.flush(null);
    expect(groups.names()).toEqual(['Living room', 'Rack']);

    groups.setGroup(DEVICES[1], ' ');
    sent = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/layout');
    expect(sent.request.body.groups).toEqual({ local: 'Living room' });
    sent.flush(null);
  });

  it('sends nothing when the group a device has is typed again', () => {
    const groups = groupsWith({ nas: 'Rack' });

    groups.setGroup(DEVICES[1], 'Rack ');
    groups.setGroup(DEVICES[0], '');

    http.expectNone((r) => r.method === 'PUT');
  });
});

describe('cleanGroup', () => {
  it('takes away spaces around the name and runs of spaces in it', () => {
    expect(cleanGroup('  Living \t room\n')).toBe('Living room');
  });

  it('makes other spaces and control characters plain spaces and leaves out format characters', () => {
    expect(cleanGroup('Office A\u0007B​')).toBe('Office A B');
  });

  it('cuts a long name at a character to fit the host', () => {
    expect(cleanGroup('a'.repeat(70))).toBe('a'.repeat(64));
    expect(cleanGroup('ü'.repeat(40))).toBe('ü'.repeat(32));
  });
});
