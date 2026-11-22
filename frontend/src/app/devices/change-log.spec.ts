import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Change, ChangeLog } from './change-log';
import { DeviceService } from './devices';

describe('ChangeLog', () => {
  let fixture: ComponentFixture<ChangeLog>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChangeLog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(DeviceService).devices.set([{ id: 'office-pc', name: 'Office PC' }]);
    fixture = TestBed.createComponent(ChangeLog);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function open(): HTMLElement {
    const element = fixture.nativeElement as HTMLElement;
    const details = element.querySelector('details')!;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    return element;
  }

  it('reads the changes only once it is opened, and tells each with its device and address', () => {
    const element = fixture.nativeElement as HTMLElement;
    http.expectNone('/api/changes');
    open();
    const changes: Change[] = [
      {
        time: 1_700_000_200,
        address: '192.168.1.23',
        action: 'wrongPassword',
        device: 'office-pc',
      },
      {
        time: 1_700_000_100,
        address: '192.168.1.20',
        action: 'kind',
        device: 'office-pc',
        detail: 'pc',
      },
      {
        time: 1_700_000_050,
        address: '192.168.1.20',
        action: 'remove',
        device: 'old-pi',
        detail: 'keepHistory',
      },
      { time: 1_700_000_000, address: '192.168.1.20', action: 'add', detail: 'Office PC' },
      { time: 1_699_999_990, address: '192.168.1.20', action: 'backup' },
    ];
    http.expectOne('/api/changes').flush({ changes });
    fixture.detectChanges();
    const items = [...element.querySelectorAll('li')].map((li) => li.textContent ?? '');
    expect(items.length).toBe(5);
    expect(items[0]).toContain('Tried a wrong password for Office PC');
    expect(items[0]).toContain('from 192.168.1.23');
    expect(element.querySelector('li')!.classList).toContain('wrong');
    expect(items[1]).toContain('Made Office PC a PC / laptop');
    // A removed device is no longer listed, so its id stands in for its name.
    expect(items[2]).toContain('Removed old-pi, keeping its history');
    expect(items[3]).toContain('Added Office PC');
    expect(items[4]).toContain('Downloaded a backup');
  });

  it('says so when there are none, or they cannot be read', () => {
    const element = open();
    http.expectOne('/api/changes').flush({ changes: [] });
    fixture.detectChanges();
    expect(element.textContent).toContain('Nothing has been changed yet.');

    open();
    http.expectOne('/api/changes').flush('', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(element.textContent).toContain('The changes could not be read.');
  });
});
