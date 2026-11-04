package den.watcher

import android.content.Context
import android.os.PowerManager

/**
 * Whether the app saves battery: when the user switched Save battery on,
 * which the hub never locks, or while Android's own battery saver is on.
 * It then makes no Wi-Fi scans of its own, the costliest thing it does, and
 * while the screen is off takes a reading every SAVING_INTERVAL_MILLIS
 * instead of every half minute, as each reading wakes the phone.
 */
object Saving {
    /** How often a reading is taken while saving battery with the screen off. */
    const val SAVING_INTERVAL_MILLIS = 5 * 60_000L

    /** Whether the app saves battery now. */
    fun on(context: Context): Boolean =
        Settings(context).saveBattery || context.getSystemService(PowerManager::class.java)?.isPowerSaveMode == true

    /** How long until the next reading, given how often one is taken normally. */
    fun interval(context: Context, normalMillis: Long): Long {
        val interactive = context.getSystemService(PowerManager::class.java)?.isInteractive != false
        return if (on(context) && !interactive) maxOf(normalMillis, SAVING_INTERVAL_MILLIS) else normalMillis
    }
}
