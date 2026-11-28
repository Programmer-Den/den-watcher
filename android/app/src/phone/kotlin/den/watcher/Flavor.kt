package den.watcher

import android.app.Activity
import android.content.Context

/**
 * What the app adds to the main screen besides recording: nothing in the
 * phone app. The hub app has its own Flavor (src/hub), which adds its hub.
 */
object Flavor {
    /** Called by MainActivity after it set up its screen. */
    fun onCreate(activity: Activity) {}

    /** Called by MainActivity each time it shows its status again. */
    fun onShow(activity: Activity) {}

    /** Called by Recorder with each reading, to add what the app reads beyond Sampler: nothing here. */
    fun read(context: Context, reading: Reading): Reading = reading
}
