package den.watcher

import android.content.Context
import android.net.wifi.SupplicantState
import android.net.wifi.WifiManager
import org.json.JSONObject

/**
 * One time the phone was connected to the Wi-Fi named ssid, from start to
 * end, in Unix milliseconds on the phone's clock: from the first reading
 * that found it connected to the last one that did.
 */
data class Connection(val ssid: String, val start: Long, val end: Long) {
    /** The connection as the hub takes it, with the phone's number for it, open while it goes on. */
    fun json(id: Long, open: Boolean): JSONObject = JSONObject().apply {
        put("id", id)
        put("ssid", ssid)
        put("start", start)
        put("end", end)
        if (open) put("open", true)
    }
}

/**
 * Which Wi-Fi the phone is connected to, read at every reading, so the hub
 * can tell which networks it was on during the day and when. Android tells
 * the Wi-Fi's name only with the location permission, the same one the
 * networks nearby need.
 */
object WifiLog {
    /**
     * The longest time between two readings that found the phone on the
     * same Wi-Fi for it to count as connected all along: more than Android
     * lets the app sleep in deep sleep, about 9 minutes. After a longer gap,
     * as when the phone was off, the connection starts anew.
     */
    const val MAX_GAP_MILLIS = 20 * 60_000L

    /** How often a connection that goes on is sent again with its new end, so the hub shows it as it goes. */
    const val RESEND_MILLIS = 5 * 60_000L

    /** The longest name of a Wi-Fi, in bytes, as 802.11 allows. */
    private const val MAX_SSID_BYTES = 32

    /**
     * The name of the Wi-Fi the phone is connected to, or null when it is on
     * none, Android does not tell it, or the app may not read it.
     */
    fun connected(context: Context): String? {
        if (!Nearby.allowed(context)) {
            return null
        }
        val wifi = context.getSystemService(WifiManager::class.java) ?: return null
        @Suppress("DEPRECATION")
        val info = runCatching { wifi.connectionInfo }.getOrNull() ?: return null
        if (info.supplicantState != SupplicantState.COMPLETED) {
            return null
        }
        return name(info.ssid)
    }

    /**
     * The Wi-Fi's name as Android tells it, "Home" in quotes, or null for
     * none, the name Android gives when it does not tell it, or one longer
     * than a Wi-Fi's can be. A name Android tells in hex, as one that is no
     * text, is kept as it is.
     */
    fun name(ssid: String?): String? {
        val name = ssid?.trim()?.removeSurrounding("\"") ?: return null
        if (name.isEmpty() || name == WifiManager.UNKNOWN_SSID || name == "<unknown ssid>" ||
            name.toByteArray(Charsets.UTF_8).size > MAX_SSID_BYTES * 2
        ) {
            return null
        }
        return name
    }

    /**
     * What a reading at now that found the phone on the Wi-Fi ssid (null for
     * none) makes of the connection still open: whether that one is over,
     * and the connection open from then on. The same Wi-Fi found again
     * within MAX_GAP_MILLIS goes on with the same connection; another one,
     * none, a longer gap or a clock that went back ends it.
     */
    fun follow(open: Connection?, ssid: String?, now: Long): Followed {
        if (open != null && ssid == open.ssid && now >= open.end && now - open.end <= MAX_GAP_MILLIS) {
            return Followed(closed = false, open = open.copy(end = now))
        }
        return Followed(closed = open != null, open = ssid?.let { Connection(it, now, now) })
    }

    /** What follow makes of the open connection. */
    data class Followed(val closed: Boolean, val open: Connection?)
}
