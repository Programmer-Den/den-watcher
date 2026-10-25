import {
  HttpBackend,
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Observable, delay, mergeMap, of, throwError, timer } from 'rxjs';

import {
  Availability,
  DeviceList,
  LOCAL_DEVICE,
  StatusPage,
  Suggestion,
} from '../app/devices/devices';
import { EMPTY_LAYOUT } from '../app/dashboard/page-layout';
import { History, Series } from '../app/metrics/metrics';
import { DEMO_BUILD, demoVersion } from './demo-build';
import { alertLog, fleetAlerts } from './alerts';
import { demoEvents } from './events';
import { DemoMachine, FLEET, extraInfoOf, offlineSince, snapshotOf } from './fleet';

/** How many days of history the demo hub keeps; more than 30 shows the "All" range. */
export const DEMO_RETENTION_DAYS = 90;

/** Like the backend: readings every 5 s for the last 30 minutes, minute averages before that. */
const RECENT_SPAN = 30 * 60;
const RECENT_INTERVAL = 5;
const SAMPLE_INTERVAL = 60;
const MAX_POINTS = 360;

/** The visitor's device, which the Devices dialog offers to add like on a real hub. */
const DEMO_SUGGESTION: Suggestion = {
  address: '192.168.1.47:9393',
  name: 'Kitchen tablet',
  kind: 'pc',
};

/** Where the demo keeps the page's layout, which a real hub keeps on the host. */
export const LAYOUT_STORAGE_KEY = 'demoLayout';

/** How long the made-up devices take to answer, so the page loads like it does on a real hub. */
const LATENCY_MS = 60;

/** The pairing code the demo's hub shows for itself, as a hub that collects from it would ask. */
export const DEMO_PAIRING_CODE = '7KQM-X2RP';

/** The demo hub's remote status page, as one set up with STATUS_ADDR. */
export const DEMO_STATUS_PAGE: StatusPage = {
  enabled: true,
  port: '9443',
  fingerprint:
    '3A:7F:C2:19:8E:44:D0:6B:A1:5C:E9:02:7D:B8:31:F6:4E:90:2A:C7:58:1D:EB:63:0F:A4:96:3C:D2:71:8B:E5',
  passwordSet: true,
};

/**
 * Answers the page's requests to /api with made-up values from the sample
 * devices instead of sending them anywhere. Devices cannot be added, removed or changed, nor a
 * backup downloaded; the
 * page's layout is kept in the visitor's browser.
 */
@Injectable()
export class DemoBackend implements HttpBackend {
  private readonly version = demoVersion(inject(DEMO_BUILD));
  private readonly window = inject(DOCUMENT).defaultView;
  /** Until when each phone may change its hub, in Unix seconds, once it was let. */
  private readonly released = new Map<string, number>();

  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const url = new URL(request.urlWithParams, 'http://demo');
    const device = url.searchParams.get('device') ?? LOCAL_DEVICE.id;
    const machine = FLEET.find((m) => m.device.id === device);
    const now = Date.now() / 1000;

