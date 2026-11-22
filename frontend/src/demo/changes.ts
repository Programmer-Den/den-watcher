import { Change } from '../app/devices/change-log';

const HOUR = 3600;
const DAY = 24 * HOUR;

/**
 * What GET /api/changes answers in the demo: a few changes over the last weeks, newest first, from
 * two browsers on the local network, with a wrong password tried from a third.
 */
export function demoChanges(now: number): Change[] {
  const at = (ago: number) => Math.floor(now - ago);
  return [
    { time: at(2 * HOUR), address: '192.168.1.23', action: 'wrongPassword', device: 'linux-nas' },
    { time: at(1 * DAY + 3 * HOUR), address: '192.168.1.20', action: 'backup' },
    {
      time: at(2 * DAY),
      address: '192.168.1.42',
      action: 'deleteRoute',
      device: 'android-phone',
      detail: `${at(5 * DAY)}-${at(4 * DAY)}`,
    },
    {
      time: at(3 * DAY),
      address: '192.168.1.20',
      action: 'rename',
      device: 'linux-desktop',
      detail: 'Linux desktop',
    },
    { time: at(6 * DAY), address: '192.168.1.42', action: 'addPhone', detail: 'Android phone' },
    {
      time: at(9 * DAY),
      address: '192.168.1.20',
      action: 'kind',
      device: 'linux-laptop',
      detail: 'pc',
    },
    {
      time: at(12 * DAY),
      address: '192.168.1.20',
      action: 'remove',
      device: 'old-pi',
      detail: 'keepHistory',
    },
    { time: at(20 * DAY), address: '192.168.1.20', action: 'add', detail: 'Linux NAS' },
    { time: at(20 * DAY + 60), address: '192.168.1.20', action: 'password' },
  ];
}
