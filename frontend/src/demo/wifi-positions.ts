import { meters } from '../app/phone/phone-route';
import {
  PhoneScan,
  PositionNetwork,
  RoutePoint,
  WiFiPosition,
  WiFiPositions,
} from '../app/metrics/metrics';
import { DEMO_PHONE } from './phone-usage';
import { demoPhoneRoute } from './phone-route';
import { demoPhoneScan } from './phone-scan';

/** How close a scan must be to the first scan of a place to count to it, in meters, as on the hub. */
const PLACE_METERS = 100;

/** How many related places a place tells at most, as the hub does. */
const MAX_RELATED = 5;

/** A point at no time, to measure with. */
const here = { time: 0, lat: 0, lon: 0, accuracy: 0 };

/** The places the demo's user named: those of the demo phone's home and office networks. */
const NAMED = [
  { name: 'Home', lat: 53.5755, lon: 9.953 },
  { name: 'Office', lat: 53.5531, lon: 10.0062 },
];

/** What the demo's visitor told of the places, kept for the visit, by the places' ids. */
export interface DemoPlaceEdits {
  /** The names given, '' for one taken away. */
  names: Map<number, string>;
  /** The place each merged place counts to. */
  mergedInto: Map<number, number>;
  /** The pairs kept apart, as "smaller id-larger id". */
  apart: Set<string>;
}

export function emptyPlaceEdits(): DemoPlaceEdits {
  return { names: new Map(), mergedInto: new Map(), apart: new Set() };
}

/**
 * What GET /api/wifi/positions answers in the demo from `from` to `to` in Unix seconds: the demo
 * phone's scans at the points of its route, grouped into places within 100 m of their first scan as
 * the hub does, found from `anchorsFrom` on so they keep their ids (the hub keeps its places; the
 * demo finds them again), the named ones first, then the one with the most scans in the range
 * first, each related to the others that heard some of the same networks. The demo's
 * scans have no access point IDs, so they are related by the networks' names, as the hub does for
 * scans stored before it kept the IDs. What the visitor named and merged counts, as on the hub.
 */
