package den.watcher

import android.content.Context

/**
 * What the hub app keeps of its hub: whether it should run, which the user
 * switches, and how it went, which HubService writes for the screen, as the
 * screen does not ask the hub itself.
 */
class HubState(context: Context) {
    private val prefs = context.getSharedPreferences("hub", Context.MODE_PRIVATE)

    /** Whether the hub should run, also after a restart; on until switched off. */
    var wanted: Boolean
        get() = prefs.getBoolean(WANTED, true)
        set(value) = prefs.edit().putBoolean(WANTED, value).apply()

    /** Whether the hub runs, as HubService last saw. */
    var running: Boolean
        get() = prefs.getBoolean(RUNNING, false)
        set(value) = prefs.edit().putBoolean(RUNNING, value).apply()

    /** Why the hub stopped or could not start, or empty. */
    var failure: String
        get() = prefs.getString(FAILURE, "") ?: ""
        set(value) = prefs.edit().putString(FAILURE, value).apply()

    private companion object {
        const val WANTED = "wanted"
        const val RUNNING = "running"
        const val FAILURE = "failure"
    }
}
