/** What GET /api/wifi answers: what the Wi-Fi of each device saw nearby, in steps of whole hours. */
export interface WiFiHistory {
  from: number;
  to: number;
  stepSeconds: number;
  /** The devices whose Wi-Fi was read, with how many readings had it in each step. */
  devices: { device: string; steps: { time: number; readings: number }[] }[];
  accessPoints: WiFiAccessPoint[];
  /** The device id of each box that is a device, such as a node of a mesh the hub shows as one. */
  routers?: Record<string, string>;
}

/** One access point (one radio of a router) any device saw, as it was last seen. */
export interface WiFiAccessPoint {
  /** A hash of its hardware address. */
  id: string;
  /** A hash of the middle of its hardware address, the same for the radios of one router. */
  box: string;
  /** Left out for a hidden network. */
  ssid?: string;
  frequencyMHz?: number;
  widthMHz?: number;
  security?: string;
  generation?: number;
  firstSeen: number;
  lastSeen: number;
  seenBy: { device: string; points: WiFiPoint[] }[];
}

/** What a device saw of an access point in the step that starts at `time`. */
export interface WiFiPoint {
  time: number;
  /** In how many of the device's readings it saw it, and how many of those it was connected to it. */
  seen: number;
  connected?: number;
  signalPercent: number;
  minPercent: number;
  maxPercent: number;
  signalDBm?: number;
  /** The frequency it sent on in the step, the highest where it changed within it. */
  frequencyMHz?: number;
}

/** How good a signal is, for its color: from 75 %, 55 %, 35 % and 20 % on, and below. */
export type SignalLevel = 'great' | 'good' | 'fair' | 'weak' | 'poor';

export function signalLevel(percent: number): SignalLevel {
  if (percent >= 75) return 'great';
  if (percent >= 55) return 'good';
  if (percent >= 35) return 'fair';
  if (percent >= 20) return 'weak';
  return 'poor';
}

/** The channel number of a frequency in MHz, as Wi-Fi counts them in each band, or 0. */
export function wifiChannel(mhz: number): number {
  if (mhz === 2484) return 14;
  if (mhz >= 2412 && mhz <= 2472) return (mhz - 2407) / 5;
  if (mhz >= 5150 && mhz <= 5925) return (mhz - 5000) / 5;
  if (mhz > 5925 && mhz <= 7125) return mhz === 5935 ? 2 : (mhz - 5950) / 5;
  return 0;
}

/** The band of a frequency in MHz: 2.4, 5 or 6 (GHz), or undefined. */
export function wifiBand(mhz: number): 2.4 | 5 | 6 | undefined {
  if (mhz >= 2400 && mhz < 2500) return 2.4;
  if (mhz >= 5150 && mhz <= 5925) return 5;
  if (mhz > 5925 && mhz <= 7125) return 6;
  return undefined;
}

/**
 * Since when a point counts as what a device sees now: the last two steps, so a device whose last
 * hour has just begun still shows the one before.
 */
export function recentSince(history: WiFiHistory): number {
  const step = Math.max(history.stepSeconds, 3600);
  return Math.floor(history.to / step) * step - step;
}

/** A device's newest point of an access point, if it is recent (see recentSince). */
function recentPoint(ap: WiFiAccessPoint, device: string, since: number): WiFiPoint | undefined {
  const points = ap.seenBy.find((s) => s.device === device)?.points ?? [];
  const last = points[points.length - 1];
  return last && last.time >= since ? last : undefined;
}

/**
 * The network the devices are connected to: the name whose access points they were connected to
 * in the most readings, or undefined when none was.
 */
export function homeNetwork(history: WiFiHistory): string | undefined {
  const connected = new Map<string, number>();
  for (const ap of history.accessPoints) {
    if (!ap.ssid) continue;
    const count = ap.seenBy.reduce(
      (sum, s) => sum + s.points.reduce((n, p) => n + (p.connected ?? 0), 0),
      0,
    );
    if (count > 0) connected.set(ap.ssid, (connected.get(ap.ssid) ?? 0) + count);
  }
  let home: string | undefined;
  for (const [ssid, count] of connected) {
    if (home === undefined || count > connected.get(home)!) home = ssid;
  }
  return home;
}

/** One network by name, and what each device hears of it now. */
export interface NetworkRow {
  ssid: string;
  /** Whether it is the network the devices are connected to (see homeNetwork). */
  home: boolean;
  /** The channel of its strongest access point, and how it is secured. */
  frequencyMHz?: number;
  security?: string;
  /** The strongest signal of its access points each device hears now, in percent, by device. */
  signals: Map<string, number>;
}

