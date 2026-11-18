import { meters } from '../app/phone/phone-route';
import { PositionNetwork, WiFiPosition, WiFiPositions } from '../app/metrics/metrics';
import { DEMO_PHONE } from './phone-usage';
import { demoPhoneRoute } from './phone-route';
import { demoPhoneScan } from './phone-scan';

/** How close a scan must be to the first scan of a place to count to it, in meters, as on the hub. */
const PLACE_METERS = 100;

/** How many related places a place tells at most, as the hub does. */
const MAX_RELATED = 5;

/**
 * What GET /api/wifi/positions answers in the demo from `from` to `to` in Unix seconds: the demo
 * phone's scans at the points of its route, grouped into places within 100 m of their first scan as the hub does, the one with the
 * most scans first, each related to the others that heard some of the same networks. The demo's
 * scans have no access point IDs, so they are related by the networks' names, as the hub does for
 * scans stored before it kept the IDs.
 */
export function demoWifiPositions(from: number, to: number): WiFiPositions {
  const places: {
    place: WiFiPosition;
    lat: number;
    lon: number;
    sumLat: number;
    sumLon: number;
  }[] = [];
  for (const point of demoPhoneRoute(from, to).points) {
    const scan = demoPhoneScan(point.time).scan;
    if (!scan) {
      continue;
    }
    let entry = places.find(
      (e) => meters({ ...point, lat: e.lat, lon: e.lon }, point) <= PLACE_METERS,
    );
    if (!entry) {
      entry = {
        place: {
          lat: 0,
          lon: 0,
          anchorLat: point.lat,
          anchorLon: point.lon,
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
    entry.sumLat += point.lat;
    entry.sumLon += point.lon;
    const place = entry.place;
    place.scans++;
    place.last = scan.time;
    place.lat = Math.round((entry.sumLat / place.scans) * 1e6) / 1e6;
    place.lon = Math.round((entry.sumLon / place.scans) * 1e6) / 1e6;
    for (const n of scan.networks) {
      let network = place.networks.find((m) => (m.ssid ?? '') === (n.ssid ?? ''));
      if (!network) {
        network = { ssid: n.ssid, signalPercent: 0, last: 0, frequenciesMHz: [], devices: [] };
        place.networks.push(network);
      }
      addSighting(network, n.signalPercent, scan.time, n.frequencyMHz, n.security, n.connected);
    }
  }
  const all = places.map((e) => e.place).sort((a, b) => b.scans - a.scans || b.last - a.last);
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
