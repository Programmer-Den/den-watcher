package den.watcher

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import org.json.JSONObject
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Where the phone was at time, Unix milliseconds on its clock: lat and lon
 * in degrees, accuracy in meters, as Android tells it.
 */
data class RoutePoint(val time: Long, val lat: Double, val lon: Double, val accuracy: Double) {
    /** The point as the hub takes it, with the phone's number for it. */
    fun json(id: Long): JSONObject = JSONObject().apply {
        put("id", id)
        put("time", time)
        put("lat", lat)
        put("lon", lon)
        put("accuracy", accuracy)
    }

    /** The point as Settings keeps the last one. */
    fun text(): String = "$time,$lat,$lon,$accuracy"

    companion object {
        /** The point Settings kept as text, or null for none or a broken one. */
        fun parse(text: String?): RoutePoint? {
            val parts = text?.split(",")?.takeIf { it.size == 4 } ?: return null
            val time = parts[0].toLongOrNull() ?: return null
            val numbers = parts.drop(1).map { it.toDoubleOrNull() ?: return null }
            return RoutePoint(time, numbers[0], numbers[1], numbers[2])
        }
    }
}

/**
 * Keeps the phone's location route: at every reading the newest position
 * Android has, from any app that asked for one, which costs nothing, and
 * every ASK_EVERY_MILLIS a position from the mobile and Wi-Fi networks, which
 * costs little, never from GPS. While saving battery the app asks for none
 * and only keeps what Android has anyway. Android gives it only with the
 * location permission, the same one the Wi-Fi networks need, and while the
 * app is in the background only when it is allowed all the time.
 */
object Route {
    /** How often the app asks Android for a position: as often as it scans for the Wi-Fi networks. */
    const val ASK_EVERY_MILLIS = 5 * 60_000L

    /** How far the phone must have moved for a new point, in meters, unless the points are vaguer. */
    const val MIN_MOVE_METERS = 50.0

    /** How often a point is kept while the phone stays where it is, so the route tells it was there. */
    const val STILL_EVERY_MILLIS = 15 * 60_000L

    /** Positions Android had for longer than this are left out. */
    const val FRESH_MILLIS = 10 * 60_000L

    /** The vaguest position kept, in meters, as the hub keeps it: one from a far cell tower tells nothing of the way. */
    const val MAX_ACCURACY_METERS = 2000.0

    /** The mean radius of the earth, in meters. */
    private const val EARTH_METERS = 6_371_000.0

    /**
     * The newest position Android has from any of its sources, or null when
     * the app may not read it or Android has none within FRESH_MILLIS before
     * now, Unix milliseconds.
     */
    // Lint cannot tell that Nearby.allowed checks the permission.
    @SuppressLint("MissingPermission")
    fun latest(context: Context, now: Long): RoutePoint? {
        if (!Nearby.allowed(context)) {
            return null
        }
        val manager = context.getSystemService(LocationManager::class.java) ?: return null
        val providers = buildList {
            add(LocationManager.PASSIVE_PROVIDER)
            add(LocationManager.NETWORK_PROVIDER)
            add(LocationManager.GPS_PROVIDER)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) add(LocationManager.FUSED_PROVIDER)
        }
        val newest = providers
            .mapNotNull { runCatching { manager.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time } ?: return null
        return point(newest).takeIf { it.time in (now - FRESH_MILLIS)..(now + FRESH_MILLIS) }
    }

    /**
     * Asks Android for a position from the mobile and Wi-Fi networks, which
     * the next reading finds as the newest one, from Android 11 on. Returns
     * whether it asked.
     */
    @SuppressLint("MissingPermission")
    fun ask(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return false
        }
        if (!Nearby.allowed(context)) {
            return false
        }
        val manager = context.getSystemService(LocationManager::class.java) ?: return false
        if (!runCatching { manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }.getOrDefault(false)) {
            return false
        }
        return runCatching {
            manager.getCurrentLocation(LocationManager.NETWORK_PROVIDER, null, context.mainExecutor) { }
        }.isSuccess
    }

    /** Whether to ask for a position at now, when the app last asked at last, both Unix milliseconds: also after the clock went back. */
    fun askDue(last: Long, now: Long): Boolean = now - last >= ASK_EVERY_MILLIS || last > now

    /**
     * Whether next is a new point of the route after last, the one kept
     * before (null for none): a later one that is not too vague, and that
     * moved further than both are vague, or after STILL_EVERY_MILLIS, or
     * after the clock went back.
     */
    fun keeps(last: RoutePoint?, next: RoutePoint): Boolean {
        if (next.accuracy > MAX_ACCURACY_METERS) {
            return false
        }
        if (last == null || next.time < last.time - FRESH_MILLIS) {
            return true
        }
        if (next.time <= last.time) {
            return false
        }
        val moved = meters(last, next) >= max(MIN_MOVE_METERS, max(last.accuracy, next.accuracy))
        return moved || next.time - last.time >= STILL_EVERY_MILLIS
    }

    /** How far apart a and b are, in meters, along the earth. */
    fun meters(a: RoutePoint, b: RoutePoint): Double {
        val dLat = Math.toRadians(b.lat - a.lat)
        val dLon = Math.toRadians(b.lon - a.lon)
        val h = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(a.lat)) * cos(Math.toRadians(b.lat)) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * EARTH_METERS * atan2(sqrt(h), sqrt(1 - h))
    }

    private fun point(location: Location): RoutePoint =
        RoutePoint(location.time, location.latitude, location.longitude, if (location.hasAccuracy()) location.accuracy.toDouble() else MAX_ACCURACY_METERS)
}