/**
 * The networks the devices see now, by name, hidden ones left out: the home network first, then
 * those more devices see, then the stronger.
 */
export function networkRows(history: WiFiHistory): NetworkRow[] {
  const since = recentSince(history);
  const home = homeNetwork(history);
  const rows = new Map<string, NetworkRow & { best: number }>();
  for (const ap of history.accessPoints) {
    if (!ap.ssid) continue;
    for (const { device } of ap.seenBy) {
      const point = recentPoint(ap, device, since);
      if (!point) continue;
      let row = rows.get(ap.ssid);
      if (!row) {
        row = { ssid: ap.ssid, home: ap.ssid === home, signals: new Map(), best: -1 };
        rows.set(ap.ssid, row);
      }
      row.signals.set(device, Math.max(row.signals.get(device) ?? 0, point.signalPercent));
      if (point.signalPercent > row.best) {
        row.best = point.signalPercent;
        row.frequencyMHz = ap.frequencyMHz;
        row.security = ap.security;
      }
    }
  }
  return [...rows.values()]
    .sort(
      (a, b) =>
        Number(b.home) - Number(a.home) ||
        b.signals.size - a.signals.size ||
        b.best - a.best ||
        a.ssid.localeCompare(b.ssid),
    )
    .map(({ ssid, home, frequencyMHz, security, signals }) => ({
      ssid,
      home,
      frequencyMHz,
      security,
      signals,
    }));
}

/**
 * The routers of a network, each with all its radios: numbered by when they were first seen, and
 * by the device that hears them best now, so a mesh's nodes can be told apart without naming them.
 */
export interface NetworkBox {
  box: string;
  number: number;
  /** The device that hears it best now, if any does. */
  nearest?: string;
  /** The device it is, if the hub shows it as one. */
  router?: string;
}

export function networkBoxes(history: WiFiHistory, ssid: string): NetworkBox[] {
  const since = recentSince(history);
  const boxes = new Map<string, { firstSeen: number; nearest?: string; best: number }>();
  for (const ap of history.accessPoints) {
    if (ap.ssid !== ssid) continue;
    const box = boxes.get(ap.box) ?? { firstSeen: ap.firstSeen, best: -1 };
    box.firstSeen = Math.min(box.firstSeen, ap.firstSeen);
    for (const { device } of ap.seenBy) {
      const point = recentPoint(ap, device, since);
      if (point && point.signalPercent > box.best) {
        box.best = point.signalPercent;
        box.nearest = device;
      }
    }
    boxes.set(ap.box, box);
  }
  return [...boxes]
    .sort(([a, x], [b, y]) => x.firstSeen - y.firstSeen || a.localeCompare(b))
    .map(([box, { nearest }], i) => ({
      box,
      number: i + 1,
      nearest,
      router: history.routers?.[box],
    }));
}

/** How well one device hears the home network. */
export interface HomeRow {
  device: string;
  /** The access point it is connected to, or else hears best, now; undefined when out of range. */
  accessPoint?: WiFiAccessPoint;
  box?: NetworkBox;
  signalPercent?: number;
  signalDBm?: number;
  connected: boolean;
  /**
   * Its best signal of the network in each step of the history, oldest first: null where it was
   * read but did not see it, undefined where its Wi-Fi was not read, as it was off or away.
   */
  steps: (number | null | undefined)[];
}

/** The starts of the steps of the history, oldest first. */
export function stepTimes(history: WiFiHistory): number[] {
  const step = history.stepSeconds;
  const times: number[] = [];
  for (let t = Math.floor(history.from / step) * step; t < history.to; t += step) {
    times.push(t);
  }
  return times;
}

