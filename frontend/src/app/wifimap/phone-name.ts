import { Device, deviceName } from '../devices/devices';
import { I18n } from '../i18n/i18n';

/**
 * The id the hub keeps a removed phone's route and Wi-Fi under, which tells nothing of the phone
 * (see history.RemovedPhonePrefix in the backend).
 */
export const REMOVED_PHONE_PREFIX = 'removed:';

/** The name of a phone that heard a network: its own, "A removed phone", or its id once removed. */
export function phoneName(id: string, devices: readonly Device[], i18n: I18n): string {
  if (id.startsWith(REMOVED_PHONE_PREFIX)) {
    return i18n.t('wifiMap.removedPhone');
  }
  const device = devices.find((d) => d.id === id);
  return device ? deviceName(device, i18n) : id;
}
