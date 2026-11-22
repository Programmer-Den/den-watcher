import { Health } from '../app/devices/devices';

/**
 * What GET /api/devices/health answers in the demo: one of each kind, so the Devices dialog shows
 * its list. The NAS runs an older release, an add-on on the Linux desktop stopped, the Windows
 * server's clock is five minutes behind and the garage Pi waits for its pairing code, as the
 * list of devices tells.
 */
export function demoHealth(version: string): Health {
  return {
    // A build of main is not compared on a hub; the demo names a release then, so the list shows.
    version: /^\d/.test(version) ? version : '3.10.2',
    problems: [
      { device: 'linux-nas', kind: 'version', detail: '3.8.4' },
      { device: 'linux-desktop', kind: 'addOn', detail: 'gpu' },
      { device: 'windows-server', kind: 'clock', seconds: -312 },
      { device: 'garage-pi', kind: 'pairing', detail: 'needed' },
    ],
  };
}