/** A row for each device whose Wi-Fi was read, in the order of devices, for the network ssid. */
export function homeRows(history: WiFiHistory, ssid: string, devices: string[]): HomeRow[] {
  const since = recentSince(history);
  const boxes = new Map(networkBoxes(history, ssid).map((b) => [b.box, b]));
  const aps = history.accessPoints.filter((ap) => ap.ssid === ssid);
  const times = stepTimes(history);
  return devices.flatMap((device) => {
    const read = history.devices.find((d) => d.device === device);
    if (!read || read.steps.length === 0) return [];
    let best: { ap: WiFiAccessPoint; point: WiFiPoint } | undefined;
    for (const ap of aps) {
      const point = recentPoint(ap, device, since);
      if (!point) continue;
      const rank = (p: WiFiPoint) => ((p.connected ?? 0) > 0 ? 1000 : 0) + p.signalPercent;
      if (!best || rank(point) > rank(best.point)) best = { ap, point };
    }
    const readAt = new Set(read.steps.filter((s) => s.readings > 0).map((s) => s.time));
    const signals = new Map<number, number>();
    for (const ap of aps) {
      for (const p of ap.seenBy.find((s) => s.device === device)?.points ?? []) {
        signals.set(p.time, Math.max(signals.get(p.time) ?? 0, p.signalPercent));
      }
    }
    return [
      {
        device,
        accessPoint: best?.ap,
        box: best && boxes.get(best.ap.box),
        signalPercent: best?.point.signalPercent,
        signalDBm: best?.point.signalDBm,
        connected: (best?.point.connected ?? 0) > 0,
        steps: times.map((t) => signals.get(t) ?? (readAt.has(t) ? null : undefined)),
      },
    ];
  });
}

/** The devices whose Wi-Fi was read in the history, in the order of devices. */
export function wifiDevices(history: WiFiHistory, devices: string[]): string[] {
  const read = new Set(
    history.devices.filter((d) => d.steps.some((s) => s.readings > 0)).map((d) => d.device),
  );
  return devices.filter((d) => read.has(d));
}

/** The channels of 2.4 GHz that do not overlap, of which a network should use one. */
const CLEAR_24 = [1, 6, 11];

/**
 * The 80 MHz block of a 5 GHz channel, which a network of that width fills: 36 to 48, 52 to 64,
 * 100 to 112 and so on, and 149 to 161.
 */
function block5(channel: number): number {
  return channel >= 149
    ? 149 + Math.floor((channel - 149) / 16) * 16
    : 36 + Math.floor((channel - 36) / 16) * 16;
}

/** The first channels of the 80 MHz blocks of 5 GHz, of which a network could use one. */
const BLOCKS_5 = [36, 52, 100, 116, 132, 149];

/** How busy the channels of one band are. */
export interface BandChannels {
  band: 2.4 | 5 | 6;
  /** Each channel in use, and on 2.4 GHz each of 1 to 13, with how many routers send on it. */
  channels: { channel: number; routers: number; home: boolean }[];
  /**
   * When the home network sends in the band: the channel it could use with the fewest other
   * routers near, the one it uses if that is as good. On 2.4 GHz one of 1, 6 and 11, counting the
   * routers two channels or less away, as those overlap; on 5 GHz the first channel of the 80 MHz
   * block with the fewest.
   */
  suggested?: number;
}

/**
 * How many routers any device hears now send on each channel, by band; a router with more than
 * one network on a radio, such as one with a guest network, counts once. Only bands with a router
 * are given.
 */
export function channelUse(history: WiFiHistory): BandChannels[] {
  const since = recentSince(history);
  const home = homeNetwork(history);
  // Each radio heard now: its band and channel, and whether it sends the home network.
  const radios = new Map<string, { band: 2.4 | 5 | 6; channel: number; home: boolean }>();
  for (const ap of history.accessPoints) {
    const band = ap.frequencyMHz ? wifiBand(ap.frequencyMHz) : undefined;
    const channel = ap.frequencyMHz ? wifiChannel(ap.frequencyMHz) : 0;
    if (!band || !channel || !ap.seenBy.some((s) => recentPoint(ap, s.device, since))) continue;
    const key = `${ap.box}\n${band}\n${channel}`;
    const isHome = !!home && ap.ssid === home;
    radios.set(key, { band, channel, home: isHome || !!radios.get(key)?.home });
  }
  const bands: BandChannels[] = [];
  for (const band of [2.4, 5, 6] as const) {
    const inBand = [...radios.values()].filter((r) => r.band === band);
    if (inBand.length === 0) continue;
    const used = inBand.map((r) => r.channel);
    const shown = [
      ...new Set([...(band === 2.4 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] : []), ...used]),
    ].sort((a, b) => a - b);
    const channels = shown.map((channel) => ({
      channel,
      routers: inBand.filter((r) => r.channel === channel).length,
      home: inBand.some((r) => r.home && r.channel === channel),
    }));
    const homes = inBand.filter((r) => r.home).map((r) => r.channel);
    let suggested: number | undefined;
    if (band !== 6 && homes.length > 0) {
      const others = inBand.filter((r) => !r.home).map((r) => r.channel);
      const near = (a: number, b: number) =>
        band === 2.4 ? Math.abs(a - b) <= 2 : block5(a) === block5(b);
      const crowd = (c: number) => others.filter((o) => near(o, c)).length;
      for (const c of band === 2.4 ? CLEAR_24 : BLOCKS_5) {
        if (suggested === undefined || crowd(c) < crowd(suggested)) suggested = c;
      }
      const current = homes.find((c) => crowd(c) <= crowd(suggested!));
      if (current !== undefined) suggested = current;
    }
    bands.push({ band, channels, suggested });
  }
  return bands;
}

