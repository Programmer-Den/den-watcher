import { Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';

import {
  PasswordDialog,
  PasswordDialogData,
  PasswordDialogResult,
} from '../devices/password-dialog';

/**
 * Asks for the password to change the hub, as for deleting a day of a phone's route. Loaded only
 * when it is needed, so the dialog's parts do not slow down the page.
 */
export function askPassword(
  injector: Injector,
  data: PasswordDialogData,
): Observable<PasswordDialogResult | undefined> {
  return injector
    .get(MatDialog)
    .open<PasswordDialog, PasswordDialogData, PasswordDialogResult>(PasswordDialog, {
      data,
      injector,
    })
    .afterClosed();
}
