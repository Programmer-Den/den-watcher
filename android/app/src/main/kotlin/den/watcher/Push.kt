package den.watcher

import org.json.JSONArray
import org.json.JSONObject

/** The averages of one minute, starting at time, in Unix seconds on the phone's clock. */
data class Minute(val time: Long, val values: Map<String, Double>)

/** The body of a push to the hub, and how much one may hold. */
object Push {
    /** The most minutes one push may hold, as many as the hub takes. */
    const val MAX_MINUTES = 120

    /** The most values one push may hold in all, as many as the hub takes. */
    const val MAX_VALUES = 10_000

    /** The header the pairing code is sent in, as a hub sends it to a device. */
    const val CODE_HEADER = "Usage-Control-Pairing-Code"

    /**
     * The first of the minutes, oldest first, that fit in one push: at most
     * MAX_MINUTES, and MAX_VALUES values in all, but always the first one.
     */
    fun fit(minutes: List<Minute>): List<Minute> {
        var values = 0
        var count = 0
        for (minute in minutes.take(MAX_MINUTES)) {
            values += minute.values.size
            if (count > 0 && values > MAX_VALUES) {
                break
            }
            count++
        }
        return minutes.take(count)
    }

    /**
     * The body of a push sent at now, with the newest reading when there is
     * one, asking for the phone's key when needKey is set.
     */
    fun body(now: Long, snapshot: JSONObject?, minutes: List<Minute>, needKey: Boolean = false): JSONObject = JSONObject().apply {
        put("now", now)
        if (needKey) put("needKey", true)
        snapshot?.let { put("snapshot", it) }
        put(
            "minutes",
            JSONArray().apply {
                for (minute in minutes) {
                    val values = JSONObject()
                    for ((metric, value) in minute.values.toSortedMap()) {
                        values.put(metric, value)
                    }
                    put(JSONObject().put("time", minute.time).put("values", values))
                }
            },
        )
    }
}