/**
 * The signal a device hears each access point at in a step, or now (the newest recent point of
 * each) without a time, by access point id; access points it hears below 20 % are left out, as a
 * device far from them hears them by chance.
 */
function signalsOf(history: WiFiHistory, device: string, time?: number): Map<string, number> {
  const since = recentSince(history);
  const signals = new Map<string, number>();
  for (const ap of history.accessPoints) {
    const point =
      time === undefined
        ? recentPoint(ap, device, since)
        : ap.seenBy.find((s) => s.device === device)?.points.find((p) => p.time === time);
    if (point && point.signalPercent >= 20) signals.set(ap.id, point.signalPercent);
  }
  return signals;
}

/**
 * How alike two devices hear the access points, from 0 to 100 %: 100 less the average difference
 * of their signals, an access point only one of them hears counting as 0 % for the other. Two
 * devices in one room hear the same access points about as strong. Undefined when neither hears
 * any.
 */
export function likeness(a: Map<string, number>, b: Map<string, number>): number | undefined {
  const ids = new Set([...a.keys(), ...b.keys()]);
  if (ids.size === 0) return undefined;
  let difference = 0;
  for (const id of ids) {
    difference += Math.abs((a.get(id) ?? 0) - (b.get(id) ?? 0));
  }
  return Math.max(0, 100 - difference / ids.size);
}

/** How alike from this likeness on two devices are counted as being in one place. */
export const TOGETHER = 80;

/** How alike the devices hear the networks now, and the groups of those probably together. */
export interface Places {
  /** How alike each pair of devices is, by the two ids joined with a newline, in the given order. */
  likeness: Map<string, number>;
  /** The groups of two or more devices each at least TOGETHER alike to another of the group. */
  groups: string[][];
}

export function places(history: WiFiHistory, devices: string[]): Places {
  const signals = new Map(devices.map((d) => [d, signalsOf(history, d)]));
  const alike = new Map<string, number>();
  const group = new Map(devices.map((d) => [d, d]));
  const root = (d: string): string => (group.get(d) === d ? d : root(group.get(d)!));
  devices.forEach((a, i) =>
    devices.slice(i + 1).forEach((b) => {
      const value = likeness(signals.get(a)!, signals.get(b)!);
      if (value === undefined) return;
      alike.set(`${a}\n${b}`, value);
      if (value >= TOGETHER) group.set(root(b), root(a));
    }),
  );
  const groups = new Map<string, string[]>();
  for (const d of devices) {
    groups.set(root(d), [...(groups.get(root(d)) ?? []), d]);
  }
  return { likeness: alike, groups: [...groups.values()].filter((g) => g.length > 1) };
}

/**
 * How alike a device heard the access points in each step of the history to how it hears them
 * now, oldest first, undefined where its Wi-Fi was not read: a step far from 100 % is a time it
 * was elsewhere, such as a laptop carried to another room.
 */
export function sameSpot(history: WiFiHistory, device: string): (number | undefined)[] {
  const now = signalsOf(history, device);
  const read = new Set(
    history.devices
      .find((d) => d.device === device)
      ?.steps.filter((s) => s.readings > 0)
      .map((s) => s.time),
  );
  return stepTimes(history).map((t) =>
    read.has(t) ? (likeness(now, signalsOf(history, device, t)) ?? 100) : undefined,
  );
}

/** What can change in the networks nearby. */
export type WiFiChangeKind = 'lookalike' | 'newAccessPoint' | 'channel' | 'appeared' | 'gone';

/** A change in the networks nearby. */
export interface WiFiChange {
  kind: WiFiChangeKind;
  /** The start of the step it happened in: for one that is gone, the step it was seen in last. */
  time: number;
  ssid: string;
  /** The devices that saw it then, the one that heard it strongest first. */
  devices: string[];
  security?: string;
  frequencyMHz?: number;
  /** For a change of channel, the frequency before. */
  fromMHz?: number;
}

