import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { Alert } from '../alerts/alert';
import { WiFiHistory, WiFiPlace } from '../compare/wifi';
import { LOCAL_DEVICE } from '../devices/devices';
import { Extra, ExtraInfo } from './extras';
import { System } from './system';

/** The usage of the machine at one point in time, as served by GET /api/metrics. */
export interface Snapshot {
  /** The version of den-watcher on the device; missing on versions from before it was reported. */
  version?: string;
  time: string;
  /** The time zone the device's clock is set to; missing on versions from before it was reported. */
  timeZone?: TimeZone;
  uptimeSeconds: number;
  cpu: {
    usagePercent: number;
    cores: number;
    /** The usage of each core; missing where the OS does not report it. */
    coreUsagePercent?: number[];
    /** The clock of the fastest group of cores; missing where the OS does not report it. */
    clockMHz?: number;
    /** Missing on Windows, which has no load average. */
    loadAverage?: LoadAverage;
    /** Share of time spent waiting for disks; only reported by Linux. */
    ioWaitPercent?: number;
    /** Share of time a virtual machine waited for its host; only reported by Linux. */
    stealPercent?: number;
    /** Only reported by Linux. */
    processes?: { total: number; running: number };
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    usedPercent: number;
    /** What programs can still get, including cache the system frees when needed. */
    availableBytes?: number;
    /** Cache and buffers; only reported by Linux. */
    cachedBytes?: number;
    /** Missing when the machine has no swap space. */
    swap?: Swap;
  };
  /** Empty when the machine exposes no temperature sensor. */
  temperatures: Temperature[];
  /** One entry per path in the backend's DISK_PATHS setting. */
  disks: Disk[];
  /** The machine's network cards; empty when it has none. */
  network: NetworkInterface[];
  /** The GPUs whose usage the OS reports; missing from devices that run an older version. */
  gpus?: Gpu[];
  /** Only reported by Raspberry Pis. */
  throttling?: Throttling;
  /** Only reported by machines with a battery. */
  battery?: Battery;
  /** Only reported where Linux knows the fans, such as a Raspberry Pi 5. */
  fans?: Fan[];
  /** Values beyond the ones above, which the device describes itself; missing when it has none. */
  extras?: Extra[];
  /** What the machine is, read once at start; missing on versions from before it was reported. */
  system?: System;
  /**
   * How long the device took to answer the hub's last reading, which the hub measures; missing for
   * the hub itself, routers, checks and from hubs of older versions.
   */
  responseMilliseconds?: number;
}

export interface Fan {
  name: string;
  rpm: number;
}

/** The charge of the machine's batteries, and whether it runs on mains power. */
export interface Battery {
  percent: number;
  pluggedIn: boolean;
  /** Power flowing in or out; only reported by Linux. */
  watts?: number;
  /** How much the battery holds compared to when it was new; only reported by Linux. */
  healthPercent?: number;
}

/** The time zone of a device's clock: its short name, such as "CEST", and how far it is ahead of UTC. */
export interface TimeZone {
  name: string;
  offsetSeconds: number;
}

/** The average number of processes running or waiting over the last 1, 5 and 15 minutes. */
export interface LoadAverage {
  one: number;
  five: number;
  fifteen: number;
}

export interface Swap {
  totalBytes: number;
  usedBytes: number;
  usedPercent: number;
}

/** A condition a Raspberry Pi's firmware reports about its power supply and clock. */
export type ThrottlingCondition =
  'undervoltage' | 'frequencyCapped' | 'throttled' | 'softTemperatureLimit';

/** The conditions that hold now, and those that held at some point since the Pi started. */
export interface Throttling {
  now: ThrottlingCondition[];
  sinceBoot: ThrottlingCondition[];
}

export interface Temperature {
  sensor: string;
  celsius: number;
}

/** The usage of the filesystem that holds one path, and how fast its disk reads and writes. */
export interface Disk {
  path: string;
  totalBytes: number;
  usedBytes: number;
  usedPercent: number;
  /** Missing where the disk's counters cannot be read, such as a network share. */
  readBytesPerSecond?: number;
  writeBytesPerSecond?: number;
  /** Reads and writes per second. */
  operationsPerSecond?: number;
  /** Share of time the disk was busy; only reported by Linux. */
  busyPercent?: number;
  /** Average time per read or write; only reported by Linux. */
  latencyMs?: number;
}

/** The traffic of one network interface, with the speed since the previous request. */
export interface NetworkInterface {
  name: string;
  receivedBytes: number;
  sentBytes: number;
  receiveBytesPerSecond: number;
  sendBytesPerSecond: number;
  /** Packets with errors since the machine started; missing when there were none. */
  errors?: number;
  /** Packets thrown away since the machine started; missing when there were none. */
  dropped?: number;
  /** The speed the interface is connected at; missing where unknown, such as most Wi-Fi cards. */
  linkMbps?: number;
  /** IPv4 addresses. */
  addresses?: string[];
}

