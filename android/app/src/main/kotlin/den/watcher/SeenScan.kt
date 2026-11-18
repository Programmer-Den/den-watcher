package den.watcher

import org.json.JSONArray
import org.json.JSONObject

/**
 * One Wi-Fi network a scan found, as the app's own map shows it: its name
 * (empty for a hidden one), signal, frequency, security and whether the
 * phone was connected to it. Its hardware address is not kept.
 */
data class SeenNetwork(
    val ssid: String,
    val dBm: Int,
    val frequencyMHz: Int,
    val security: String,
    val connected: Boolean,
) {
    /** The signal in percent, as the hub's page shows it. */
    val percent: Double get() = Nearby.percent(dBm)

    /** The channel number of the frequency, as Wi-Fi counts them in each band, or 0. */
    val channel: Int get() = when {
        frequencyMHz == 2484 -> 14
        frequencyMHz in 2412..2472 -> (frequencyMHz - 2407) / 5
        frequencyMHz in 5150..5925 -> (frequencyMHz - 5000) / 5
        frequencyMHz == 5935 -> 2
        frequencyMHz in 5926..7125 -> (frequencyMHz - 5950) / 5
        else -> 0
    }

    /** The band of the frequency: 24 for 2.4 GHz, 5 or 6, or 0. */
    val band: Int get() = when (frequencyMHz) {
        in 2400 until 2500 -> 24
        in 5150..5925 -> 5
        in 5926..7125 -> 6
        else -> 0
    }

    fun json(): JSONObject = JSONObject().apply {
        put("ssid", ssid)
        put("dBm", dBm)
        put("frequencyMHz", frequencyMHz)
        put("security", security)
        if (connected) put("connected", true)
    }
}

/**
 * The Wi-Fi networks a scan found, at time in Unix seconds on the phone's
 * clock, the strongest first, as the app keeps them for its own map.
 */
data class SeenScan(val time: Long, val networks: List<SeenNetwork>) {
    /** The networks as Store keeps them. */
    fun text(): String = JSONArray().apply { networks.forEach { put(it.json()) } }.toString()

    companion object {
        /** How far before or after a point of the route a scan may be to count as made there, as the hub has it. */
        const val WITHIN_SECONDS = 5 * 60L

        fun of(scan: Scan): SeenScan = SeenScan(
            scan.time,
            scan.accessPoints
                .map { SeenNetwork(it.ssid, it.dBm, it.frequencyMHz, it.security, it.connected) }
                .sortedByDescending { it.dBm },
        )

        /** The scan Store kept at time as text, or null for a broken one. */
        fun parse(time: Long, text: String): SeenScan? = runCatching {
            val array = JSONArray(text)
            SeenScan(
                time,
                (0 until array.length()).map {
                    val n = array.getJSONObject(it)
                    SeenNetwork(
                        n.optString("ssid"),
                        n.getInt("dBm"),
                        n.optInt("frequencyMHz"),
                        n.optString("security"),
                        n.optBoolean("connected"),
                    )
                },
            )
        }.getOrNull()
    }
}
