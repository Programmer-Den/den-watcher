package den.watcher

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Starts the hub again after the device started or the app was updated, unless it was switched off. */
class HubBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (HubState(context).wanted) {
            HubService.start(context)
        }
    }
}