/** The usage of one graphics processor. Memory and temperature are missing where it does not report them. */
export interface Gpu {
  name: string;
  usagePercent: number;
  memoryTotalBytes?: number;
  memoryUsedBytes?: number;
  celsius?: number;
}

/**
 * The machine's usage over a time range, as served by GET /api/history.
 * Times are Unix seconds; each point is the average over one step.
 */
export interface History {
  from: number;
  to: number;
  stepSeconds: number;
  /** How many days of history the backend keeps (its RETENTION_DAYS setting). */
  retentionDays: number;
  series: Series[];
  /**
   * Set for a device that is not answering: when its newest reading is from,
   * in Unix seconds. The range then ends there instead of now.
   */
  lastReading?: number;
  /** Describes the series of extras ("extra:<group>/<value>"), by metric. */
  extras?: Record<string, ExtraInfo>;
}

/**
 * The values of one metric over time. The metric is "cpu", "memory", "swap" or "battery" (percent),
 * or a kind followed by the disk, sensor or interface it belongs to: "disk:/"
 * (percent), "disk.read:/" or "disk.write:/" (bytes per second), "temperature:cpu_thermal" (°C),
 * "network.receive:eth0" or "network.send:eth0" (bytes per second), "gpu:AMD GPU" or
 * "gpu.memory:AMD GPU" (percent), or an extra such as "extra:pressure/cpu" (as History.extras describes).
 */
export interface Series {
  metric: string;
  points: Point[];
}

export interface Point {
  time: number;
  value: number;
}

/** What happened to a device in a range, as GET /api/events serves it. */
export interface DeviceEvents {
  from: number;
  to: number;
  /** Oldest first. */
  events: DeviceEvent[];
}

/**
 * Something that happened to a device: an alert, a time it did not answer the hub, a reboot or an
 * update of Den-Watcher on it; a newer backend may name kinds this page does not know yet.
 */
export interface DeviceEvent {
  kind: 'alert' | 'outage' | 'reboot' | 'update';
  /** When it happened or started, in Unix seconds. */
  time: number;
  /** When an alert or outage ended, in Unix seconds; missing while an alert lasts. */
  end?: number;
  /** The new version of an update. */
  detail?: string;
  /** The alert of an alert event. */
  alert?: Alert;
}

/** Reads the usage of a device from the backend: the one it runs on unless another is named. */
@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);

  current(device = LOCAL_DEVICE.id): Observable<Snapshot> {
    return this.http.get<Snapshot>('/api/metrics', { params: deviceParam(device) });
  }

  /** The usage of every device that answers, by its id; one whose usage cannot be read is left out. */
  fleet(): Observable<Record<string, Snapshot>> {
    return this.http.get<Record<string, Snapshot>>('/api/devices/metrics');
  }

  /** The usage from `from` to `to`, both Unix seconds, such as from nowSeconds(). */
  history(from: number, to: number, device = LOCAL_DEVICE.id): Observable<History> {
    return this.http.get<History>('/api/history', {
      params: { from, to, ...deviceParam(device) },
    });
  }

  /** The usage from `from` to `to` as a CSV file, with the name the backend gives it. */
  historyCsv(from: number, to: number, device = LOCAL_DEVICE.id): Observable<HttpResponse<Blob>> {
    return this.http.get('/api/history.csv', {
      params: { from, to, ...deviceParam(device) },
      responseType: 'blob',
      observe: 'response',
    });
  }

  /** What the Wi-Fi of every device saw nearby from `from` to `to`, both Unix seconds. */
  wifi(from: number, to: number): Observable<WiFiHistory> {
    return this.http.get<WiFiHistory>('/api/wifi', { params: { from, to } });
  }

  /** The places named on the page, by what a device's Wi-Fi hears there. */
  wifiPlaces(): Observable<WiFiPlace[]> {
    return this.http
      .get<{ places: WiFiPlace[] | null }>('/api/wifi/places')
      .pipe(map((answer) => answer.places ?? []));
  }

  /** Keeps the places named on the page, in place of the ones before. */
  saveWifiPlaces(places: WiFiPlace[]): Observable<unknown> {
    return this.http.put('/api/wifi/places', { places });
  }

  /** What happened to a device from `from` to `to`, both Unix seconds. */
  events(from: number, to: number, device = LOCAL_DEVICE.id): Observable<DeviceEvents> {
    return this.http.get<DeviceEvents>('/api/events', {
      params: { from, to, ...deviceParam(device) },
    });
  }
}

/** The backend answers for the device it runs on when a request names none. */
function deviceParam(device: string): Record<string, string> {
  return device === LOCAL_DEVICE.id ? {} : { device };
}

/** This computer's time in whole Unix seconds, as the history is asked for. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
