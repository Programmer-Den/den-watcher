import {
  WiFiAccessPoint,
  WiFiHistory,
  channelUse,
  homeNetwork,
  homeRows,
  networkBoxes,
  networkRows,
  likeness,
  places,
  sameSpot,
  signalLevel,
  wifiBand,
  wifiChanges,
  wifiChannel,
  wifiDevices,
} from './wifi';

const HOUR = 3600;
/** The start of the newest hour of the histories below. */
const NOW = 1000 * HOUR;

/** An access point seen by the devices with the signals given, by device, in the newest hour. */
function ap(
  id: string,
  box: string,
  ssid: string | undefined,
  signals: Record<string, number>,
  extra: Partial<WiFiAccessPoint> = {},
  connected: string[] = [],
): WiFiAccessPoint {
  return {
    id,
    box,
    ssid,
    frequencyMHz: 5180,
    security: 'WPA2',
    firstSeen: NOW - 2 * HOUR,
    lastSeen: NOW,
    seenBy: Object.entries(signals).map(([device, signalPercent]) => ({
      device,
      points: [
        {
          time: NOW,
          seen: 10,
          connected: connected.includes(device) ? 10 : undefined,
          signalPercent,
          minPercent: signalPercent,
          maxPercent: signalPercent,
        },
      ],
    })),
    ...extra,
  };
}

function history(accessPoints: WiFiAccessPoint[]): WiFiHistory {
  const devices = ['hub', 'laptop', 'pc'].map((device) => ({
    device,
    steps: [
      { time: NOW - HOUR, readings: device === 'pc' ? 0 : 12 },
      { time: NOW, readings: 12 },
    ],
  }));
  return { from: NOW - HOUR, to: NOW + 600, stepSeconds: HOUR, devices, accessPoints };
}

describe('signalLevel', () => {
  it('rates a signal in five steps', () => {
    expect([90, 75, 60, 40, 25, 10].map(signalLevel)).toEqual([
      'great',
      'great',
      'good',
      'fair',
      'weak',
      'poor',
    ]);
  });
});

describe('wifiChannel and wifiBand', () => {
  it('follow from the frequency', () => {
    expect([2412, 2484, 5180, 5955, 6115].map(wifiChannel)).toEqual([1, 14, 36, 1, 33]);
    expect([2437, 5500, 6115, 60000].map(wifiBand)).toEqual([2.4, 5, 6, undefined]);
  });
});

describe('homeNetwork', () => {
  it('is the name the devices were connected to most', () => {
    const h = history([
      ap('a1', 'b1', 'Den', { hub: 60, laptop: 90 }, {}, ['hub', 'laptop']),
      ap('g1', 'b1', 'Den-Guest', { pc: 50 }, {}, ['pc']),
    ]);
    expect(homeNetwork(h)).toBe('Den');
    expect(homeNetwork(history([ap('a1', 'b1', 'Den', { hub: 60 })]))).toBeUndefined();
  });
});

describe('networkRows', () => {
  it("puts the home network first, then those more devices see, each with its devices' strongest signal", () => {
    const rows = networkRows(
      history([
        ap('n1', 'nb', 'Neighbour', { hub: 30, laptop: 20, pc: 25 }, { security: 'Open' }),
        ap('a1', 'b1', 'Den', { hub: 60 }, { frequencyMHz: 2437 }, ['hub']),
        ap('a2', 'b1', 'Den', { hub: 40, laptop: 95 }),
        ap('h1', 'hb', undefined, { hub: 80 }),
        ap('p1', 'pb', 'Printer', { laptop: 45 }),
      ]),
    );
    expect(rows.map((r) => [r.ssid, r.home, [...r.signals]])).toEqual([
      [
        'Den',
        true,
        [
          ['hub', 60],
          ['laptop', 95],
        ],
      ],
      [
        'Neighbour',
        false,
        [
          ['hub', 30],
          ['laptop', 20],
          ['pc', 25],
        ],
      ],
      ['Printer', false, [['laptop', 45]]],
    ]);
    // The channel and security of the strongest access point.
    expect(rows[0].frequencyMHz).toBe(5180);
    expect(rows[1].security).toBe('Open');
  });

  it('leaves out what no device has seen lately', () => {
    const old = ap('o1', 'ob', 'Gone', { hub: 50 });
    old.seenBy[0].points[0].time = NOW - 5 * HOUR;
    expect(networkRows(history([old]))).toEqual([]);
  });
});

