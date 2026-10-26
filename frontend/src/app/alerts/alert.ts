/** How serious an alert is: a warning to keep an eye on, or an alert that needs action. */
export type AlertLevel = 'warning' | 'alert';

/** What an alert is about; a newer backend may name kinds this page does not know yet. */
export type AlertKind =
  | 'offline'
  | 'disk'
  | 'memory'
  | 'cpu'
  | 'temperature'
  | 'throttling'
  | 'smart'
  | 'wifi-lookalike';

/** A value of a device that needed attention, as GET /api/devices and GET /api/alerts serve it. */
export interface Alert {
  id: number;
  device: string;
  deviceName: string;
  kind: AlertKind;
  /** What in the device it is about, such as the disk "/" or a temperature sensor. */
  subject?: string;
  /** The highest level it reached. */
  level: AlertLevel;
  /** The highest value it reached: percent, or °C for a temperature. */
  value?: number;
  /** When it started, as an ISO time. */
  started: string;
  /** When it ended, as an ISO time; missing while it lasts. */
  ended?: string;
}
