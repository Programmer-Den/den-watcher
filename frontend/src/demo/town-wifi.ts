import {
  RoutePoint,
  ScannedNetwork,
  TownAccessPoint,
  TownTrack,
  TownTrackPoint,
  TownWiFi,
} from '../app/metrics/metrics';
import { DEMO_PHONE } from './phone-usage';
import { demoPhoneRoute } from './phone-route';
import { demoPhoneScan } from './phone-scan';
import { DEMO_REMOVED_PHONE } from './wifi-positions';

/** How far apart the points that heard an access point may be for it to stay put, as on the hub. */
const SPREAD_METERS = 1000;

/** How sure a spot or a position is at best, in meters, as on the hub. */
const MIN_METERS = 15;

/** How long back the demo learns the access points, in seconds: the hub learns from its newest scans. */
const LEARN_SECONDS = 30 * 86400;

const METERS_PER_DEGREE = 111_320;

/** What the scans with a GPS position found of one access point, in meters from its first point. */
interface Spot {
  ssid?: string;
  lat: number;
  lon: number;
  cos: number;
  sw: number;
  sx: number;
  sy: number;
  sxx: number;
  syy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  points: number;
  lastPoint: number;
  scans: number;
  signal: number;
  first: number;
  last: number;
  connected: boolean;
}

/**
 * The demo's networks have no access point IDs: one name on one channel stands for one, which is
 * enough for the made-up town.
 */
function idOf(n: ScannedNetwork): string {
  return n.id ?? `${n.ssid}/${n.frequencyMHz}`;
}

function weight(signal: number): number {
  const s = Math.max(signal, 5) / 100;
  return s * s;
}

function offset(s: Spot, p: RoutePoint): [number, number] {
  return [(p.lon - s.lon) * METERS_PER_DEGREE * s.cos, (p.lat - s.lat) * METERS_PER_DEGREE];
}

/** A spot's middle and how far around it it was heard, without a scan at `without` if set. */
function spotAt(
  s: Spot,
  without?: { point: RoutePoint; signal: number },
): { lat: number; lon: number; meters: number } | null {
  let { sw, sx, sy, sxx, syy } = s;
  if (without) {
    const [x, y] = offset(s, without.point);
    const w = weight(without.signal);
    sw -= w;
    sx -= w * x;
    sy -= w * y;
    sxx -= w * x * x;
    syy -= w * y * y;
  }
  if (sw < 1e-9) {
    return null;
  }
  const mx = sx / sw;
  const my = sy / sw;
  const spread = Math.sqrt(Math.max(sxx / sw - mx * mx + syy / sw - my * my, 0));
  return {
    lat: s.lat + my / METERS_PER_DEGREE,
    lon: s.lon + mx / (METERS_PER_DEGREE * s.cos),
    meters: Math.max(spread, MIN_METERS),
  };
}

function placed(s: Spot): boolean {
  return s.points >= 2 && Math.hypot(s.maxX - s.minX, s.maxY - s.minY) <= SPREAD_METERS;
}

function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const y = (a.lat - b.lat) * METERS_PER_DEGREE;
  const x = (a.lon - b.lon) * METERS_PER_DEGREE * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(x, y);
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The demo phone's scans at the points of its route, each placed by its point, as the hub does. */
function scans(from: number, to: number): { point: RoutePoint; networks: ScannedNetwork[] }[] {
  return demoPhoneRoute(from, to).points.flatMap((point) => {
    const scan = demoPhoneScan(point.time, point).scan;
    return scan ? [{ point, networks: scan.networks }] : [];
  });
}

/**
 * What GET /api/wifi/town answers in the demo from `from` to `to` in Unix seconds: where the access
 * points around the made-up town are, learned from the demo phone's scans of the 30 days up to `now`,
 * and its way in the range placed by them alone, each scan without what it taught, as the hub does.
 */
