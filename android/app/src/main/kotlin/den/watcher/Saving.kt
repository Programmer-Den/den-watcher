package den.watcher

import android.content.Context
import android.os.PowerManager

/**
 * How often the app takes a reading, as each one wakes the phone: every half
 * minute while the screen is on, every SCREEN_OFF_INTERVAL_MILLIS while it is
 * off, and every SAVING_INTERVAL_MILLIS while it is off and the app saves
 * battery: when the user switched Save battery on, which the hub never locks,
 * or while Android's own battery saver is on. While saving, it also makes no
 * Wi-Fi scans of its own, the costliest thing it does.
 */
object Saving {
    /**
     * How often a reading is taken while the screen is off: often enough for
     * the hub to see the phone as within reach, as it pushes about as often.
     */
    const val SCREEN_OFF_INTERVAL_MILLIS = 60_000L

    /** How often a reading is taken while saving battery with the screen off. */
    const val SAVING_INTERVAL_MILLIS = 5 * 60_000L

    /** Whether the app saves battery now. */
    fun on(context: Context): Boolean =
        Settings(context).saveBattery || context.getSystemService(PowerManager::class.java)?.isPowerSaveMode == true

    /** How long until the next reading, given how often one is taken normally. */
    fun interval(context: Context, normalMillis: Long): Long {
        val interactive = context.getSystemService(PowerManager::class.java)?.isInteractive != false
        return when {
            interactive -> normalMillis
            on(context) -> maxOf(normalMillis, SAVING_INTERVAL_MILLIS)
            else -> maxOf(normalMillis, SCREEN_OFF_INTERVAL_MILLIS)
        }
    }
}
