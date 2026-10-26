import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, inject, isDevMode, signal } from '@angular/core';

/** The event Chromium-based browsers fire when the page can be installed as an app. */
export interface InstallPromptEvent extends Event {
  /** Shows the browser's dialog to install the page; only once per event. */
  prompt(): Promise<void>;
}

/** The window, with the offer to install the page that index.html keeps until the app starts. */
interface OfferWindow extends Window {
  installOffer?: InstallPromptEvent;
}

/**
 * The browser's service workers, or null where the page may not use them, and while developing,
 * where the files have no hashed names and change all the time; a token so tests can replace them.
 */
export const SERVICE_WORKERS = new InjectionToken<ServiceWorkerContainer | null>(
  'service workers',
  {
    factory: () => {
      const window = inject(DOCUMENT).defaultView;
      return (!isDevMode() && window?.isSecureContext && window.navigator.serviceWorker) || null;
    },
  },
);

/**
 * Makes the page an app the browser can install: it starts the service worker (sw.js), which
 * browsers allow only for a page opened over https or on localhost, and keeps the browser's offer
 * to install the page, which Chromium-based browsers make once the service worker runs. Safari
 * offers no such event; there the page is added with Share › Add to Home Screen.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private offer: InstallPromptEvent | null = null;

  /** Whether the browser offers to install the page, and it is not installed yet. */
  readonly available = signal(false);

  constructor() {
    const window = inject(DOCUMENT).defaultView as OfferWindow | null;
    inject(SERVICE_WORKERS)
      ?.register('sw.js')
      .catch(() => {
        // Without it the page works as before, only not offline and not as an app.
      });
    const offered = (event: Event) => {
      // The page offers it with its own button instead of the browser's bar.
      event.preventDefault();
      this.offer = event as InstallPromptEvent;
      this.available.set(true);
    };
    const installed = () => {
      this.offer = null;
      this.available.set(false);
    };
    // The browser may offer it before the app starts, on a slow device or with the page cached.
    if (window?.installOffer) {
      this.offer = window.installOffer;
      this.available.set(true);
      window.installOffer = undefined;
    }
    window?.addEventListener('beforeinstallprompt', offered);
    window?.addEventListener('appinstalled', installed);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('beforeinstallprompt', offered);
      window?.removeEventListener('appinstalled', installed);
    });
  }

  /** Asks the browser to install the page; it offers again later when this one is dismissed. */
  async install(): Promise<void> {
    const offer = this.offer;
    this.offer = null;
    this.available.set(false);
    await offer?.prompt();
  }
}
