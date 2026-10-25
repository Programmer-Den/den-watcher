package den.watcher

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Starts recording again when the phone starts, or the app was updated, if it was switched on. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) {
            return
        }
        if (Settings(context).recording) {
            SyncJob.schedule(context)
            runCatching { RecorderService.start(context) }
        }
    }
}
