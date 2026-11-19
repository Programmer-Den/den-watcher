import { PositionNetwork, WiFiPosition } from '../metrics/metrics';
import { heardIn, metersApart } from './places';

/** Where a network was heard: at which place, how well and in how many of its scans. */
export interface NetworkSighting {
  /** The index of the place among the places. */
  place: number;
  signalPercent: number;
  heardIn: number;
  scans: number;
  last: number;
}

/** A network the phones heard, all places together. */
export interface MapNetwork {
  /** Tells it apart: its name, or its access point for a hidden one. */
  key: string;
  ssid?: string;
  id?: string;
  security?: string;
  frequenciesMHz: number[];
  /** Whether a phone was connected to it somewhere: the user's own networks. */
  connected: boolean;
  signalPercent: number;
  last: number;
  /** The places it was heard at, the best heard first. */
  at: NetworkSighting[];
}

/** The key that tells a network apart, as the hub groups them at a place. */
export function networkKey(network: PositionNetwork): string {
  return network.ssid ? `ssid:${network.ssid}` : `id:${network.id ?? ''}`;
}

/**
 * Every network heard at the places, all places together: the ones a phone was connected to first,
 * then the one heard at the most places, then the best heard.
 */
export function mapNetworks(places: WiFiPosition[]): MapNetwork[] {
  const byKey = new Map<string, MapNetwork>();
  places.forEach((place, index) => {
    for (const n of place.networks) {
      const key = networkKey(n);
      let network = byKey.get(key);
      if (!network) {
        network = {
          key,
          ssid: n.ssid,
          id: n.ssid ? undefined : n.id,
          frequenciesMHz: [],
          connected: false,
          signalPercent: 0,
          last: 0,
          at: [],
        };
        byKey.set(key, network);
      }
      network.security ??= n.security;
      network.connected ||= !!n.connected;
      network.signalPercent = Math.max(network.signalPercent, n.signalPercent);
      network.last = Math.max(network.last, n.last);
      for (const f of n.frequenciesMHz ?? []) {
        if (!network.frequenciesMHz.includes(f)) {
          network.frequenciesMHz.push(f);
        }
      }
      network.at.push({
        place: index,
        signalPercent: n.signalPercent,
        heardIn: Math.min(heardIn(n), place.scans),
        scans: place.scans,
        last: n.last,
      });
    }
  });
  const networks = [...byKey.values()];
  for (const n of networks) {
    n.frequenciesMHz.sort((a, b) => a - b);
    n.at.sort((a, b) => b.signalPercent - a.signalPercent || a.place - b.place);
  }
  return networks.sort(
    (a, b) =>
      Number(b.connected) - Number(a.connected) ||
      b.at.length - a.at.length ||
      b.signalPercent - a.signalPercent ||
      (a.ssid ?? '').localeCompare(b.ssid ?? ''),
  );
}

/**
 * How far a network reaches: the distance from the place it was heard best at to the farthest
 * place it was heard at, in meters; 0 when it was heard at one place only.
 */
export function reachMeters(network: MapNetwork, places: WiFiPosition[]): number {
  const best = places[network.at[0]?.place];
  if (!best) {
    return 0;
  }
  return Math.max(0, ...network.at.map((s) => metersApart(best, places[s.place])));
}

/** Whether a network has the text in its name, whatever the case. */
export function networkMatches(network: MapNetwork, text: string): boolean {
  const find = text.trim().toLocaleLowerCase();
  return !find || !!network.ssid?.toLocaleLowerCase().includes(find);
}