export function demoTownWifi(from: number, to: number, now: number): TownWiFi {
  const learn = scans(now - LEARN_SECONDS, now);
  const spots = new Map<string, Spot>();
  for (const { point, networks } of learn) {
    for (const n of networks) {
      const id = idOf(n);
      let s = spots.get(id);
      if (!s) {
        s = {
          lat: point.lat,
          lon: point.lon,
          cos: Math.cos((point.lat * Math.PI) / 180),
          sw: 0,
          sx: 0,
          sy: 0,
          sxx: 0,
          syy: 0,
          minX: 0,
          maxX: 0,
          minY: 0,
          maxY: 0,
          points: 0,
          lastPoint: -1,
          scans: 0,
          signal: 0,
          first: point.time,
          last: point.time,
          connected: false,
        };
        spots.set(id, s);
      }
      const [x, y] = offset(s, point);
      const w = weight(n.signalPercent);
      s.sw += w;
      s.sx += w * x;
      s.sy += w * y;
      s.sxx += w * x * x;
      s.syy += w * y * y;
      s.minX = Math.min(s.minX, x);
      s.maxX = Math.max(s.maxX, x);
      s.minY = Math.min(s.minY, y);
      s.maxY = Math.max(s.maxY, y);
      if (s.lastPoint !== point.time) {
        s.points++;
        s.lastPoint = point.time;
      }
      s.scans++;
      s.ssid = n.ssid ?? s.ssid;
      s.signal = Math.max(s.signal, n.signalPercent);
      s.last = point.time;
      s.connected ||= !!n.connected;
    }
  }

  let moving = 0;
  let once = 0;
  const accessPoints: TownAccessPoint[] = [];
  for (const [id, s] of spots) {
    if (!placed(s)) {
      if (s.points < 2) {
        once++;
      } else {
        moving++;
      }
      continue;
    }
    const at = spotAt(s)!;
    accessPoints.push({
      id,
      ssid: s.ssid,
      lat: round6(at.lat),
      lon: round6(at.lon),
      meters: Math.round(at.meters),
      points: s.points,
      scans: s.scans,
      signalPercent: s.signal,
      first: s.first,
      last: s.last,
      connected: s.connected || undefined,
    });
  }
  accessPoints.sort((a, b) => b.points - a.points || b.signalPercent - a.signalPercent);

  const learned = new Set(learn.map((l) => l.point.time));
  const points: TownTrackPoint[] = scans(from, to).map(({ point, networks }) => {
    const gps = { lat: point.lat, lon: point.lon };
    let sw = 0;
    let lat = 0;
    let lon = 0;
    const heard: { lat: number; lon: number; meters: number; w: number }[] = [];
    for (const n of networks) {
      const s = spots.get(idOf(n));
      const at =
        s && placed(s)
          ? spotAt(s, learned.has(point.time) ? { point, signal: n.signalPercent } : undefined)
          : null;
      if (at) {
        const w = weight(n.signalPercent);
        heard.push({ ...at, w });
        sw += w;
        lat += w * at.lat;
        lon += w * at.lon;
      }
    }
    if (heard.length === 0) {
      return { time: point.time, known: 0, gps };
    }
    const here = { lat: lat / sw, lon: lon / sw };
    const spread = heard.reduce(
      (sum, k) => sum + k.w * (metersBetween(here, k) ** 2 + k.meters ** 2),
      0,
    );
    return {
      time: point.time,
      known: heard.length,
      lat: round6(here.lat),
      lon: round6(here.lon),
      meters: Math.round(Math.max(Math.sqrt(spread / sw), MIN_METERS)),
      gps: { ...gps, offMeters: Math.round(metersBetween(here, gps)) },
    };
  });
  return {
    from,
    to,
    learned: learn.length,
    learnedFrom: learn[0]?.point.time,
    moving,
    once,
    accessPoints,
    tracks: points.length > 0 ? [{ device: DEMO_PHONE, points }, ...removedPhoneTrack(points)] : [],
  };
}

/**
 * The removed phone's way (see DEMO_REMOVED_PHONE): the demo phone's placed scans of the first day
 * in the range, as if it went the same way, a little later, before it was removed.
 */
function removedPhoneTrack(points: TownTrackPoint[]): TownTrack[] {
  const first = points[0].time;
  const day = points
    .filter((p) => p.known > 0 && p.time < first + 86400)
    .map((p) => ({ ...p, time: p.time + REMOVED_PHONE_LATER }));
  return day.length > 0 ? [{ device: DEMO_REMOVED_PHONE, points: day }] : [];
}

/** How much later than the demo phone the removed phone went its way, in seconds. */
const REMOVED_PHONE_LATER = 7 * 60;
