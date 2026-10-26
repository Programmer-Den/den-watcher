import { WiFiAccessPoint, WiFiHistory, WiFiPoint } from '../app/compare/wifi';
import { drift } from './fleet';

/** One radio of a router near the demo's house, and the signal each device hears it at. */
interface DemoRadio {
  id: string;
  box: string;
  ssid?: string;
  mhz: number;
  width: number;
  security: string;
  generation?: number;
  /** The signal each device hears it at, in percent, by device id. */
  signals: Record<string, number>;
  /** The devices connected to it. */
  connected?: string[];
  /** The hours ago it was first and last heard, where it was not there all day. */
  from?: number;
  until?: number;
  /** The frequency it sent on before, up to the hour moved hours ago, where it moved. */
  before?: { mhz: number; moved: number };
}

const HUB = 'local';
const LAPTOP = 'windows-laptop';
const SHED = 'linux-laptop';
const PHONE = 'android-phone';

/**
 * The radios around the house: Den's three mesh routers, each with a 5 GHz and a 2.4 GHz radio
 * (the first also sends Den-Guest), the neighbours' networks, a printer, and two that only one
 * device hears, a camera at the garden shed and a phone's hotspot next to the laptop. Over the day
 * the first router moved its 2.4 GHz radio from channel 1 to 6, a neighbour's network appeared and
 * another one went, and an open copy of Den was near the Windows laptop for an hour.
 */
const RADIOS: DemoRadio[] = [
  {
    id: 'a1c4e2f00b51',
    box: '5d0e1f2a3b4c',
    ssid: 'Den',
    mhz: 5180,
    width: 80,
    security: 'WPA2/WPA3',
    generation: 6,
    signals: { [LAPTOP]: 98, [PHONE]: 91 },
    connected: [LAPTOP, PHONE],
  },
  {
    id: 'a1c4e2f00b50',
    box: '5d0e1f2a3b4c',
    ssid: 'Den',
    mhz: 2437,
    width: 20,
    security: 'WPA2/WPA3',
    generation: 6,
    signals: { [HUB]: 64, [LAPTOP]: 82, [PHONE]: 76, [SHED]: 18 },
    connected: [HUB],
    before: { mhz: 2412, moved: 9 },
  },
  {
    id: 'a1c4e2f00b52',
    box: '5d0e1f2a3b4c',
    ssid: 'Den-Guest',
    mhz: 2437,
    width: 20,
    security: 'WPA2',
    generation: 6,
    signals: { [HUB]: 58, [LAPTOP]: 90, [PHONE]: 84, [SHED]: 22 },
    before: { mhz: 2412, moved: 9 },
  },
  {
    id: 'b7e09c3d11a0',
    box: '6e1f2a3b4c5d',
    ssid: 'Den',
    mhz: 5500,
    width: 80,
    security: 'WPA2/WPA3',
    generation: 6,
    signals: { [HUB]: 41, [LAPTOP]: 55, [PHONE]: 49 },
  },
  {
    id: 'c2f81d4e22b0',
    box: '7f2a3b4c5d6e',
    ssid: 'Den',
    mhz: 2462,
    width: 20,
    security: 'WPA2/WPA3',
    generation: 6,
    signals: { [SHED]: 28, [HUB]: 15 },
    connected: [SHED],
  },
  {
    id: 'd3a92e5f33c0',
    box: '8a3b4c5d6e7f',
    ssid: 'FRITZ!Box 7590 KL',
    mhz: 5500,
    width: 80,
    security: 'WPA2',
    generation: 5,
    signals: { [HUB]: 34, [LAPTOP]: 58, [PHONE]: 52, [SHED]: 61 },
  },
  {
    id: 'e4b03f6044d0',
    box: '9b4c5d6e7f8a',
    ssid: 'Telekom-8C21F0',
    mhz: 6115,
    width: 160,
    security: 'WPA3',
    generation: 6,
    signals: { [HUB]: 22, [LAPTOP]: 46, [PHONE]: 41, [SHED]: 70 },
  },
  {
    id: 'f5c1407155e0',
    box: 'ac5d6e7f8a9b',
    ssid: 'Vodafone Hotspot',
    mhz: 2462,
    width: 20,
    security: 'Open',
    signals: { [HUB]: 28, [LAPTOP]: 34, [PHONE]: 30, [SHED]: 55 },
  },
  {
    id: '06d2518266f0',
    box: 'bd6e7f8a9bac',
    ssid: 'DIRECT-4A-HP LaserJet',
    mhz: 2437,
    width: 20,
    security: 'WPA2',
    generation: 4,
    signals: { [HUB]: 46, [LAPTOP]: 31, [PHONE]: 35 },
  },
  {
    id: '17e3629377a0',
    box: 'ce7f8a9bacbd',
    ssid: 'Garden-Cam',
    mhz: 2462,
    width: 20,
    security: 'WPA2',
    generation: 4,
    signals: { [SHED]: 76 },
  },
  {
    id: '28f473a488b0',
    box: 'df8a9bacbdce',
    ssid: 'AndroidAP_7781',
    mhz: 2437,
    width: 20,
    security: 'WPA2',
    generation: 5,
    signals: { [LAPTOP]: 40 },
  },
  {
    id: '39a584b599c0',
    box: 'e09bacbdcedf',
    mhz: 5745,
    width: 80,
    security: 'WPA2',
    signals: { [HUB]: 30 },
  },
  {
    id: '4ab695c6aad0',
    box: 'f1acbdcedfe0',
    ssid: 'Den',
    mhz: 2462,
    width: 20,
    security: 'Open',
    signals: { [LAPTOP]: 62 },
    from: 5,
    until: 5,
  },
  {
    id: '5bc7a6d7bbe0',
    box: '02bcdef01a2b',
    ssid: 'o2-WLAN-4F2C',
    mhz: 2412,
    width: 20,
    security: 'WPA2',
    generation: 5,
    signals: { [SHED]: 41, [HUB]: 38 },
    from: 8,
  },
  {
    id: '6cd8b7e8ccf0',
    box: '13cdef01a2b3',
    ssid: 'EasyBox-23A1',
    mhz: 5260,
    width: 80,
    security: 'WPA2',
    generation: 5,
    signals: { [HUB]: 33, [LAPTOP]: 31 },
    until: 14,
  },
];

