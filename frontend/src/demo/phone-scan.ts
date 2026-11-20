import { PhoneScanAnswer, RoutePoint, ScannedNetwork } from '../app/metrics/metrics';
import { drift } from './fleet';
import { demoPhoneRoute } from './phone-route';
import { demoPhoneWifi } from './phone-wifi';

/** How often the demo phone scans, in seconds, as its app does. */
const SCAN_EVERY = 5 * 60;

/** A network the demo phone hears at a place, at about `signal` percent. */
type Heard = Omit<ScannedNetwork, 'signalPercent' | 'connected'> & { signal: number };

const SECURE = 'WPA2/WPA3';

/** What the phone hears at each place it connects to, by the name of the network it connects to there. */
const AT: Record<string, Heard[]> = {
  Den: [
    { ssid: 'Den', signal: 90, frequencyMHz: 5180, security: SECURE, generation: 6 },
    { ssid: 'Den', signal: 76, frequencyMHz: 2437, security: SECURE, generation: 6 },
    { ssid: 'Den-Guest', signal: 72, frequencyMHz: 2437, security: 'WPA2', generation: 6 },
    { ssid: 'FRITZ!Box 7590 KL', signal: 44, frequencyMHz: 2462, security: 'WPA2', generation: 5 },
    { ssid: 'o2-WLAN-4F2C', signal: 31, frequencyMHz: 5500, security: 'WPA2', generation: 5 },
    {
      ssid: 'DIRECT-4A-HP LaserJet',
      signal: 38,
      frequencyMHz: 2412,
      security: 'WPA2',
      generation: 4,
    },
    { id: '3c:a6:2f:41:7e:08', signal: 22, frequencyMHz: 2412, security: 'WPA2', generation: 4 },
  ],
  Office: [
    { ssid: 'Office', signal: 84, frequencyMHz: 5240, security: 'WPA2 Enterprise', generation: 6 },
    { ssid: 'Office', signal: 70, frequencyMHz: 2462, security: 'WPA2 Enterprise', generation: 6 },
    { ssid: 'Office-Guest', signal: 68, frequencyMHz: 5240, security: 'Open', generation: 6 },
    { ssid: 'DIRECT-7B-Canon MF', signal: 41, frequencyMHz: 2437, security: 'WPA2', generation: 4 },
    { ssid: 'Vodafone Hotspot', signal: 26, frequencyMHz: 2412, security: 'Open', generation: 5 },
    { id: '00:1a:1e:52:c4:90', signal: 33, frequencyMHz: 5745, security: 'WPA2', generation: 5 },
  ],
  'Vodafone Hotspot': [
    { ssid: 'Vodafone Hotspot', signal: 74, frequencyMHz: 2412, security: 'Open', generation: 5 },
    { ssid: 'Cafe Elbblick', signal: 61, frequencyMHz: 5200, security: 'WPA2', generation: 6 },
    { ssid: 'Office-Guest', signal: 24, frequencyMHz: 5240, security: 'Open', generation: 6 },
    { ssid: 'EasyBox-23A1', signal: 35, frequencyMHz: 2452, security: 'WPA2', generation: 4 },
  ],
  'Telekom-8C21F0': [
    { ssid: 'Telekom-8C21F0', signal: 79, frequencyMHz: 5560, security: SECURE, generation: 6 },
    { ssid: 'Telekom-8C21F0', signal: 66, frequencyMHz: 2427, security: SECURE, generation: 6 },
    { ssid: 'Bakery Guests', signal: 48, frequencyMHz: 2462, security: 'Open', generation: 5 },
    { ssid: 'WLAN-482913', signal: 29, frequencyMHz: 2437, security: 'WPA2', generation: 4 },
    { id: 'e8:df:70:93:2b:5c', signal: 18, frequencyMHz: 5180, security: 'WPA2', generation: 5 },
  ],
};

/** A network along the streets, heard within `meters` of where its access point is. */
type StreetNetwork = Heard & { lat: number; lon: number; meters: number };

/**
 * Networks along the streets between the places, each heard only near its access point, the
 * better the closer; the city's Wi-Fi is heard all over town.
 */
