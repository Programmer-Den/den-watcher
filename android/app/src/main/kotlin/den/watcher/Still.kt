package den.watcher

/**
 * Whether the phone stands still, so the app asks for its own Wi-Fi scans
 * and positions only every STILL_EVERY_MILLIS instead of every
 * Nearby.SCAN_EVERY_MILLIS: at a desk or at night they would find the same
 * networks and the same place again and again. It tells from what the app
 * reads anyway: the last two scans kept saw the same access points, the
 * step counter counted no more than MAX_STEPS since the app last asked, and
 * the phone is on the same Wi-Fi as then (mobile data tells nothing, as in a
 * car or a train). Any of them that is not known (no scans, no step counter,
 * no Wi-Fi) is left out; with none known the phone does not count as still.
 * Steps or another Wi-Fi show at the next reading, half a minute or a minute
 * later, and the app then asks at once and at the usual pace again; a scan
 * that saw other access points does the same.
 */
object Still {
    /** How often the app asks for its own scan and position while the phone stands still. */
    const val STILL_EVERY_MILLIS = 20 * 60_000L

    /** The most steps since the app last asked that still count as standing still, as walking around a room. */
    const val MAX_STEPS = 50L

    /** The least share of the access points of the smaller scan that the other one also saw, for one place. */
    const val MIN_SHARED = 0.5

    /** Whether two scans, by the access points each saw, were made at the same place; null when either saw none. */
    fun samePlace(a: Set<String>, b: Set<String>): Boolean? {
        if (a.isEmpty() || b.isEmpty()) {
            return null
        }
        return (a intersect b).size >= MIN_SHARED * minOf(a.size, b.size)
    }

    /**
     * Whether the phone stands still: wifi tells whether the last two scans
     * were made at the same place, steps and stepsAtAsk are the step
     * counter's value now and when the app last asked, network and
     * networkAtAsk the Wi-Fi the phone is connected to now and then; each
     * null when not known. A counter lower than before, as after a restart,
     * tells nothing.
     */
    fun isStill(wifi: Boolean?, steps: Long?, stepsAtAsk: Long?, network: String?, networkAtAsk: String?): Boolean {
        val signs = listOfNotNull(
            wifi,
            if (steps != null && stepsAtAsk != null && steps >= stepsAtAsk) steps - stepsAtAsk <= MAX_STEPS else null,
            if (network != null || networkAtAsk != null) network == networkAtAsk else null,
        )
        return signs.isNotEmpty() && signs.all { it }
    }

    /** The access points a scan saw, by their hashes as the hub has them, which tell its place. */
    fun place(scan: Scan): Set<String> = scan.accessPoints.mapNotNull { point -> Nearby.addressBytes(point.bssid)?.let(Nearby::hash) }.toSet()

    /** How often the app asks for its own scan and position, as the phone stands still or not. */
    fun every(still: Boolean): Long = if (still) STILL_EVERY_MILLIS else Nearby.SCAN_EVERY_MILLIS
}
