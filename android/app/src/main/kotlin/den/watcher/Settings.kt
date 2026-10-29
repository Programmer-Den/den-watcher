package den.watcher

import android.content.Context
import org.json.JSONObject

/** What the app keeps between starts: its pairing code, the hub's address and how the last push went. */
class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    /**
     * The phone's pairing code, made the first time it is asked for. Every
     * Settings shares one lock for it, so the screen and the recorder never
     * make two codes at once.
     */
    val code: String
        get() {
            synchronized(codeLock) {
                val kept = prefs.getString(CODE, null)
                if (kept != null && PairingCode.isValid(kept)) {
                    return kept
                }
                val code = PairingCode.generate()
                prefs.edit().putString(CODE, code).apply()
                return code
            }
        }

    /** The hub's address as host:port, as scanned from its page; empty until it is. */
    var hubAddress: String
        get() = prefs.getString(HUB_ADDRESS, "") ?: ""
        set(value) = prefs.edit().putString(HUB_ADDRESS, value.trim()).apply()

    /**
     * Whether the hub at hubAddress took a push. From then on the app keeps
     * the hub's address and recording locked until the hub allows a change,
     * so whoever has the phone cannot move it to another hub or stop it.
     */
    var paired: Boolean
        get() = prefs.getBoolean(PAIRED, false)
        set(value) = prefs.edit().putBoolean(PAIRED, value).apply()

    /**
     * The phone's key, in hex, that the hub at hubAddress gave it with its
     * first push and proves an allowed change with (see Release); empty
     * until then. It is never shown, unlike the pairing code.
     */
    var hubKey: String
        get() = prefs.getString(HUB_KEY, "") ?: ""
        set(value) = prefs.edit().putString(HUB_KEY, value).apply()

    /** Until when the hub allows a change, in Unix seconds; 0 when it never did. */
    var releasedUntil: Long
        get() = prefs.getLong(RELEASED_UNTIL, 0)
        set(value) = prefs.edit().putLong(RELEASED_UNTIL, value).apply()

    /**
     * When the push was sent whose answer allowed the change, in Unix seconds;
     * a proof for that push or an earlier one allows nothing again.
     */
    var releasedAt: Long
        get() = prefs.getLong(RELEASED_AT, 0)
        set(value) = prefs.edit().putLong(RELEASED_AT, value).apply()

    /**
     * Whether changing the hub or stopping recording waits for the hub to
     * allow it, at now; also when the clock was set back to before the hub
     * allowed it.
     */
    fun locked(now: Long = System.currentTimeMillis() / 1000): Boolean =
        paired && (now >= releasedUntil || now < releasedAt)

    /** Whether recording was switched on, so it starts again with the phone. */
    var recording: Boolean
        get() = prefs.getBoolean(RECORDING, false)
        set(value) = prefs.edit().putBoolean(RECORDING, value).apply()

    /** When the hub last took a push, in Unix seconds; 0 when it never did. */
    var lastPush: Long
        get() = prefs.getLong(LAST_PUSH, 0)
        set(value) = prefs.edit().putLong(LAST_PUSH, value).apply()

    /** Why the last push failed, or null when it worked or none was tried. */
    var problem: Problem?
        get() = prefs.getString(PROBLEM, null)?.let { runCatching { Problem.valueOf(it) }.getOrNull() }
        set(value) = prefs.edit().putString(PROBLEM, value?.name).apply()

    /**
     * The networks the hub is usually reached on, as Networks names them: the
     * first one it is reached on, and the ones confirmed in the app since.
     * Emptied when another hub address is saved.
     */
    var usualNetworks: Set<String>
        get() = prefs.getStringSet(USUAL_NETWORKS, null)?.toSet() ?: emptySet()
        set(value) = prefs.edit().putStringSet(USUAL_NETWORKS, value).apply()

    /** The network the hub was last reached on when that was not a usual one, or null. */
    var otherNetwork: String?
        get() = prefs.getString(OTHER_NETWORK, null)
        set(value) = prefs.edit().putString(OTHER_NETWORK, value).apply()

    /** Which data the app collects, as chosen on its screen; all of it until something is switched off. */
    var dataChoice: DataChoice
        get() = DataChoice(
            system = prefs.getBoolean(COLLECT_SYSTEM, true),
            battery = prefs.getBoolean(COLLECT_BATTERY, true),
            memory = prefs.getBoolean(COLLECT_MEMORY, true),
            storage = prefs.getBoolean(COLLECT_STORAGE, true),
            network = prefs.getBoolean(COLLECT_NETWORK, true),
            traffic = prefs.getBoolean(COLLECT_TRAFFIC, true),
            nearby = prefs.getBoolean(COLLECT_NEARBY, true),
        )
        set(value) = prefs.edit()
            .putBoolean(COLLECT_SYSTEM, value.system)
            .putBoolean(COLLECT_BATTERY, value.battery)
            .putBoolean(COLLECT_MEMORY, value.memory)
            .putBoolean(COLLECT_STORAGE, value.storage)
            .putBoolean(COLLECT_NETWORK, value.network)
            .putBoolean(COLLECT_TRAFFIC, value.traffic)
            .putBoolean(COLLECT_NEARBY, value.nearby)
            .apply()

    /** When the newest scan of the networks nearby that was kept was made, in Unix seconds. */
    var lastScan: Long
        get() = prefs.getLong(LAST_SCAN, 0)
        set(value) = prefs.edit().putLong(LAST_SCAN, value).apply()

    /** The reading before the newest, whose traffic the speeds are measured from. */
    var lastReading: Reading?
        get() = prefs.getString(LAST_READING, null)?.let { runCatching { readingFrom(JSONObject(it)) }.getOrNull() }
        set(value) = prefs.edit().putString(LAST_READING, value?.let { readingTo(it).toString() }).apply()

    private fun readingTo(r: Reading): JSONObject = JSONObject()
        .put("time", r.time)
        .put("uptime", r.uptimeSeconds)
        .put("boot", r.boot)
        .put("traffic", JSONObject().apply { r.traffic.forEach { (name, t) -> put(name, JSONObject().put("received", t.received).put("sent", t.sent)) } })

    private fun readingFrom(o: JSONObject): Reading {
        val traffic = o.getJSONObject("traffic")
        return Reading(
            time = o.getLong("time"),
            uptimeSeconds = o.getLong("uptime"),
            boot = o.optInt("boot"),
            batteryPercent = null,
            pluggedIn = false,
            batteryCelsius = null,
            memoryTotalBytes = 0,
            memoryAvailableBytes = 0,
            storageTotalBytes = 0,
            storageFreeBytes = 0,
            traffic = traffic.keys().asSequence().associateWith {
                val t = traffic.getJSONObject(it)
                Traffic(t.getLong("received"), t.getLong("sent"))
            },
        )
    }

    private companion object {
        val codeLock = Any()

        const val CODE = "code"
        const val HUB_ADDRESS = "hubAddress"
        const val RECORDING = "recording"
        const val PAIRED = "paired"
        const val RELEASED_UNTIL = "releasedUntil"
        const val RELEASED_AT = "releasedAt"
        const val HUB_KEY = "hubKey"
        const val LAST_PUSH = "lastPush"
        const val PROBLEM = "problem"
        const val LAST_READING = "lastReading"
        const val USUAL_NETWORKS = "usualNetworks"
        const val OTHER_NETWORK = "otherNetwork"
        const val LAST_SCAN = "lastScan"
        const val COLLECT_SYSTEM = "collectSystem"
        const val COLLECT_BATTERY = "collectBattery"
        const val COLLECT_MEMORY = "collectMemory"
        const val COLLECT_STORAGE = "collectStorage"
        const val COLLECT_NETWORK = "collectNetwork"
        const val COLLECT_TRAFFIC = "collectTraffic"
        const val COLLECT_NEARBY = "collectNearby"
    }
}

/** Why a push did not reach the hub, as the app tells it. */
enum class Problem {
    /** No hub address was scanned, or it is no address. */
    NO_ADDRESS,

    /** The phone is on no Wi-Fi or other network without a data limit, so it does not try. */
    NOT_HOME,

    /** The hub did not answer, as when the phone is on another network. */
    UNREACHABLE,

    /** The hub has no phone with this pairing code: it was not added there, or with another code. */
    NOT_ADDED,

    /** The hub answered with an error. */
    REFUSED,
}