/** A network name as lookalikes are compared: without case, spaces, hyphens and underscores. */
export function foldSSID(ssid: string): string {
  return ssid.toLowerCase().replace(/[ _-]/g, '');
}

/**
 * The kinds of a security: "WPA2/WPA3" is WPA2 and WPA3, and "WPA2/WPA3 Enterprise", where
 * Enterprise is written once for all of them, is WPA2 Enterprise and WPA3 Enterprise.
 */
function securityKinds(security: string): string[] {
  const enterprise = security.endsWith(' Enterprise');
  const kinds = (enterprise ? security.slice(0, -' Enterprise'.length) : security).split('/');
  return enterprise ? kinds.map((kind) => kind + ' Enterprise') : kinds;
}

/** Whether two securities, such as "WPA2/WPA3" and "WPA2", have a kind in common. */
function sharesSecurity(a: string, b: string): boolean {
  const kinds = securityKinds(b);
  return securityKinds(a).some((kind) => kinds.includes(kind));
}

/** The devices that saw access points in the step at time, or at all without one, strongest first. */
function seers(aps: WiFiAccessPoint[], time?: number): string[] {
  const strongest = new Map<string, number>();
  for (const ap of aps) {
    for (const s of ap.seenBy) {
      for (const p of s.points) {
        if (time === undefined || p.time === time) {
          strongest.set(s.device, Math.max(strongest.get(s.device) ?? 0, p.signalPercent));
        }
      }
    }
  }
  return [...strongest].sort((a, b) => b[1] - a[1]).map(([device]) => device);
}

/** The order changes of one step are told in: the most serious first. */
const CHANGE_ORDER: WiFiChangeKind[] = [
  'lookalike',
  'newAccessPoint',
  'channel',
  'appeared',
  'gone',
];

/**
 * What changed in the networks nearby over the history, newest first:
 * - a router not of the home network (none of the devices was connected to it) that sends a
 *   network named like it (see foldSSID): with no kind of security in common, a lookalike, which
 *   may be a copy set up to catch passwords, else, under the very name, a new access point of it;
 * - a router of the home network that moved to another channel;
 * - a network that appeared after the first step, and one no device saw lately (see recentSince).
 * Hidden networks are left out, as their name is not known.
 */
export function wifiChanges(history: WiFiHistory): WiFiChange[] {
  const start = stepTimes(history)[0];
  const since = recentSince(history);
  const home = homeNetwork(history);
  const named = new Map<string, WiFiAccessPoint[]>();
  for (const ap of history.accessPoints) {
    if (ap.ssid) named.set(ap.ssid, [...(named.get(ap.ssid) ?? []), ap]);
  }
  const homeAPs = (home && named.get(home)) || [];
  const homeBoxes = new Set(
    homeAPs
      .filter((ap) => ap.seenBy.some((s) => s.points.some((p) => p.connected)))
      .map((ap) => ap.box),
  );
  // The securities of the access points the devices were connected to, as the alert compares.
  const homeSecurities = homeAPs.flatMap((ap) =>
    ap.security && ap.seenBy.some((s) => s.points.some((p) => p.connected)) ? [ap.security] : [],
  );
  const changes: WiFiChange[] = [];
  for (const [ssid, aps] of named) {
    if (home && foldSSID(ssid) === foldSSID(home)) {
      const boxes = new Map<string, WiFiAccessPoint[]>();
      for (const ap of aps.filter((ap) => !homeBoxes.has(ap.box))) {
        boxes.set(ap.box, [...(boxes.get(ap.box) ?? []), ap]);
      }
      for (const radios of boxes.values()) {
        const first = radios.reduce((a, b) => (b.firstSeen < a.firstSeen ? b : a));
        const security = first.security;
        const other =
          !!security &&
          homeSecurities.length > 0 &&
          !homeSecurities.some((own) => sharesSecurity(security, own));
        if (other || (ssid === home && first.firstSeen > start)) {
          changes.push({
            kind: other ? 'lookalike' : 'newAccessPoint',
            time: first.firstSeen,
            ssid,
            devices: seers(radios),
            security: first.security,
            frequencyMHz: first.frequencyMHz,
          });
        }
      }
      continue;
    }
    const first = aps.reduce((a, b) => (b.firstSeen < a.firstSeen ? b : a));
    const last = Math.max(...aps.map((ap) => ap.lastSeen));
    if (first.firstSeen > start) {
      changes.push({
        kind: 'appeared',
        time: first.firstSeen,
        ssid,
        devices: seers(aps, first.firstSeen),
        security: first.security,
        frequencyMHz: first.frequencyMHz,
      });
    }
    if (last < since) {
      changes.push({ kind: 'gone', time: last, ssid, devices: seers(aps, last) });
    }
  }
  for (const ap of homeAPs.filter((ap) => homeBoxes.has(ap.box))) {
    const frequencies = new Map<number, number>();
    for (const s of ap.seenBy) {
      for (const p of s.points) {
        if (p.frequencyMHz)
          frequencies.set(p.time, Math.max(frequencies.get(p.time) ?? 0, p.frequencyMHz));
      }
    }
    let before: number | undefined;
    for (const [time, mhz] of [...frequencies].sort((a, b) => a[0] - b[0])) {
      if (before !== undefined && mhz !== before) {
        changes.push({
          kind: 'channel',
          time,
          ssid: ap.ssid!,
          devices: seers([ap], time),
          frequencyMHz: mhz,
          fromMHz: before,
        });
      }
      before = mhz;
    }
  }
  return changes.sort(
    (a, b) => b.time - a.time || CHANGE_ORDER.indexOf(a.kind) - CHANGE_ORDER.indexOf(b.kind),
  );
}

