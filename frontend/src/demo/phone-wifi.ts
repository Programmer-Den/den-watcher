import { PhoneWifi } from '../app/metrics/metrics';
import { drift } from './fleet';

/** One connection of a day, from and to in minutes after its midnight; to may be on the next day. */
interface DemoConnection {
  ssid: string;
  from: number;
  to: number;
}

/** When the phone leaves home in the morning, in minutes after midnight, on a workday and else. */
const LEAVES_ON_WORKDAYS = 7 * 60 + 40;
const LEAVES_ELSE = 13 * 60 + 45;

/** Whether the day starting at midnight, a Date, is a workday. */
function workday(midnight: Date): boolean {
  const day = midnight.getDay();
  return day !== 0 && day !== 6;
}

/**
 * The connections that start on the day of midnight: on a workday the office, lunch at a café
 * and home from the evening, else a café in the afternoon and home again; each time home lasts
 * until the phone leaves the next day.
 */
function day(midnight: Date): DemoConnection[] {
  const next = new Date(midnight);
  next.setDate(next.getDate() + 1);
  const leaves = 1440 + (workday(next) ? LEAVES_ON_WORKDAYS : LEAVES_ELSE);
  if (workday(midnight)) {
    return [
      { ssid: 'Office', from: 8 * 60 + 30, to: 12 * 60 },
      { ssid: 'Vodafone Hotspot', from: 12 * 60 + 10, to: 12 * 60 + 50 },
      { ssid: 'Office', from: 13 * 60, to: 17 * 60 + 30 },
      { ssid: 'Den', from: 18 * 60 + 15, to: leaves },
    ];
  }
  return [
    { ssid: 'Telekom-8C21F0', from: 14 * 60, to: 15 * 60 + 30 },
    { ssid: 'Den', from: 15 * 60 + 50, to: leaves },
  ];
}

/**
 * What GET /api/phone/wifi answers in the demo for the phone, from `from` to `to` in Unix seconds,
 * as a hub keeps it: home, the office and a café, a few minutes earlier or later each day, the
 * same on every visit, and the one still going on ending now.
 */
export function demoPhoneWifi(from: number, to: number): PhoneWifi {
  const connections: PhoneWifi['connections'] = [];
  const midnight = new Date(from * 1000);
  midnight.setHours(0, 0, 0, 0);
  // From the day before, whose evening at home reaches into the range.
  midnight.setDate(midnight.getDate() - 1);
  while (midnight.getTime() / 1000 < to) {
    const base = midnight.getTime() / 1000;
    for (const [i, c] of day(midnight).entries()) {
      // Up to 4 minutes earlier or later, less than the gaps between them, the same for the same day.
      const start = base + c.from * 60 + Math.round(4 * drift(base, 86400, 400 + i)) * 60;
      const end = Math.min(base + c.to * 60 + Math.round(4 * drift(base, 86400, 420 + i)) * 60, to);
      if (start < to && end > from) {
        connections.push({ ssid: c.ssid, start, end });
      }
    }
    midnight.setDate(midnight.getDate() + 1);
  }
  return { from, to, connections };
}
