import { PhoneRoute, RoutePoint } from '../app/metrics/metrics';
import { drift } from './fleet';
import { demoPhoneWifi } from './phone-wifi';

/** Where the demo phone's Wi-Fi networks are: home, the office and two cafés, in Hamburg. */
const PLACES: Record<string, { lat: number; lon: number }> = {
  Den: { lat: 53.5755, lon: 9.953 },
  Office: { lat: 53.5531, lon: 10.0062 },
  'Vodafone Hotspot': { lat: 53.5548, lon: 10.0011 },
  'Telekom-8C21F0': { lat: 53.5612, lon: 9.9615 },
};

/** How often the phone keeps a point while it stays, and while it is on its way, in seconds. */
const STILL_EVERY = 15 * 60;
const MOVING_EVERY = 2 * 60;

/** A point at a place, a few meters off as a position from the networks is, the same at the same time. */
function at(place: { lat: number; lon: number }, time: number, accuracy: number): RoutePoint {
  return {
    time,
    lat: Math.round((place.lat + 0.0002 * drift(time, 600, 500)) * 1e6) / 1e6,
    lon: Math.round((place.lon + 0.0003 * drift(time, 600, 510)) * 1e6) / 1e6,
    accuracy,
  };
}

/**
 * The way from one place to the next, from `start` to `end` in Unix seconds: first along the
 * latitude, then along the longitude, as along streets.
 */
function way(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  start: number,
  end: number,
): RoutePoint[] {
  const points: RoutePoint[] = [];
  const turn = { lat: to.lat, lon: from.lon };
  const first = Math.abs(to.lat - from.lat);
  const share = first / Math.max(1e-9, first + Math.abs(to.lon - from.lon));
  for (let t = start + MOVING_EVERY; t < end; t += MOVING_EVERY) {
    const done = (t - start) / (end - start);
    const place =
      done < share
        ? { lat: from.lat + (turn.lat - from.lat) * (done / share), lon: from.lon }
        : {
            lat: turn.lat,
            lon: turn.lon + (to.lon - turn.lon) * ((done - share) / Math.max(1e-9, 1 - share)),
          };
    points.push(at(place, t, 30));
  }
  return points;
}

/**
 * What GET /api/phone/route answers in the demo for the phone, from `from` to `to` in Unix seconds:
 * a point every quarter of an hour at the places its Wi-Fi was connected at, and every two minutes
 * on its way between them, the same on every visit.
 */
export function demoPhoneRoute(from: number, to: number): PhoneRoute {
  // From the day before, so the way to the first place in the range is there too.
  const connections = demoPhoneWifi(from - 86400, to).connections;
  const points: RoutePoint[] = [];
  connections.forEach((c, i) => {
    const place = PLACES[c.ssid] ?? PLACES['Den'];
    const first = Math.ceil(c.start / STILL_EVERY) * STILL_EVERY;
    for (let t = first; t <= c.end; t += STILL_EVERY) {
      points.push(at(place, t, 15));
    }
    const next = connections[i + 1];
    if (next) {
      points.push(...way(place, PLACES[next.ssid] ?? PLACES['Den'], c.end, next.start));
    }
  });
  return { from, to, points: points.filter((p) => p.time >= from && p.time < to) };
}
