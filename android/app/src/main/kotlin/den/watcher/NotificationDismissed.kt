package den.watcher

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Puts the recording notification back when the user swipes it away, which
 * Android allows from version 14 on, even for an ongoing notification of a
 * service that keeps running. Posted again with the service's ID, it is the
 * service's notification once more. Not once recording is stopped, when
 * the notification is gone with the service.
 */
class NotificationDismissed : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!Settings(context).recording) {
            return
        }
        context.getSystemService(NotificationManager::class.java)
            .notify(RecorderService.NOTIFICATION_ID, RecorderService.notification(context))
    }
}