describe('networkBoxes', () => {
  it('numbers the routers of a network by when they were first seen, with the device nearest each', () => {
    const h = history([
      ap('a1', 'b2', 'Den', { pc: 70 }, { firstSeen: NOW - HOUR }),
      ap('a2', 'b1', 'Den', { hub: 50, laptop: 80 }),
      ap('a3', 'b1', 'Den', { hub: 65 }, { frequencyMHz: 2437 }),
    ]);
    expect(networkBoxes(h, 'Den')).toEqual([
      { box: 'b1', number: 1, nearest: 'laptop' },
      { box: 'b2', number: 2, nearest: 'pc' },
    ]);
  });

  it('tells which router is a device', () => {
    const h = { ...history([ap('a1', 'b1', 'Den', { pc: 70 })]), routers: { b1: 'node' } };
    expect(networkBoxes(h, 'Den')).toEqual([
      { box: 'b1', number: 1, nearest: 'pc', router: 'node' },
    ]);
  });
});

describe('homeRows', () => {
  it('takes the access point a device is connected to, else the one it hears best, with its last day', () => {
    const h = history([
      ap('a1', 'b1', 'Den', { hub: 50, laptop: 40 }, {}, ['laptop']),
      ap('a2', 'b2', 'Den', { hub: 70, laptop: 80 }),
      ap('n1', 'nb', 'Neighbour', { pc: 90 }),
    ]);
    const rows = homeRows(h, 'Den', ['hub', 'laptop', 'pc', 'gone']);
    expect(
      rows.map((r) => [r.device, r.accessPoint?.id, r.box?.number, r.signalPercent, r.connected]),
    ).toEqual([
      ['hub', 'a2', 2, 70, false],
      ['laptop', 'a1', 1, 40, true],
      ['pc', undefined, undefined, undefined, false],
    ]);
    // The hour before, the hub was read but did not see Den, and the PC was not read at all.
    expect(rows.map((r) => r.steps)).toEqual([
      [null, 70],
      [null, 80],
      [undefined, null],
    ]);
  });
});

describe('wifiDevices', () => {
  it('keeps the devices whose Wi-Fi was read, in the order given', () => {
    const h = history([]);
    h.devices.push({ device: 'off', steps: [{ time: NOW, readings: 0 }] });
    expect(wifiDevices(h, ['pc', 'off', 'other', 'hub'])).toEqual(['pc', 'hub']);
  });
});