export function demoWifiPositions(
  anchorsFrom: number,
  from: number,
  to: number,
  edits: DemoPlaceEdits = emptyPlaceEdits(),
): WiFiPositions {
  const places: {
    place: WiFiPosition;
    /** Where the first scan was, which the others are measured from. */
    lat: number;
    lon: number;
    sumLat: number;
    sumLon: number;
  }[] = [];
  // First the places of all scans, then the scans in the range counted to them, or to the place
  // each was merged into.
  const scans: { point: RoutePoint; scan: PhoneScan; entry: (typeof places)[number] }[] = [];
  for (const point of demoPhoneRoute(Math.min(anchorsFrom, from), to).points) {
    const scan = demoPhoneScan(point.time).scan;
    if (!scan) {
      continue;
    }
    // The closest place within its size, as the hub does.
    let entry: (typeof places)[number] | undefined;
    let closest = PLACE_METERS;
    for (const e of places) {
      const away = meters({ ...point, lat: e.lat, lon: e.lon }, point);
      if (away <= closest) {
        closest = away;
        entry = e;
      }
    }
    if (!entry) {
      entry = {
        place: {
          lat: 0,
          lon: 0,
          // In the order the places start, as the hub numbers the places it keeps.
          id: places.length + 1,
          scans: 0,
          first: scan.time,
          last: 0,
          devices: [DEMO_PHONE],
          networks: [],
        },
        lat: point.lat,
        lon: point.lon,
        sumLat: 0,
        sumLon: 0,
      };
      places.push(entry);
    }
    // One before the range only keeps the place where it was.
    if (scan.time >= from) {
      scans.push({ point, scan, entry });
    }
  }
  const byId = new Map(places.map((e) => [e.place.id, e]));
  const root = (entry: (typeof places)[number]) => {
    let at = entry;
    for (let i = 0; i < places.length && edits.mergedInto.has(at.place.id); i++) {
      at = byId.get(edits.mergedInto.get(at.place.id)!) ?? at;
    }
    return at;
  };
  for (const { point, scan, entry: direct } of scans) {
    const entry = root(direct);
    entry.sumLat += point.lat;
    entry.sumLon += point.lon;
    const place = entry.place;
    if (place.scans === 0) {
      place.first = scan.time;
    }
    place.scans++;
    place.last = scan.time;
    place.lat = round6(entry.sumLat / place.scans);
    place.lon = round6(entry.sumLon / place.scans);
    for (const n of scan.networks) {
      let network = place.networks.find((m) => (m.ssid ?? '') === (n.ssid ?? ''));
      if (!network) {
        network = { ssid: n.ssid, signalPercent: 0, last: 0, frequenciesMHz: [], devices: [] };
        place.networks.push(network);
      }
      addSighting(network, n.signalPercent, scan.time, n.frequencyMHz, n.security, n.connected);
    }
  }
  // Each name on the place closest to its spot, as the user would have picked it.
  for (const n of NAMED) {
    const near = places
      .map((e) => ({
        e,
        away: meters({ ...here, lat: e.lat, lon: e.lon }, { ...here, lat: n.lat, lon: n.lon }),
      }))
      .filter((c) => c.away <= PLACE_METERS)
      .sort((a, b) => a.away - b.away)[0];
    if (near) {
      near.e.place.name = n.name;
    }
  }
  for (const e of places) {
    const id = e.place.id;
    if (edits.names.has(id)) {
      e.place.name = edits.names.get(id) || undefined;
    }
    const apart = [...edits.apart].flatMap((pair) => {
      const [a, b] = pair.split('-').map(Number);
      return a === id ? [b] : b === id ? [a] : [];
    });
    if (apart.length > 0) {
      e.place.apart = apart.sort((a, b) => a - b);
    }
    const merged = places.filter((m) => m !== e && root(m) === e).map((m) => m.place.id);
    if (merged.length > 0) {
      e.place.merged = merged;
    }
  }
  const all = places
    .map((e) => e.place)
    .filter((p) => p.scans > 0)
    .sort((a, b) => Number(!!b.name) - Number(!!a.name) || b.scans - a.scans || b.last - a.last);
  for (const place of all) {
    place.networks.sort((a, b) => b.signalPercent - a.signalPercent);
  }
  relate(all);
  return { from, to, places: all };
}

function addSighting(
  network: PositionNetwork,
  signal: number,
  time: number,
  frequency?: number,
  security?: string,
  connected?: boolean,
): void {
  if (signal >= network.signalPercent) {
    network.signalPercent = signal;
    network.security = security ?? network.security;
  }
  network.last = time;
  network.connected = network.connected || connected || undefined;
  if (frequency && !network.frequenciesMHz!.includes(frequency)) {
    network.frequenciesMHz!.push(frequency);
    network.frequenciesMHz!.sort((a, b) => a - b);
  }
  const sighting = network.devices[0];
  if (sighting) {
    sighting.signalPercent = Math.max(sighting.signalPercent, signal);
    sighting.last = time;
    sighting.scans++;
  } else {
    network.devices.push({ device: DEMO_PHONE, signalPercent: signal, last: time, scans: 1 });
  }
}

/** Relates each place to the others that heard some of the same networks, the most alike first. */
function relate(places: WiFiPosition[]): void {
  const heard = places.map((p) => new Set(p.networks.flatMap((n) => (n.ssid ? [n.ssid] : []))));
  heard.forEach((names, i) => {
    const related = heard
      .map((other, j) => {
        const shared = [...names].filter((n) => other.has(n)).length;
        const all = names.size + other.size - shared;
        return { place: j, shared, percent: all ? Math.round((shared / all) * 100) : 0 };
      })
      .filter((r) => r.place !== i && r.shared > 0)
      .sort((a, b) => b.percent - a.percent || b.shared - a.shared || a.place - b.place)
      .slice(0, MAX_RELATED);
    if (related.length > 0) {
      places[i].related = related;
    }
  });
}

/** Degrees rounded to 6 places, about 10 cm, as the hub sends them. */
function round6(degrees: number): number {
  return Math.round(degrees * 1e6) / 1e6;
}
