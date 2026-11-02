import { PhoneUsage } from '../app/metrics/metrics';
import { drift } from './fleet';

/** The demo's phone, the only device that tells how its apps were used. */
export const DEMO_PHONE = 'android-phone';

/** An app on the demo's phone, how much of the screen time it takes and how long one use lasts. */
interface DemoApp {
  app: string;
  label: string;
  weight: number;
  useSeconds: number;
}

const APPS: DemoApp[] = [
  { app: 'org.mozilla.firefox', label: 'Firefox', weight: 26, useSeconds: 420 },
  { app: 'org.thoughtcrime.securesms', label: 'Signal', weight: 18, useSeconds: 90 },
  { app: 'org.schabi.newpipe', label: 'NewPipe', weight: 14, useSeconds: 900 },
  { app: 'com.google.android.apps.maps', label: 'Maps', weight: 9, useSeconds: 300 },
  { app: 'com.fsck.k9', label: 'K-9 Mail', weight: 8, useSeconds: 120 },
  { app: 'org.fossify.camera', label: 'Camera', weight: 5, useSeconds: 60 },
  { app: 'de.danoeh.antennapod', label: 'AntennaPod', weight: 5, useSeconds: 180 },
  { app: 'org.fossify.calendar', label: 'Calendar', weight: 4, useSeconds: 45 },
  { app: 'com.android.settings', label: 'Settings', weight: 3, useSeconds: 60 },
  { app: 'org.breezyweather', label: 'Breezy Weather', weight: 3, useSeconds: 30 },
  { app: 'den.watcher', label: 'Den-Watcher', weight: 1, useSeconds: 40 },
];

/** About how many minutes of each hour of the day the phone is in use, from midnight on. */
const MINUTES_BY_HOUR = [
  2, 0, 0, 0, 0, 0, 3, 14, 12, 6, 5, 5, 16, 9, 5, 5, 6, 10, 15, 22, 26, 24, 16, 8,
];

/**
 * What GET /api/phone/usage answers in the demo for the phone, from `from` to `to` in Unix
 * seconds, as a hub keeps it: made-up uses in each hour, more in the evening and at lunch, none at
 * night, and the same for the same hour on every visit.
 */
export function demoPhoneUsage(from: number, to: number): PhoneUsage {
  const stepSeconds = Math.max(1, Math.ceil((to - from) / 200 / 3600)) * 3600;
  const steps = new Map<number, { time: number; screenSeconds: number; unlocks?: number }>();
  const apps = new Map(
    APPS.map((a) => [a.app, { app: a.app, label: a.label, seconds: 0, opens: 0 }]),
  );
  let screenSeconds = 0;
  let unlocks = 0;
  for (let hour = Math.floor(from / 3600) * 3600; hour < to; hour += 3600) {
    // The part of the hour that is in the range, as for the hour still going on.
    const part = Math.max(0, Math.min(hour + 3600, to) - Math.max(hour, from)) / 3600;
    const minutes =
      MINUTES_BY_HOUR[new Date(hour * 1000).getHours()] * (1 + 0.5 * drift(hour, 3600, 311));
    const seconds = Math.max(0, minutes * 60 * part);
    if (seconds < 30) {
      continue;
    }
    const time = Math.floor(hour / stepSeconds) * stepSeconds;
    const step = steps.get(time) ?? { time, screenSeconds: 0 };
    steps.set(time, step);
    const hourUnlocks = Math.max(1, Math.round(seconds / 240 + 2 * drift(hour, 3600, 312)));
    step.screenSeconds += seconds;
    step.unlocks = (step.unlocks ?? 0) + hourUnlocks;
    screenSeconds += seconds;
    unlocks += hourUnlocks;
    // Each app's share of the hour moves a little from hour to hour.
    const weights = APPS.map((a, i) => a.weight * (1 + 0.6 * drift(hour, 3600, 320 + i)));
    const total = weights.reduce((sum, w) => sum + w, 0);
    APPS.forEach((a, i) => {
      const appSeconds = (seconds * weights[i]) / total;
      if (appSeconds < 5) {
        return;
      }
      const app = apps.get(a.app)!;
      app.seconds += appSeconds;
      app.opens += Math.max(1, Math.round(appSeconds / a.useSeconds));
    });
  }
  return {
    from,
    to,
    stepSeconds,
    screenSeconds,
    unlocks,
    steps: [...steps.values()].sort((a, b) => a.time - b.time),
    apps: [...apps.values()].filter((a) => a.seconds > 0).sort((a, b) => b.seconds - a.seconds),
  };
}
