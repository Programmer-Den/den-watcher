import { formatNumber } from '@angular/common';

import { I18n } from '../i18n/i18n';
import { formatBytes } from './bytes.pipe';
import { LoadAverage, Snapshot } from './metrics';

/** How much of a total is used, such as "2.8 GiB of 8.0 GiB". */
export function usedOfTotal(usedBytes: number, totalBytes: number, i18n: I18n): string {
  const language = i18n.language();
  return i18n.t('dashboard.usedOfTotal', {
    used: formatBytes(usedBytes, language),
    total: formatBytes(totalBytes, language),
  });
}

/** The cores of a CPU and its clock where the OS reports it, such as "4 cores · 1.2 GHz". */
export function cpuDetail(cpu: Snapshot['cpu'], i18n: I18n): string {
  const cores = i18n.plural(cpu.cores, 'dashboard.cores.one', 'dashboard.cores.other');
  return cpu.clockMHz
    ? `${cores} · ${formatNumber(cpu.clockMHz / 1000, i18n.language(), '1.1-1')} GHz`
    : cores;
}

/** The load average over 1, 5 and 15 minutes, such as "Load 0.34 · 0.34 · 0.33". */
export function loadAverageText(load: LoadAverage, i18n: I18n): string {
  const number = (value: number) => formatNumber(value, i18n.language(), '1.2-2');
  return i18n.t('dashboard.loadAverage', {
    one: number(load.one),
    five: number(load.five),
    fifteen: number(load.fifteen),
  });
}

/** An uptime as the page shows it: days and hours, or hours and minutes below a day. */
export function formatUptime(seconds: number, i18n: I18n): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0
    ? i18n.t('dashboard.uptimeDays', { days, hours })
    : i18n.t('dashboard.uptimeHours', { hours, minutes });
}

/** A length of time: seconds below a minute, minutes below an hour, else as an uptime. */
export function formatDuration(seconds: number, i18n: I18n): string {
  // Rounded first, so 59.6 s is a minute rather than 60 s.
  const rounded = Math.round(seconds);
  if (rounded < 60) {
    return i18n.t('dashboard.seconds', { seconds: rounded });
  }
  if (rounded < 3600) {
    return i18n.t('dashboard.minutes', { minutes: Math.floor(rounded / 60) });
  }
  return formatUptime(rounded, i18n);
}