describe('channelUse', () => {
  it('counts the routers on each channel, a router with two networks on a radio once', () => {
    const bands = channelUse(
      history([
        ap('a1', 'b1', 'Den', { hub: 60 }, { frequencyMHz: 2437 }, ['hub']),
        ap('g1', 'b1', 'Den-Guest', { hub: 60 }, { frequencyMHz: 2437 }),
        ap('a2', 'b1', 'Den', { hub: 70 }, { frequencyMHz: 5180 }, ['hub']),
        ap('n1', 'nb', 'Neighbour', { laptop: 30 }, { frequencyMHz: 2437 }),
        ap('n2', 'nc', 'Other', { laptop: 30 }, { frequencyMHz: 2422 }),
        ap('n3', 'nd', 'Far', { pc: 30 }, { frequencyMHz: 5500 }),
        ap('t1', 'te', 'Telekom', { pc: 30 }, { frequencyMHz: 6115 }),
      ]),
    );
    expect(bands.map((b) => b.band)).toEqual([2.4, 5, 6]);
    const two = bands[0];
    expect(two.channels.map((c) => c.channel)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(two.channels.filter((c) => c.routers > 0)).toEqual([
      { channel: 3, routers: 1, home: false },
      { channel: 6, routers: 2, home: true },
    ]);
    // Channels 1 and 6 each have a neighbour two channels or less away, 11 has none.
    expect(two.suggested).toBe(11);
    expect(bands[1].channels).toEqual([
      { channel: 36, routers: 1, home: true },
      { channel: 100, routers: 1, home: false },
    ]);
    // The home network's block is as free as any, so it stays.
    expect(bands[1].suggested).toBe(36);
    expect(bands[2]).toEqual({
      band: 6,
      channels: [{ channel: 33, routers: 1, home: false }],
      suggested: undefined,
    });
  });
});

describe('likeness', () => {
  it('is 100 less the average difference, an access point heard by one only counting as 0 for the other', () => {
    const a = new Map([
      ['x', 80],
      ['y', 40],
    ]);
    expect(likeness(a, new Map(a))).toBe(100);
    expect(likeness(a, new Map([['x', 70]]))).toBe(75);
    expect(likeness(new Map(), new Map())).toBeUndefined();
  });
});

describe('places', () => {
  it('groups the devices that hear the networks alike', () => {
    const h = history([
      ap('a1', 'b1', 'Den', { hub: 40, laptop: 90, pc: 85 }),
      ap('a2', 'b2', 'Den', { hub: 90, laptop: 30, pc: 35 }),
      // Below 20 %, a network does not count.
      ap('n1', 'nb', 'Neighbour', { laptop: 15 }),
    ]);
    const result = places(h, ['hub', 'laptop', 'pc']);
    expect(result.groups).toEqual([['laptop', 'pc']]);
    expect(result.likeness.get('laptop\npc')).toBe(95);
    expect(result.likeness.get('hub\nlaptop')).toBe(45);
  });
});

describe('sameSpot', () => {
  it('compares each step to how the device hears the networks now', () => {
    const a1 = ap('a1', 'b1', 'Den', { laptop: 90 });
    a1.seenBy[0].points.unshift({ ...a1.seenBy[0].points[0], time: NOW - HOUR, signalPercent: 30 });
    const h = history([a1]);
    expect(sameSpot(h, 'laptop')).toEqual([40, 100]);
    expect(sameSpot(h, 'pc')).toEqual([undefined, 100]);
  });
});

describe('wifiChanges', () => {
  /** An access point heard by the hub in the steps hoursAgo given, at 50 % on mhz. */
  function heard(
    id: string,
    box: string,
    ssid: string,
    hours: number[],
    extra: Partial<WiFiAccessPoint> = {},
    frequencies: number[] = [],
    connected = false,
  ): WiFiAccessPoint {
    const times = hours.map((h) => NOW - h * HOUR);
    return {
      id,
      box,
      ssid,
      frequencyMHz: 2437,
      security: 'WPA2/WPA3',
      firstSeen: Math.min(...times),
      lastSeen: Math.max(...times),
      seenBy: [
        {
          device: 'hub',
          points: times.map((time, i) => ({
            time,
            seen: 10,
            connected: connected ? 10 : undefined,
            signalPercent: 50,
            minPercent: 50,
            maxPercent: 50,
            frequencyMHz: frequencies[i],
          })),
        },
      ],
      ...extra,
    };
  }

  it('finds copies of the home network, new and gone networks and a router that moved, newest first', () => {
    const h = history([
      heard('a1', 'b1', 'Den', [3, 2, 1, 0], {}, [2412, 2412, 2437, 2437], true),
      // Another router of Den with WPA2 only, there all along: not new and no copy.
      heard('a2', 'b2', 'Den', [3, 2, 1, 0], { security: 'WPA2' }),
      heard('c1', 'cb', 'den ', [2], { security: 'Open' }),
      heard('n1', 'nb', 'Neighbour', [1, 0]),
      heard('g1', 'gb', 'Gone', [3, 2]),
      heard('o1', 'ob', 'Old', [3, 2, 1, 0]),
    ]);
    h.from = NOW - 3 * HOUR;
    expect(wifiChanges(h).map((c) => [c.kind, c.ssid, (NOW - c.time) / HOUR])).toEqual([
      ['channel', 'Den', 1],
      ['appeared', 'Neighbour', 1],
      ['lookalike', 'den ', 2],
      ['gone', 'Gone', 2],
    ]);
    const moved = wifiChanges(h).find((c) => c.kind === 'channel')!;
    expect([moved.fromMHz, moved.frequencyMHz, moved.devices]).toEqual([2412, 2437, ['hub']]);
  });

  it('tells a new router under the very name with the same security as a new access point', () => {
    const h = history([
      heard('a1', 'b1', 'Den', [3, 2, 1, 0], {}, [], true),
      heard('a2', 'b2', 'Den', [1, 0], { security: 'WPA3' }),
    ]);
    h.from = NOW - 3 * HOUR;
    expect(wifiChanges(h).map((c) => [c.kind, c.ssid])).toEqual([['newAccessPoint', 'Den']]);
  });

  it('counts Enterprise for every kind of a security', () => {
    const h = history([
      heard('a1', 'b1', 'Office', [3, 2, 1, 0], { security: 'WPA2/WPA3 Enterprise' }, [], true),
      heard('a2', 'b2', 'Office', [1, 0], { security: 'WPA2 Enterprise' }),
      heard('a3', 'b3', 'Office', [1, 0], { security: 'WPA2' }),
    ]);
    h.from = NOW - 3 * HOUR;
    expect(wifiChanges(h).map((c) => [c.kind, c.security])).toEqual([
      ['lookalike', 'WPA2'],
      ['newAccessPoint', 'WPA2 Enterprise'],
    ]);
  });

  it('compares with the security of the access point the devices were connected to', () => {
    const h = history([
      // The home router's 6 GHz radio, WPA3 only, which no device was connected to.
      heard('a0', 'b1', 'Den', [3, 2, 1, 0], { security: 'WPA3' }),
      heard('a1', 'b1', 'Den', [3, 2, 1, 0], { security: 'WPA2' }, [], true),
      heard('a2', 'b2', 'Den', [3, 2, 1, 0], { security: 'WPA2' }),
    ]);
    h.from = NOW - 3 * HOUR;
    expect(wifiChanges(h)).toEqual([]);
  });
});