const STREET: StreetNetwork[] = [
  {
    ssid: 'FRITZ!Box 6660 Cable QW',
    signal: 58,
    frequencyMHz: 2437,
    security: SECURE,
    generation: 6,
    lat: 53.57,
    lon: 9.9532,
    meters: 260,
  },
  {
    ssid: 'Vodafone-7C3A',
    signal: 50,
    frequencyMHz: 2412,
    security: 'WPA2',
    generation: 5,
    lat: 53.5655,
    lon: 9.953,
    meters: 220,
  },
  {
    ssid: 'o2-WLAN-91D4',
    signal: 62,
    frequencyMHz: 5180,
    security: 'WPA2',
    generation: 5,
    lat: 53.5533,
    lon: 9.968,
    meters: 300,
  },
  {
    ssid: 'WLAN-55A0B1',
    signal: 44,
    frequencyMHz: 2462,
    security: 'WPA2',
    generation: 4,
    lat: 53.5531,
    lon: 9.986,
    meters: 240,
  },
  {
    ssid: 'Pizzeria Roma',
    signal: 54,
    frequencyMHz: 2427,
    security: 'WPA2',
    generation: 4,
    lat: 53.5612,
    lon: 9.9575,
    meters: 220,
  },
  {
    id: 'a6:3e:51:0c:9d:12',
    signal: 36,
    frequencyMHz: 2412,
    security: 'WPA2',
    generation: 4,
    lat: 53.5585,
    lon: 9.953,
    meters: 260,
  },
  {
    ssid: 'Hamburg City WiFi',
    signal: 52,
    frequencyMHz: 2437,
    security: 'Open',
    generation: 5,
    lat: 53.5615,
    lon: 9.98,
    meters: 3500,
  },
];

/** A network on the buses, which the phone hears now and then on its way, wherever it is. */
const BUS: Heard = {
  ssid: 'HVV Bus',
  signal: 52,
  frequencyMHz: 5745,
  security: 'Open',
  generation: 5,
};

/** How far apart two points are, in meters, near enough for a town. */
function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = (a.lat - b.lat) * 111_320;
  const x = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(x, y);
}

/** The street's networks heard at a point, each weaker the farther from its access point. */
function streetAt(where: { lat: number; lon: number }, time: number): Heard[] {
  const heard: Heard[] = STREET.flatMap(({ lat, lon, meters, signal, ...network }) => {
    const away = metersBetween(where, { lat, lon });
    return away < meters
      ? [{ ...network, signal: Math.round(signal * (1 - (0.7 * away) / meters)) }]
      : [];
  });
  if (drift(time, 600, 820) > 0.3) {
    heard.push(BUS);
  }
  return heard;
}

/** The networks heard, each at its signal a little up or down over time, the strongest first. */
function scanOf(heard: Heard[], time: number, connectedTo?: string): ScannedNetwork[] {
  let connected = false;
  return heard
    .map(({ signal, ...network }, i) => {
      const percent = Math.round(
        Math.min(100, Math.max(1, signal + 8 * drift(time, 1800, 700 + i))),
      );
      return { ...network, signalPercent: percent };
    })
    .sort((a, b) => b.signalPercent - a.signalPercent)
    .map((network) => {
      if (!connected && network.ssid === connectedTo) {
        connected = true;
        return { ...network, connected: true };
      }
      return network;
    });
}

/**
 * What GET /api/phone/scan answers in the demo for the phone near `time`, in Unix seconds: the
 * scan every five minutes closest to it, with the networks of the place the phone was connected
 * at then, or else those along the street where it was (`where`, or its route's point closest to
 * the scan), the same on every visit.
 */
export function demoPhoneScan(time: number, where?: { lat: number; lon: number }): PhoneScanAnswer {
  const at = Math.round(time / SCAN_EVERY) * SCAN_EVERY;
  const connection = demoPhoneWifi(at - 86400, at + 1).connections.find(
    (c) => c.start <= at && at <= c.end,
  );
  if (connection) {
    const heard = AT[connection.ssid] ?? AT['Den'];
    return { time, scan: { time: at, networks: scanOf(heard, at, connection.ssid) } };
  }
  const point =
    where ??
    // Up to a day on, so the way to the next place is there too.
    demoPhoneRoute(at - SCAN_EVERY, at + 86400).points.reduce<RoutePoint | undefined>(
      (best, p) => (!best || Math.abs(p.time - at) < Math.abs(best.time - at) ? p : best),
      undefined,
    );
  return { time, scan: { time: at, networks: point ? scanOf(streetAt(point, at), at) : [] } };
}
