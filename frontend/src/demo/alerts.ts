import { Alert } from '../app/alerts/alert';
import { DemoMachine, FLEET, snapshotOf } from './fleet';

/** When the demo's alerts that last now started: a while before the page was opened. */
const ACTIVE_FOR_SECONDS = 3 * 3600 + 17 * 60;

/**
 * The id of each alert by what it is about, so an alert keeps its id from one read to the next,
 * as in the backend, and the page tells only a new one as new.
 */
const ids = new Map<string, number>();

function alertId(device: string, kind: Alert['kind'], subject = ''): number {
  const key = `${device}\n${kind}\n${subject}`;
  let id = ids.get(key);
  if (id === undefined) {
    id = 1000 + ids.size;
    ids.set(key, id);
  }
  return id;
}

/**
 * The alerts of a machine at t, by the same thresholds as the backend: a disk from 90 % a warning
 * and from 95 % an alert, a temperature from 85 °C and 95 °C. The memory used raises none.
 */
export function activeAlerts(machine: DemoMachine, t: number): Alert[] {
  const s = snapshotOf(machine, t, 'demo');
  const started = new Date((t - ACTIVE_FOR_SECONDS) * 1000).toISOString();
  const base = { device: machine.device.id, deviceName: machine.device.name, started };
  const alerts: Alert[] = [];
  const add = (
    kind: Alert['kind'],
    value: number,
    warn: number,
    alert: number,
    subject?: string,
  ) => {
    if (value >= warn) {
      alerts.push({
        ...base,
        id: alertId(machine.device.id, kind, subject),
        kind,
        ...(subject ? { subject } : {}),
        level: value >= alert ? 'alert' : 'warning',
        value,
      });
    }
  };
  for (const disk of s.disks) {
    add('disk', disk.usedPercent, 90, 95, disk.path);
  }
  for (const sensor of s.temperatures) {
    add('temperature', sensor.celsius, 85, 95, sensor.sensor);
  }
  return alerts;
}

/** Alerts that ended, so the demo's log has some history: hours before t. */
function earlierAlerts(t: number): Alert[] {
  const at = (hoursAgo: number) => new Date((t - hoursAgo * 3600) * 1000).toISOString();
  return [
    {
      id: 4,
      device: 'windows-laptop',
      deviceName: 'Windows laptop',
      kind: 'wifi-lookalike',
      subject: 'Den',
      level: 'warning',
      started: at(5.4),
      ended: at(4.7),
    },
    {
      id: 3,
      device: 'windows-server',
      deviceName: 'Windows Server',
      kind: 'cpu',
      level: 'warning',
      value: 97,
      started: at(20),
      ended: at(19.2),
    },
    {
      id: 2,
      device: 'local',
      deviceName: '',
      kind: 'throttling',
      subject: 'undervoltage',
      level: 'alert',
      started: at(46),
      ended: at(45.9),
    },
    {
      id: 1,
      device: 'home-router',
      deviceName: 'Home router',
      kind: 'offline',
      level: 'alert',
      started: at(73),
      ended: at(72.9),
    },
  ];
}

/** The alerts that last now of each machine in the fleet, by device id. */
export function fleetAlerts(t: number): Map<string, Alert[]> {
  return new Map(
    FLEET.map((m) => [m.device.id, m.online && !m.online(t) ? [] : activeAlerts(m, t)]),
  );
}

/** What GET /api/alerts answers: the alerts that last, then the ones that ended, newest first. */
export function alertLog(t: number): Alert[] {
  return [...[...fleetAlerts(t).values()].flat(), ...earlierAlerts(t)];
}
