import { PhoneScanAnswer, ScannedNetwork } from '../app/metrics/metrics';
import { drift } from './fleet';
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
    { signal: 22, frequencyMHz: 2412, security: 'WPA2', generation: 4 },
  ],
  Office: [
    { ssid: 'Office', signal: 84, frequencyMHz: 5240, security: 'WPA2 Enterprise', generation: 6 },
    { ssid: 'Office', signal: 70, frequencyMHz: 2462, security: 'WPA2 Enterprise', generation: 6 },
    { ssid: 'Office-Guest', signal: 68, frequencyMHz: 5240, security: 'Open', generation: 6 },
    { ssid: 'DIRECT-7B-Canon MF', signal: 41, frequencyMHz: 2437, security: 'WPA2', generation: 4 },
    { ssid: 'Vodafone Hotspot', signal: 26, frequencyMHz: 2412, security: 'Open', generation: 5 },
    { signal: 33, frequencyMHz: 5745, security: 'WPA2', generation: 5 },
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
    { signal: 18, frequencyMHz: 5180, security: 'WPA2', generation: 5 },
  ],
};

/** Networks along the streets, of which the phone hears a few on its way, changing as it goes. */
const STREET: Heard[] = [
  {
    ssid: 'FRITZ!Box 6660 Cable QW',
    signal: 34,
    frequencyMHz: 2437,
    security: SECURE,
    generation: 6,
  },
  { ssid: 'Vodafone-7C3A', signal: 28, frequencyMHz: 2412, security: 'WPA2', generation: 5 },
  { ssid: 'o2-WLAN-91D4', signal: 41, frequencyMHz: 5180, security: 'WPA2', generation: 5 },
  { ssid: 'WLAN-55A0B1', signal: 22, frequencyMHz: 2462, security: 'WPA2', generation: 4 },
  { ssid: 'Hamburg City WiFi', signal: 46, frequencyMHz: 2437, security: 'Open', generation: 5 },
  { ssid: 'HVV Bus', signal: 52, frequencyMHz: 5745, security: 'Open', generation: 5 },
  { ssid: 'Pizzeria Roma', signal: 30, frequencyMHz: 2427, security: 'WPA2', generation: 4 },
  { signal: 19, frequencyMHz: 2412, security: 'WPA2', generation: 4 },
];

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
 * at then, or else a few along the street, the same on every visit.
 */
export function demoPhoneScan(time: number): PhoneScanAnswer {
  const at = Math.round(time / SCAN_EVERY) * SCAN_EVERY;
  const connection = demoPhoneWifi(at - 86400, at + 1).connections.find(
    (c) => c.start <= at && at <= c.end,
  );
  if (connection) {
    const heard = AT[connection.ssid] ?? AT['Den'];
    return { time, scan: { time: at, networks: scanOf(heard, at, connection.ssid) } };
  }
  // On the way: about four of the street's networks, others every few minutes.
  const street = STREET.filter((_, i) => drift(at, 600, 800 + i) > 0.1);
  return { time, scan: { time: at, networks: scanOf(street, at) } };
}
