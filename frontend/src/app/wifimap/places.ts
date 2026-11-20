import { I18n } from '../i18n/i18n';
import { PositionNetwork, WiFiPosition } from '../metrics/metrics';
import { Spot } from '../map/map-view';

/** How close, in map units, places are drawn as one numbered circle until the map is zoomed in. */
export const CLUSTER_UNITS = 24;

/** How alike, in percent of their access points, two places must be to be suggested as one. */
export const SAME_PERCENT = 50;

/** How far apart, in meters, two places may be at most to be suggested as one. */
export const SAME_METERS = 300;

/** What the user called a place, or "Place" and its id, which the hub keeps. */
export function placeLabel(place: WiFiPosition, i18n: I18n): string {
  return place.name || i18n.t('wifiPositions.place', { number: place.id });
}

/** How far apart two places are along the earth, in meters. */
export function metersApart(a: WiFiPosition, b: WiFiPosition): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** In how many of the scans at a place a network was heard, by any phone. */
export function heardIn(network: PositionNetwork): number {
  return network.devices.reduce((sum, s) => sum + s.scans, 0);
}

/** The network a phone was connected to at a place, the best heard; undefined when none was. */
export function yourNetwork(place: WiFiPosition): PositionNetwork | undefined {
  return place.networks.find((n) => n.connected);
}

/** Another place that is likely the same as a place: what the hub relates, close by and not kept apart. */
export interface SameSuggestion {
  /** Its index among the places. */
  place: number;
  percent: number;
  meters: number;
}

/**
 * The places that are likely the same as the one at `index`: those that heard at least SAME_PERCENT
 * of the same access points within SAME_METERS, unless the user keeps them apart, the most alike
 * first.
 */
export function sameAs(places: WiFiPosition[], index: number): SameSuggestion[] {
  const place = places[index];
  if (!place) {
    return [];
  }
  return (place.related ?? [])
    .filter((r) => r.percent >= SAME_PERCENT && places[r.place])
    .map((r) => ({
      place: r.place,
      percent: r.percent,
      meters: metersApart(place, places[r.place]),
    }))
    .filter((s) => s.meters <= SAME_METERS && !(place.apart ?? []).includes(places[s.place].id));
}

/** Places drawn as one: where, and their indexes, the first the one shown on top. */
export interface Cluster extends Spot {
  places: number[];
}

/**
 * The places drawn on the map: each in the order given joins the first cluster drawn within
 * CLUSTER_UNITS of it, or starts one; those in `alone` (the picked and the named places) are never
 * drawn together with others.
 */
export function clusters(spots: Spot[], order: number[], alone: ReadonlySet<number>): Cluster[] {
  const drawn: Cluster[] = [];
  for (const i of order) {
    const spot = spots[i];
    if (!spot) {
      continue;
    }
    const near = alone.has(i)
      ? undefined
      : drawn.find(
          (c) => !alone.has(c.places[0]) && Math.hypot(c.x - spot.x, c.y - spot.y) <= CLUSTER_UNITS,
        );
    if (near) {
      near.places.push(i);
    } else {
      drawn.push({ x: spot.x, y: spot.y, places: [i] });
    }
  }
  return drawn;
}

/** Whether a place or one of its networks has the text in its name, whatever the case. */
export function matches(place: WiFiPosition, label: string, text: string): boolean {
  const find = text.trim().toLocaleLowerCase();
  return (
    !find ||
    label.toLocaleLowerCase().includes(find) ||
    place.networks.some((n) => n.ssid?.toLocaleLowerCase().includes(find))
  );
}
