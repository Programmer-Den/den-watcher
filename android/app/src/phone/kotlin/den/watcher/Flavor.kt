package den.watcher

import android.app.Activity

/**
 * What the app adds to the main screen besides recording: nothing in the
 * phone app. The hub app has its own Flavor (src/hub), which adds its hub.
 */
object Flavor {
    /** Called by MainActivity after it set up its screen. */
    fun onCreate(activity: Activity) {}

    /** Called by MainActivity each time it shows its status again. */
    fun onShow(activity: Activity) {}
}
