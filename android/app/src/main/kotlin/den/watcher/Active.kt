package den.watcher

import android.content.Context

/**
 * Active tracking, which the user switches on in the app's Battery card and
 * which is off until then: the app asks Android for a GPS position and scans
 * the Wi-Fi networks nearby every EVERY_MILLIS, also while the phone stands
 * still (see Still), instead of a position from the mobile and Wi-Fi networks
 * and a scan every 5 minutes. It costs noticeably more battery, so Save
 * battery and Android's battery saver pause it. Never locked by the hub, as
 * Save battery is not either.
 */
object Active {
    /**
     * How often the app asks for a position and a scan while tracking
     * actively: about every reading with the screen off, and within the 4
     * scans in 2 minutes Android allows an app in front.
     */
    const val EVERY_MILLIS = 60_000L

    /** Whether the app tracks actively now: switched on, and not saving battery. */
    fun on(context: Context): Boolean = Settings(context).activeTracking && !Saving.on(context)

    /** How often the app asks for its own scan and position, tracking actively or not, as the phone stands still or not. */
    fun every(active: Boolean, still: Boolean): Long = if (active) EVERY_MILLIS else Still.every(still)
}
