import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { DevicesDialog } from './devices-dialog';
import { DeviceService, Suggestion } from './devices';
import { PasswordDialogResult } from './password-dialog';

describe('DevicesDialog', () => {
  let fixture: ComponentFixture<DevicesDialog>;
  let http: HttpTestingController;
  let answer: PasswordDialogResult | undefined;

  beforeEach(() => {
    answer = { password: 'correct horse', keepHistory: false };
    TestBed.configureTestingModule({
      imports: [DevicesDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockImplementation(
      () => ({ afterClosed: () => of(answer) }) as unknown as MatDialogRef<unknown>,
    );
    TestBed.inject(DeviceService).devices.set([
      { id: 'local', name: '' },
      { id: 'pi', name: 'Pi', address: '192.168.1.20:9393', kind: 'server', removable: false },
      {
        id: 'office-pc',
        name: 'Office PC',
        address: '192.168.1.30:9393',
        kind: 'server',
        removable: true,
      },
    ]);
    fixture = TestBed.createComponent(DevicesDialog);
    fixture.detectChanges();
  });

  /** Answers the dialog's question which device the page is open on. */
  async function suggest(suggestion: Suggestion | null): Promise<void> {
    http.expectOne('/api/devices/suggestion').flush(suggestion);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function input(name: string): HTMLInputElement {
    return element().querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  }

  afterEach(() => {
    // Tests that do not look at the suggestion leave it unanswered.
    http.match('/api/devices/suggestion').forEach((r) => r.flush(null));
    // Tests that do not look at this device's own pairing code leave it unanswered.
    http
      .match('/api/pairing')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush({ code: '' }));
    // Tests that do not look at the status page leave it unanswered, as a hub without one.
    http
      .match('/api/status-page')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush({ enabled: false, passwordSet: false }));
    // The marks of the charts are read alongside the history; these tests leave them unanswered.
    http.match((r) => r.url === '/api/events');
    http.verify();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function type(name: string, value: string): Promise<void> {
    const input = element().querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const buttons = Array.from(element().querySelectorAll('button'));
    return buttons.find((b) => b.textContent?.trim() === label)!;
  }

  /** The button that picks a kind in the form to add a device. */
  function formKind(label: string): HTMLButtonElement {
    const buttons = Array.from(element().querySelectorAll('form .kind button'));
    return buttons.find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
  }

  it('fills in the device the page is open on', async () => {
    await suggest({ address: '192.168.1.47:9393', name: 'Kitchen tablet', kind: 'pc' });

    expect(input('name').value).toBe('Kitchen tablet');
    expect(input('address').value).toBe('192.168.1.47:9393');
    expect(formKind('PC / laptop').getAttribute('aria-pressed')).toBe('true');
    expect(element().textContent).toContain('Filled in with the device this page is open on.');

    formKind('Phone').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(formKind('Phone').getAttribute('aria-pressed')).toBe('true');
    expect(element().textContent).not.toContain('Filled in with the device');
    formKind('PC / laptop').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element().textContent).toContain('Filled in with the device this page is open on.');

    await type('address', '192.168.1.48:9393');
    expect(element().textContent).not.toContain('Filled in with the device');
  });

  it('keeps what was typed before the suggestion arrives', async () => {
    await type('name', 'Laptop');
    await suggest({ address: '192.168.1.47:9393', name: 'Kitchen tablet', kind: 'pc' });

    expect(input('name').value).toBe('Laptop');
    expect(input('address').value).toBe('');
  });

  it('leaves the form empty without a suggestion', async () => {
    await suggest(null);

    expect(input('name').value).toBe('');
    expect(input('address').value).toBe('');
    expect(element().textContent).not.toContain('Filled in with the device');
  });

  it('lists the other devices and which can be removed', () => {
    expect(element().textContent).toContain('Pi');
    expect(element().textContent).toContain('Set in .env');
    expect(element().textContent).toContain('192.168.1.30:9393');
    expect(element().querySelectorAll('li > button')).toHaveLength(1);
  });

  it('names a router as one instead of offering a kind', () => {
    const devices = TestBed.inject(DeviceService);
    devices.devices.set([
      ...devices.devices(),
      { id: 'router', name: 'Router', address: '192.168.1.1', kind: 'server', router: true },
    ]);
    fixture.detectChanges();

    const items = Array.from(element().querySelectorAll('ul > li'));
    const router = items.find((li) => li.textContent?.includes('192.168.1.1'))!;
    expect(router.querySelector('.router')?.textContent?.trim()).toBe('Router');
    expect(router.querySelector('.kind')).toBeNull();
    expect(router.textContent).toContain('Set in .env');
  });

  it('adds a device with the password and reads the list again', async () => {
    await type('name', 'Laptop');
    await type('address', '192.168.1.40:9393');
    formKind('PC / laptop').click();
    fixture.detectChanges();
    button('Add').click();

    const add = http.expectOne('/api/devices');
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({
      name: 'Laptop',
      address: '192.168.1.40:9393',
      kind: 'pc',
      code: '',
      password: 'correct horse',
    });
    add.flush(
      { id: 'laptop', name: 'Laptop', removable: true },
      { status: 201, statusText: 'Created' },
    );
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(DeviceService).passwordSet()).toBe(true);
    expect((element().querySelector('input[name="name"]') as HTMLInputElement).value).toBe('');
  });

  it('adds a phone with the code its app shows and without an address', async () => {
    formKind('Phone').click();
    fixture.detectChanges();
    expect(input('address')).toBeNull();
    expect(element().textContent).toContain("enter this hub's address in the app");
    await type('name', 'Pixel');
    expect(button('Add').disabled).toBe(true);
    await type('code', '7KQM-X2RP');
    button('Add').click();

    const add = http.expectOne('/api/phones');
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({
      name: 'Pixel',
      code: '7KQM-X2RP',
      password: 'correct horse',
    });
    add.flush(
      { id: 'pixel', name: 'Pixel', kind: 'phone', removable: true },
      { status: 201, statusText: 'Created' },
    );
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(input('code').value).toBe('');
    expect(input('address')).not.toBeNull();
  });

  it('adds a device with the pairing code it shows', async () => {
    await type('name', 'Laptop');
    await type('address', '192.168.1.40:9393');
    await type('code', ' 7KQM-X2RP ');
    button('Add').click();

    const add = http.expectOne('/api/devices');
    expect(add.request.body).toEqual({
      name: 'Laptop',
      address: '192.168.1.40:9393',
      kind: 'server',
      code: '7KQM-X2RP',
      password: 'correct horse',
    });
    add.flush(
      { id: 'laptop', name: 'Laptop', removable: true },
      { status: 201, statusText: 'Created' },
    );
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input('code').value).toBe('');
  });

  it('explains a device that asks for its pairing code', async () => {
    await type('name', 'Laptop');
    await type('address', '192.168.1.40:9393');
    button('Add').click();

    http
      .expectOne('/api/devices')
      .flush(
        { problem: 'pairingNeeded', message: 'the device asks for its pairing code' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
    fixture.detectChanges();

    expect(element().querySelector('.error')?.textContent).toContain(
      'The device asks for its pairing code.',
    );
  });

  it('gives a listed device that waits for one its pairing code', async () => {
    TestBed.inject(DeviceService).devices.update((devices) => [
      ...devices,
      {
        id: 'nas',
        name: 'NAS',
        address: '192.168.1.6:9393',
        kind: 'server',
        removable: true,
        unreachable: true,
        pairing: 'wrong',
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const nas = element().querySelectorAll('li')[2];
    expect(nas.textContent).toContain("The pairing code is not this device's");

    await type('device-code', '7kqm-x2rp');
    nas.querySelector<HTMLButtonElement>('form.pairing button')!.click();

    const change = http.expectOne('/api/devices/nas/pairing');
    expect(change.request.method).toBe('PUT');
    expect(change.request.body).toEqual({ code: '7kqm-x2rp', password: 'correct horse' });
    change.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it("shows this device's own pairing code", async () => {
    http.expectOne('/api/pairing').flush({ code: '7KQM-X2RP' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element().querySelector('.own-code')?.textContent?.trim()).toBe('7KQM-X2RP');
    expect(element().textContent).toContain("This device's pairing code");
  });

  it('shows no pairing code when the backend keeps none', () => {
    http.expectOne('/api/pairing').flush('404 page not found', {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();

    expect(element().querySelector('.own-code')).toBeNull();
  });

  it('leaves out the status page when the hub has none', async () => {
    http.expectOne('/api/status-page').flush({ enabled: false, passwordSet: false });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element().querySelector('form.status-page')).toBeNull();
  });

  it("sets the status page's password with the password for changing devices", async () => {
    http.expectOne('/api/status-page').flush({
      enabled: true,
      port: '9443',
      fingerprint: 'AB:CD',
      passwordSet: false,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element().textContent).toContain('A minimal page on port 9443');
    expect(element().querySelector('.fingerprint')?.textContent).toBe('AB:CD');
    expect(element().textContent).toContain('No password is set yet');
    expect(button('Set password').disabled).toBe(true);

    await type('status-password', 'remote password');
    await type('status-repeated', 'remote passwort');
    expect(element().textContent).toContain('The passwords are not the same');
    expect(button('Set password').disabled).toBe(true);
    await type('status-repeated', 'remote password');
    button('Set password').click();

    const change = http.expectOne('/api/status-page/password');
    expect(change.request.method).toBe('POST');
    expect(change.request.body).toEqual({
      password: 'correct horse',
      newPassword: 'remote password',
    });
    change.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
    http
      .expectOne('/api/status-page')
      .flush({ enabled: true, port: '9443', fingerprint: 'AB:CD', passwordSet: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element().textContent).toContain('The password of the status page is set.');
    expect(input('status-password').value).toBe('');
    expect(button('Change password')).toBeDefined();
  });

  it('counts a change as done when the list cannot be read afterwards', async () => {
    await type('name', 'Laptop');
    await type('address', '192.168.1.40:9393');
    button('Add').click();

    http
      .expectOne('/api/devices')
      .flush(
        { id: 'laptop', name: 'Laptop', removable: true },
        { status: 201, statusText: 'Created' },
      );
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush('down', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element().querySelector('.error')).toBeNull();
    expect((element().querySelector('input[name="name"]') as HTMLInputElement).value).toBe('');
    expect(button('Remove').disabled).toBe(false);
  });

  it('downloads a backup with the password, under the name the hub gave it', async () => {
    const createObjectURL = vi.fn(() => 'blob:backup');
    const { createObjectURL: create, revokeObjectURL: revoke } = URL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    expect(element().textContent).toContain('Router passwords are not in it.');

    button('Download backup').click();

    const backup = http.expectOne('/api/backup');
    expect(backup.request.method).toBe('POST');
    expect(backup.request.body).toEqual({ password: 'correct horse' });
    const file = new Blob(['SQLite format 3']);
    backup.flush(file, {
      headers: { 'Content-Disposition': 'attachment; filename="den-watcher-2026-10-13.db"' },
    });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
    await fixture.whenStable();

    expect(createObjectURL).toHaveBeenCalledWith(file);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('den-watcher-2026-10-13.db');
    expect(link.href).toBe('blob:backup');
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    click.mockRestore();
  });

  it('says why a backup was refused, from the problem in its answer', async () => {
    button('Download backup').click();

    http.expectOne('/api/backup').flush(new Blob([JSON.stringify({ problem: 'wrongPassword' })]), {
      status: 403,
      statusText: 'Forbidden',
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element().textContent).toContain('The password is wrong.');
    });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it('says when the password is wrong', () => {
    button('Remove').click();

    const remove = http.expectOne('/api/devices/office-pc');
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ problem: 'wrongPassword' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(element().textContent).toContain('The password is wrong.');
    // A change that failed may still have been made, so the list is read again.
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it('lets a failed change be tried again while the list is read again', () => {
    button('Remove').click();

    http
      .expectOne('/api/devices/office-pc')
      .flush('down', { status: 504, statusText: 'Gateway Timeout' });
    fixture.detectChanges();

    expect(button('Remove').disabled).toBe(false);
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it('keeps a new change busy when an earlier failed change reads the list late', () => {
    button('Remove').click();
    http
      .expectOne('/api/devices/office-pc')
      .flush('down', { status: 504, statusText: 'Gateway Timeout' });
    fixture.detectChanges();
    const staleReload = http.expectOne((r) => r.method === 'GET' && r.url === '/api/devices');

    button('Remove').click();
    fixture.detectChanges();

    // The new change stops the failed change's reading of the list.
    expect(staleReload.cancelled).toBe(true);
    expect(button('Remove').disabled).toBe(true);
    http.expectOne('/api/devices/office-pc').flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it('stops reading the list once the dialog is closed', async () => {
    await suggest(null);
    button('Remove').click();
    http
      .expectOne('/api/devices/office-pc')
      .flush('down', { status: 504, statusText: 'Gateway Timeout' });
    const reload = http.expectOne((r) => r.method === 'GET' && r.url === '/api/devices');

    fixture.destroy();

    expect(reload.cancelled).toBe(true);
  });

  it('finishes a change once the dialog is closed, without reading the list', async () => {
    await suggest(null);
    button('Remove').click();
    const remove = http.expectOne('/api/devices/office-pc');

    fixture.destroy();

    expect(remove.cancelled).toBe(false);
    remove.flush(null, { status: 204, statusText: 'No Content' });
    http.expectNone((r) => r.method === 'GET' && r.url === '/api/devices');
  });

  it("says when the address is the hub's own", async () => {
    await type('name', 'Laptop');
    await type('address', '127.0.0.1:9393');
    button('Add').click();

    http
      .expectOne('/api/devices')
      .flush({ problem: 'addressOwn' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(element().textContent).toContain('This address is the hub itself.');
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it('says when the device does not answer to the name it was added by', async () => {
    await type('name', 'Pi');
    await type('address', 'raspberrypi:9393');
    button('Add').click();

    http
      .expectOne('/api/devices')
      .flush({ problem: 'hostUnknown' }, { status: 422, statusText: 'Unprocessable Entity' });
    fixture.detectChanges();

    expect(element().textContent).toContain("The device doesn't answer to this name");
    expect(element().textContent).toContain('ALLOWED_HOSTS');
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it('changes nothing when the password dialog is cancelled', () => {
    answer = undefined;

    button('Remove').click();

    http.expectNone('/api/devices/office-pc');
  });

  it('changes the kind of a listed device with the password', () => {
    const pi = element().querySelectorAll('li')[0];
    const pc = Array.from(pi.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'PC / laptop',
    )!;
    expect(pc.getAttribute('aria-pressed')).toBe('false');

    pc.click();

    const change = http.expectOne('/api/devices/pi/kind');
    expect(change.request.method).toBe('PUT');
    expect(change.request.body).toEqual({ kind: 'pc', password: 'correct horse' });
    change.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/devices')
      .flush({ devices: [{ id: 'local', name: '' }], passwordSet: true });
  });

  it('asks nothing when the kind the device has is picked again', () => {
    const pi = element().querySelectorAll('li')[0];
    Array.from(pi.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Server / IoT')!
      .click();

    http.expectNone('/api/devices/pi/kind');
  });

  /** Leaves the list room for all its devices, or squeezes it to a row, and renders again. */
  async function overflow(squeezed: boolean): Promise<void> {
    const ul = element().querySelector('ul')!;
    Object.defineProperty(ul, 'scrollHeight', { configurable: true, value: 160 });
    Object.defineProperty(ul, 'clientHeight', {
      configurable: true,
      value: squeezed ? 40 : 160,
    });
    const devices = TestBed.inject(DeviceService).devices;
    devices.set([...devices()]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function list(): HTMLUListElement {
    return element().querySelector('ul')!;
  }

  it('shows the list while it has room for its devices', async () => {
    await overflow(false);

    expect(button('Added devices 2').getAttribute('aria-expanded')).toBe('true');
    expect(list().hidden).toBe(false);
  });

  it('folds the list away when the dialog leaves it too little room', async () => {
    await overflow(true);

    expect(button('Added devices 2').getAttribute('aria-expanded')).toBe('false');
    expect(list().hidden).toBe(true);
  });

  it('folds the list away when it is lower than a device row', async () => {
    Object.defineProperty(list().querySelector('li')!, 'offsetHeight', {
      configurable: true,
      value: 120,
    });
    const ul = list();
    Object.defineProperty(ul, 'scrollHeight', { configurable: true, value: 240 });
    Object.defineProperty(ul, 'clientHeight', { configurable: true, value: 100 });
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(list().hidden).toBe(true);
  });

  it('keeps a list unfolded by hand open', async () => {
    await overflow(true);
    button('Added devices 2').click();
    fixture.detectChanges();
    await overflow(true);

    expect(button('Added devices 2').getAttribute('aria-expanded')).toBe('true');
    expect(list().hidden).toBe(false);
  });

  it('has no fold without other devices', async () => {
    TestBed.inject(DeviceService).devices.set([{ id: 'local', name: '' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element().querySelector('.fold')).toBeNull();
    expect(list().textContent).toContain('No other devices yet.');
  });
});
