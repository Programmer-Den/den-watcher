import { TestBed } from '@angular/core/testing';

import { InstallButton } from './install-button';
import { InstallPromptEvent, InstallService, SERVICE_WORKERS } from './install';

/** The event the browser fires when it offers to install the page, counting its prompts. */
function offer(): InstallPromptEvent & { prompts: number } {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as InstallPromptEvent & {
    prompts: number;
  };
  event.prompts = 0;
  event.prompt = () => {
    event.prompts++;
    return Promise.resolve();
  };
  return event;
}

describe('InstallService', () => {
  it('starts the service worker where the browser allows one', () => {
    const registered: string[] = [];
    const workers = {
      register: (url: string) => {
        registered.push(url);
        return Promise.reject(new Error('not allowed'));
      },
    } as unknown as ServiceWorkerContainer;
    TestBed.configureTestingModule({
      providers: [{ provide: SERVICE_WORKERS, useValue: workers }],
    });

    TestBed.inject(InstallService);

    expect(registered).toEqual(['sw.js']);
  });

  it('keeps the offer to install until it is used or the page is installed', async () => {
    const install = TestBed.inject(InstallService);
    expect(install.available()).toBe(false);

    const first = offer();
    window.dispatchEvent(first);
    expect(first.defaultPrevented).toBe(true);
    expect(install.available()).toBe(true);

    await install.install();
    expect(first.prompts).toBe(1);
    expect(install.available()).toBe(false);
    await install.install();
    expect(first.prompts).toBe(1);

    window.dispatchEvent(offer());
    expect(install.available()).toBe(true);
    window.dispatchEvent(new Event('appinstalled'));
    expect(install.available()).toBe(false);
  });

  it('takes the offer index.html kept from before the app started', async () => {
    const early = offer();
    const page = window as Window & { installOffer?: InstallPromptEvent };
    page.installOffer = early;

    const install = TestBed.inject(InstallService);

    expect(install.available()).toBe(true);
    expect(page.installOffer).toBeUndefined();
    await install.install();
    expect(early.prompts).toBe(1);
  });
});

describe('InstallButton', () => {
  it('shows only while the browser offers to install the page', async () => {
    const fixture = TestBed.createComponent(InstallButton);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('button')).toBeNull();

    const event = offer();
    window.dispatchEvent(event);
    fixture.detectChanges();
    const button = element.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Install as an app');

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(event.prompts).toBe(1);
    expect(element.querySelector('button')).toBeNull();
  });
});