    if (request.method === 'GET' && url.pathname === '/api/devices') {
      return respond(request, deviceList(now, this.released));
    }
    if (request.method === 'GET' && url.pathname === '/api/alerts') {
      return respond(request, alertLog(Math.floor(now)));
    }
    if (request.method === 'GET' && url.pathname === '/api/devices/metrics') {
      return respond(
        request,
        Object.fromEntries(
          FLEET.filter((m) => isOnline(m, now) && !m.device.pairing).map((m) => [
            m.device.id,
            snapshotOf(m, Math.floor(now), this.version),
          ]),
        ),
      );
    }
    if (request.method === 'GET' && url.pathname === '/api/devices/suggestion') {
      return respond(request, DEMO_SUGGESTION);
    }
    if (request.method === 'GET' && url.pathname === '/api/pairing') {
      return respond(request, { code: DEMO_PAIRING_CODE });
    }
    if (request.method === 'GET' && url.pathname === '/api/status-page') {
      return respond(request, DEMO_STATUS_PAGE);
    }
    if (url.pathname === '/api/layout') {
      return this.layout(request);
    }
    const release = /^\/api\/phones\/([^/]+)\/release$/.exec(url.pathname);
    if (request.method === 'POST' && release) {
      // Changes nothing but what the list tells, as the demo's phone has no app to tell.
      this.released.set(decodeURIComponent(release[1]), now + RELEASE_SECONDS);
      return respond(request, null);
    }
    if (request.method === 'POST' && url.pathname === '/api/backup') {
      return fail(request, 403, { problem: 'demoBackup' });
    }
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      return fail(request, 403, { problem: 'demo' });
    }
    if (!machine) {
      return fail(request, 404, 'unknown device');
    }
    const from = Number(url.searchParams.get('from'));
    const to = Number(url.searchParams.get('to'));
    if (machine.device.pairing) {
      return this.waitingForCode(request, url.pathname, machine, from, to, now);
    }
    switch (url.pathname) {
      case '/api/metrics':
        return isOnline(machine, now)
          ? respond(request, snapshotOf(machine, Math.floor(now), this.version))
          : fail(request, 503, 'the device has not answered recently');
      case '/api/history':
        return respond(request, historyEndingAtLastReading(machine, from, to, now));
      case '/api/history.csv': {
        const h = historyEndingAtLastReading(machine, from, to, now);
        return respondWithFile(
          request,
          new Blob([historyCsv(h.series)], { type: 'text/csv;charset=utf-8' }),
          csvFileName(machine.device.name, h.from, h.to),
        );
      }
      case '/api/events':
        return respond(request, demoEvents(machine, from, to, now, this.version));
      case '/api/availability':
        return respond(request, availability(machine, now));
      default:
        // No /api/update: the demo names no newer release.
        return fail(request, 404, 'not found');
    }
  }

  /**
   * The answers for a device that waits for its pairing code: it answers the hub, so its
   * availability is full, but the hub has no usage and no history of it.
   */
  private waitingForCode(
    request: HttpRequest<unknown>,
    path: string,
    machine: DemoMachine,
    from: number,
    to: number,
    now: number,
  ): Observable<HttpEvent<unknown>> {
    switch (path) {
      case '/api/history':
        return respond(request, {
          from,
          to,
          stepSeconds: RECENT_INTERVAL,
          retentionDays: DEMO_RETENTION_DAYS,
          series: [],
        } satisfies History);
      case '/api/events':
        return respond(request, demoEvents(machine, from, to, now, this.version));
      case '/api/availability':
        return respond(request, availability(machine, now));
      default:
        return fail(request, 503, 'the device waits for its pairing code');
    }
  }

  /**
   * GET and PUT /api/layout: the demo has no host, so the layout is kept in the visitor's browser,
   * where it lasts as long as on a real hub for that visitor.
   */
  private layout(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    try {
      // Reading localStorage itself throws where site data is blocked.
      const storage = this.window?.localStorage;
      if (request.method === 'PUT') {
        storage?.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(request.body));
        return respond(request, null);
      }
      const stored = storage?.getItem(LAYOUT_STORAGE_KEY);
      return respond(request, stored ? (JSON.parse(stored) as unknown) : EMPTY_LAYOUT);
    } catch {
      // Without storage (a private window, blocked site data) the layout lasts for this visit.
      return fail(request, 500, 'could not keep the layout');
    }
  }
}

/** How long a phone may change its hub once it was let, as on a hub. */
const RELEASE_SECONDS = 10 * 60;

function deviceList(now: number, released: ReadonlyMap<string, number>): DeviceList {
  const alerts = fleetAlerts(Math.floor(now));
  return {
    devices: FLEET.map((m) => {
      const active = alerts.get(m.device.id) ?? [];
      const until = released.get(m.device.id) ?? 0;
      return {
        ...m.device,
        ...(active.length > 0 && { alerts: active }),
        ...(until > now && { releasedUntil: new Date(until * 1000).toISOString() }),
      };
    }),
    passwordSet: true,
    pagePort: '9393',
  };
}

function isOnline(machine: DemoMachine, t: number): boolean {
  return machine.online?.(t) ?? true;
}

/**
 * The history as the backend answers it: for a device that is not answering,
 * a range ending after its last reading is moved back to end there.
 */
export function historyEndingAtLastReading(
  machine: DemoMachine,
  from: number,
  to: number,
  now: number,
): History {
  if (!machine.online || isOnline(machine, now)) {
    return history(machine, from, to);
  }
  const last = lastReading(machine.online, now);
  if (last + 1 >= to) {
    return { ...history(machine, from, to), lastReading: last };
  }
  const end = last + 1;
  return { ...history(machine, end - (to - from), end), lastReading: last };
}

/** The newest moment, in steps of the 5 second readings, a device that is offline now answered. */
function lastReading(online: (t: number) => boolean, now: number): number {
  let t = Math.floor(offlineSince(online, now) / RECENT_INTERVAL) * RECENT_INTERVAL;
  while (!online(t) && t > now - 8 * 86400) {
    t -= RECENT_INTERVAL;
  }
  return t;
}

