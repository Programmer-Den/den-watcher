/** What GET /api/wifi answers: what the Wi-Fi of each device saw nearby, in steps of whole hours. */
export interface WiFiHistory {
  from: number;
  to: number;
  stepSeconds: number;
  /** The devices whose Wi-Fi was read, with how many readings had it in each step. */
  devices: { device: string; steps: { time: number; readings: number }[] }[];
  accessPoints: WiFiAccessPoint[];
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
    .map(([box, { nearest }], i) => ({ box, number: i + 1, nearest }));
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