/** A place named on the page, as GET and PUT /api/wifi/places carry it. */
export interface WiFiPlace {
  name: string;
  /** What a device heard there: the signal in percent of each access point, by its id. */
  signals: Record<string, number>;
}

/** The most access points a place keeps, as the hub takes them: the strongest. */
export const PLACE_SIGNALS = 64;

/**
 * Where a device was: at a named place, or else at home near a router of the home network, or
 * neither of them (an empty object), as somewhere not named yet.
 */
export interface Whereabout {
  place?: string;
  /** The box of the router of the home network it heard best. */
  box?: string;
}

/**
 * Where a device was by the signals it heard: the named place it heard most alike to, from
 * TOGETHER on, else near the router of the home network it heard best.
 */
function whereaboutOf(
  history: WiFiHistory,
  signals: Map<string, number>,
  named: WiFiPlace[],
  home: string | undefined,
): Whereabout {
  let best: { place: string; alike: number } | undefined;
  for (const place of named) {
    const alike = likeness(signals, new Map(Object.entries(place.signals)));
    if (alike !== undefined && alike >= TOGETHER && (!best || alike > best.alike)) {
      best = { place: place.name, alike };
    }
  }
  if (best) return { place: best.place };
  let router: { box: string; signal: number } | undefined;
  for (const ap of history.accessPoints) {
    const signal = signals.get(ap.id);
    if (home && ap.ssid === home && signal !== undefined && (!router || signal > router.signal)) {
      router = { box: ap.box, signal };
    }
  }
  return router ? { box: router.box } : {};
}

/** Where a device is now, or undefined when its Wi-Fi was not read lately (see recentSince). */
export function whereNow(
  history: WiFiHistory,
  device: string,
  named: WiFiPlace[],
): Whereabout | undefined {
  const since = recentSince(history);
  const steps = history.devices.find((d) => d.device === device)?.steps ?? [];
  if (!steps.some((s) => s.readings > 0 && s.time >= since)) return undefined;
  return whereaboutOf(history, signalsOf(history, device), named, homeNetwork(history));
}

/**
 * Where a device was in each step of the history, oldest first, undefined where its Wi-Fi was not
 * read, as it was off.
 */
export function timeline(
  history: WiFiHistory,
  device: string,
  named: WiFiPlace[],
): (Whereabout | undefined)[] {
  const home = homeNetwork(history);
  const read = new Set(
    history.devices
      .find((d) => d.device === device)
      ?.steps.filter((s) => s.readings > 0)
      .map((s) => s.time),
  );
  return stepTimes(history).map((t) =>
    read.has(t) ? whereaboutOf(history, signalsOf(history, device, t), named, home) : undefined,
  );
}

/**
 * What a device hears now, to name the place it is at: the PLACE_SIGNALS strongest access points,
 * rounded to a tenth of a percent, or undefined when it hears none.
 */
export function placeSignals(
  history: WiFiHistory,
  device: string,
): Record<string, number> | undefined {
  const strongest = [...signalsOf(history, device)]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, PLACE_SIGNALS);
  return strongest.length > 0
    ? Object.fromEntries(strongest.map(([id, signal]) => [id, Math.round(signal * 10) / 10]))
    : undefined;
}
