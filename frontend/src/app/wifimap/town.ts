import { LatLon } from '../map/map-view';
import { TownAccessPoint, TownTrack, TownTrackPoint } from '../metrics/metrics';

/** How long between two scans breaks a phone's way into two lines, in seconds: it was off or away. */
export const BREAK_SECONDS = 20 * 60;

/** One phone's way over one day, placed by the Wi-Fi around town. */
export interface TownDay {
  /** Tells the day apart: the phone and the start of the day. */
  key: string;
  device: string;
  /** The first and the last scan of the day, in Unix seconds. */
  start: number;
  end: number;
  points: TownTrackPoint[];
  /** How many scans the Wi-Fi placed, and how many heard no placed access point. */
  placed: number;
  gaps: number;
  /** How far the Wi-Fi placed the phone from its GPS, in meters, for the scans that have both. */
  off: number[];
}

/** The phones' ways by day, the newest day first, each phone's in the order the hub tells them. */
export function townDays(tracks: TownTrack[]): TownDay[] {
  const days: TownDay[] = [];
  for (const track of tracks) {
    const byDay = new Map<number, TownDay>();
    for (const p of track.points) {
      const day = new Date(p.time * 1000).setHours(0, 0, 0, 0);
      let entry = byDay.get(day);
      if (!entry) {
        entry = {
          key: `${track.device} ${day}`,
          device: track.device,
          start: p.time,
          end: p.time,
          points: [],
          placed: 0,
          gaps: 0,
          off: [],
        };
        byDay.set(day, entry);
        days.push(entry);
      }
      entry.points.push(p);
      entry.end = p.time;
      if (p.known > 0) {
        entry.placed++;
        if (p.gps) {
          entry.off.push(p.gps.offMeters ?? 0);
        }
      } else {
        entry.gaps++;
      }
    }
  }
  return days.sort((a, b) => b.end - a.end);
}

/** The value `share` of the way up the sorted values, such as 0.5 for the middle one. */
export function quantile(values: number[], share: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
}

/** A point of a line on the map, with how sure it is in meters. */
export type Placed = LatLon & { meters: number };

/**
 * The lines a phone's way is drawn with: the points placed by Wi-Fi (or by GPS for `gps`), broken
 * where a scan placed nothing or the phone scanned nothing for BREAK_SECONDS.
 */
export function townLines(points: TownTrackPoint[], gps = false): Placed[][] {
  const lines: Placed[][] = [];
  let line: Placed[] = [];
  let last = -Infinity;
  for (const p of points) {
    const at: Placed | null = gps
      ? p.gps
        ? { lat: p.gps.lat, lon: p.gps.lon, meters: 0 }
        : null
      : p.known > 0 && p.lat !== undefined && p.lon !== undefined
        ? { lat: p.lat, lon: p.lon, meters: p.meters ?? 0 }
        : null;
    if (!at || p.time - last > BREAK_SECONDS) {
      if (line.length > 0) {
        lines.push(line);
      }
      line = [];
    }
    if (at) {
      line.push(at);
    }
    last = p.time;
  }
  if (line.length > 0) {
    lines.push(line);
  }
  return lines;
}

/** Whether an access point's name or id has the text, whatever the case. */
export function accessPointMatches(ap: TownAccessPoint, text: string): boolean {
  const find = text.trim().toLocaleLowerCase();
  return (
    !find || !!ap.ssid?.toLocaleLowerCase().includes(find) || ap.id.toLocaleLowerCase() === find
  );
}