/** The averages from `from` up to `to` in the steps the backend would use. */
export function history(machine: DemoMachine, from: number, to: number): History {
  const span = Math.max(1, to - from);
  const interval = span <= RECENT_SPAN ? RECENT_INTERVAL : SAMPLE_INTERVAL;
  let step = Math.max(1, Math.ceil(span / interval / MAX_POINTS)) * interval;
  if (step > 20 * 60) {
    step = Math.ceil(step / 3600) * 3600;
  }
  const oldest = Math.max(from, to - DEMO_RETENTION_DAYS * 86400);
  const points = new Map<string, { time: number; value: number }[]>();
  // A long step averages several moments, like the backend's averages smooth out short peaks.
  const samples = Math.min(8, Math.max(1, Math.round(step / RECENT_INTERVAL)));
  for (let start = Math.ceil(oldest / step) * step; start < to; start += step) {
    const moments = Array.from(
      { length: samples },
      (_, i) => start + ((i + 0.5) * step) / samples,
    ).filter((t) => t <= to && isOnline(machine, t));
    if (moments.length === 0) {
      continue;
    }
    const totals = new Map<string, number>();
    for (const t of moments) {
      for (const [metric, value] of Object.entries(machine.values(t, step))) {
        totals.set(metric, (totals.get(metric) ?? 0) + value);
      }
    }
    for (const [metric, total] of totals) {
      const line = points.get(metric) ?? [];
      line.push({ time: start, value: total / moments.length });
      points.set(metric, line);
    }
  }
  // Like the backend, only extras that ask for it keep their history.
  const extras = extraInfoOf(machine);
  const series: Series[] = [...points]
    .filter(([metric]) => !metric.startsWith('extra:') || metric in extras)
    .map(([metric, values]) => ({ metric, points: values }));
  return {
    from,
    to,
    stepSeconds: step,
    retentionDays: DEMO_RETENTION_DAYS,
    series,
    ...(machine.extras ? { extras } : {}),
  };
}

/**
 * Every device was added 60 days ago; only the laptop that sleeps at night was ever off, which
 * the page shows as the time it was not in use, since it is a PC.
 */
function availability(machine: DemoMachine, now: number): Availability {
  const since = now - 60 * 86400;
  const kind = machine.device.kind ?? 'server';
  const online = machine.online;
  if (!online) {
    return { kind, since: iso(since), countedSince: iso(since), offlineSeconds: 0, outages: 0 };
  }
  let offlineSeconds = 0;
  let outages = 0;
  let wasOnline = true;
  for (let t = since; t < now; t += 300) {
    const answered = online(t);
    if (!answered) {
      offlineSeconds += 300;
      outages += wasOnline ? 1 : 0;
    }
    wasOnline = answered;
  }
  return {
    kind,
    since: iso(since),
    countedSince: iso(since),
    offlineSeconds,
    outages,
    lastOutage: { start: iso(offlineSince(online, now)), end: iso(now) },
  };
}

function iso(t: number): string {
  return new Date(t * 1000).toISOString();
}

/**
 * The history as GET /api/history.csv answers it: a header with "time" and each metric, then a
 * row for each time, in ISO 8601 UTC, with an empty cell where a metric has no value then.
 */
export function historyCsv(series: Series[]): string {
  const values = series.map((s) => new Map(s.points.map((p) => [p.time, p.value])));
  const times = [...new Set(series.flatMap((s) => s.points.map((p) => p.time)))].sort(
    (a, b) => a - b,
  );
  const rows = [
    ['time', ...series.map((s) => textCell(s.metric))],
    ...times.map((t) => [
      new Date(t * 1000).toISOString().replace('.000Z', 'Z'),
      ...values.map((v) => (v.has(t) ? String(v.get(t)) : '')),
    ]),
  ];
  return rows.map((row) => row.map(quoted).join(',') + '\r\n').join('');
}

/** A text cell a spreadsheet does not take for a formula, like the backend writes it. */
function textCell(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function quoted(cell: string): string {
  return /[",\r\n]/.test(cell) || cell.startsWith(' ') ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/** The name the backend gives the file, such as "Linux-NAS-20261013T120000Z-20261013T130000Z.csv". */
export function csvFileName(name: string, from: number, to: number): string {
  const clean =
    name.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[-.]+|[-.]+$/g, '') || 'den-watcher';
  const stamp = (t: number) =>
    new Date(t * 1000)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z');
  return `${clean}-${stamp(from)}-${stamp(to)}.csv`;
}

function respondWithFile(
  request: HttpRequest<unknown>,
  file: Blob,
  name: string,
): Observable<HttpEvent<Blob>> {
  const headers = new HttpHeaders({
    'Content-Type': file.type,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
  });
  return of(new HttpResponse({ body: file, headers, status: 200, url: request.url })).pipe(
    delay(LATENCY_MS),
  );
}

function respond<T>(request: HttpRequest<unknown>, body: T): Observable<HttpEvent<T>> {
  return of(new HttpResponse({ body, status: 200, url: request.url })).pipe(delay(LATENCY_MS));
}

function fail(request: HttpRequest<unknown>, status: number, error: unknown): Observable<never> {
  // delay() lets errors through at once, so the error is thrown after a timer instead.
  return timer(LATENCY_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ error, status, url: request.url }))),
  );
}