/** Devices that tell the signal in dBm too: Windows does, NetworkManager and Android do not here. */
const DBM: readonly string[] = [LAPTOP];

/** Readings of a device's Wi-Fi in an hour: one every 5 seconds, as the recorders read. */
const READINGS = 720;

/**
 * Whether a device's Wi-Fi was read in the hour hoursAgo: the phone was away three and four hours
 * ago, and the laptop at the shed switched off overnight.
 */
function read(device: string, hoursAgo: number): boolean {
  if (device === PHONE) return hoursAgo !== 3 && hoursAgo !== 4;
  if (device === SHED) return hoursAgo < 10 || hoursAgo > 17;
  return true;
}

/**
 * Where a device is in the hour hoursAgo, as the device whose spot it hears the networks from:
 * the Windows laptop was carried to the garden shed six to eight hours ago.
 */
function spot(device: string, hoursAgo: number): string {
  return device === LAPTOP && hoursAgo >= 6 && hoursAgo <= 8 ? SHED : device;
}

/** What GET /api/wifi answers in the demo, from `from` to `to` in Unix seconds, as a hub keeps it. */
export function demoWifi(from: number, to: number): WiFiHistory {
  const step = Math.max(1, Math.ceil((to - from) / 200 / 3600)) * 3600;
  const now = Math.floor(to / 3600) * 3600;
  const devices = [HUB, LAPTOP, SHED, PHONE];
  const times: number[] = [];
  for (let t = Math.floor(from / step) * step; t < to; t += step) {
    times.push(t);
  }
  const hoursAgo = (t: number) => Math.round((now - t) / 3600);
  const accessPoints: WiFiAccessPoint[] = RADIOS.map((radio, r) => {
    const seenBy = devices.flatMap((device, d) => {
      const points = times.flatMap((time): WiFiPoint[] => {
        const at = spot(device, hoursAgo(time));
        const base = radio.signals[at];
        const ago = hoursAgo(time);
        if (base === undefined || !read(device, ago)) return [];
        if (ago > (radio.from ?? Infinity) || ago < (radio.until ?? -Infinity)) return [];
        const seed = r * 31 + d * 7;
        // A weak network drops out now and then.
        if (base < 30 && drift(time, 7200, seed + 500) > 0.6) return [];
        const signal = Math.min(100, Math.max(1, base + 6 * drift(time, 5400, seed)));
        const seen = READINGS * (step / 3600);
        return [
          {
            time,
            seen,
            connected: radio.connected?.includes(at) ? seen : undefined,
            signalPercent: signal,
            minPercent: Math.max(1, signal - 5),
            maxPercent: Math.min(100, signal + 5),
            signalDBm: DBM.includes(device) ? signal / 2 - 100 : undefined,
            frequencyMHz: radio.before && ago > radio.before.moved ? radio.before.mhz : radio.mhz,
          },
        ];
      });
      return points.length > 0 ? [{ device, points }] : [];
    });
    const seen = seenBy.flatMap((s) => s.points.map((p) => p.time));
    return {
      id: radio.id,
      box: radio.box,
      ssid: radio.ssid,
      frequencyMHz: radio.mhz,
      widthMHz: radio.width,
      security: radio.security,
      generation: radio.generation,
      firstSeen: Math.min(...seen),
      lastSeen: Math.max(...seen),
      seenBy,
    };
  }).filter((ap) => ap.seenBy.length > 0);
  return {
    from,
    to,
    stepSeconds: step,
    devices: devices.map((device) => ({
      device,
      steps: times
        .filter((t) => read(device, hoursAgo(t)))
        .map((time) => ({ time, readings: READINGS * (step / 3600) })),
    })),
    accessPoints,
  };
}
