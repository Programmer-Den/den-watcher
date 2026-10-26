package den.watcher

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/**
 * One access point the phone's Wi-Fi saw, as den-watcher reports one
 * (NearbyAccessPoint): its hardware address is only sent as a hash.
 */
data class AccessPoint(
    val bssid: String,
    val ssid: String,
    val dBm: Int,
    val frequencyMHz: Int,
    val widthMHz: Int,
    val security: String,
    val generation: Int,
    val connected: Boolean,
) {
    /** The access point as the hub takes it, or null when its hardware address is no address. */
    fun json(): JSONObject? {
        val address = Nearby.addressBytes(bssid) ?: return null
        return JSONObject().apply {
            put("id", Nearby.hash(address))
            put("box", Nearby.hash(address.copyOfRange(1, 5)))
            if (ssid.isNotEmpty()) put("ssid", ssid)
            put("signalPercent", Nearby.percent(dBm))
            put("signalDBm", dBm)
            if (frequencyMHz > 0) put("frequencyMHz", frequencyMHz)
            if (widthMHz > 0) put("widthMHz", widthMHz)
            if (security.isNotEmpty()) put("security", security)
            if (generation > 0) put("generation", generation)
            if (connected) put("connected", true)
        }
    }
}

/** What the phone's Wi-Fi saw nearby, at time in Unix seconds on the phone's clock. */
data class Scan(val time: Long, val accessPoints: List<AccessPoint>) {
    fun json(): JSONObject = JSONObject()
        .put("time", time)
        .put("accessPoints", JSONArray().apply { accessPoints.mapNotNull { it.json() }.forEach { put(it) } })
}

/**
 * Reads the Wi-Fi networks nearby from the scans Android makes on its own;
 * the app starts none. Android gives them only with the location permission,
 * and while the app is in the background only when it is allowed all the
 * time, so the hub can tell where the phone was, also while it was away.
 */
object Nearby {
    /** Results Android saw longer ago than this are left out: it keeps the last ones it has. */
    private const val FRESH_SECONDS = 120L

    /** Whether the app may read the networks nearby, at least while it is open. */
    fun allowed(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    /**
     * Whether it may also while it is in the background, as while the screen
     * is off; before Android 10 the location permission is always for all
     * the time.
     */
    fun allowedAlways(context: Context): Boolean = allowed(context) &&
        (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
                context.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
            )

    /**
     * The networks Android last saw, at the time it saw them, or null when the
     * app may not read them or Android saw none within FRESH_SECONDS before now.
     */
    // Lint cannot tell that allowed checks the permission.
    @SuppressLint("MissingPermission")
    fun read(context: Context, now: Long): Scan? {
        if (!allowed(context)) {
            return null
        }
        val wifi = context.getSystemService(WifiManager::class.java) ?: return null
        val results = try {
            wifi.scanResults
        } catch (_: SecurityException) {
            return null
        }
        // A result's timestamp is in microseconds since the phone started.
        val sinceBoot = SystemClock.elapsedRealtimeNanos() / 1000
        val fresh = results.filter { sinceBoot - it.timestamp in 0..FRESH_SECONDS * 1_000_000 }
        if (fresh.isEmpty()) {
            return null
        }
        @Suppress("DEPRECATION")
        val connected = runCatching { wifi.connectionInfo?.bssid }.getOrNull()?.lowercase()
        val newest = fresh.maxOf { it.timestamp }
        return Scan(
            time = now - (sinceBoot - newest) / 1_000_000,
            accessPoints = fresh.map {
                @Suppress("DEPRECATION")
                val ssid = it.SSID ?: ""
                AccessPoint(
                    bssid = it.BSSID ?: "",
                    ssid = ssid.removeSurrounding("\""),
                    dBm = it.level,
                    frequencyMHz = it.frequency,
                    widthMHz = width(it.channelWidth),
                    security = security(it.capabilities ?: ""),
                    generation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) generation(it.wifiStandard) else 0,
                    connected = it.BSSID?.lowercase() == connected,
                )
            },
        )
    }

    /** The six bytes of a hardware address such as 0a:1b:2c:3d:4e:5f, or null. */
    fun addressBytes(address: String): ByteArray? {
        val parts = address.split(':')
        if (parts.size != 6) {
            return null
        }
        val bytes = ByteArray(6)
        for ((i, part) in parts.withIndex()) {
            bytes[i] = (part.takeIf { it.length == 2 }?.toIntOrNull(16) ?: return null).toByte()
        }
        return bytes
    }

    /** The first 12 hex digits of the SHA-256 of bytes, as den-watcher's AccessPointID. */
    fun hash(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).take(6).joinToString("") { "%02x".format(it.toInt() and 0xff) }

    /** The signal in percent, as Windows rates it: 0 % at -100 dBm, 100 % at -50 dBm. */
    fun percent(dBm: Int): Double = ((dBm + 100) * 2.0).coerceIn(0.0, 100.0)

    /** The width in MHz of a ScanResult's channelWidth, or 0 when unknown. */
    fun width(channelWidth: Int): Int = when (channelWidth) {
        0 -> 20
        1 -> 40
        2 -> 80
        3, 4 -> 160
        5 -> 320
        else -> 0
    }

    /** The Wi-Fi generation of a ScanResult's wifiStandard, such as 6 for 802.11ax, or 0. */
    fun generation(standard: Int): Int = when (standard) {
        4 -> 4
        5 -> 5
        6 -> 6
        8 -> 7
        else -> 0
    }

    /**
     * How a network is secured, from a ScanResult's capabilities such as
     * [WPA2-PSK-CCMP][RSN-SAE-CCMP][ESS], named as den-watcher names it:
     * Open, WEP, WPA, WPA2, WPA3, WPA2/WPA3, OWE, or one of them with
     * Enterprise.
     */
    fun security(capabilities: String): String {
        val caps = capabilities.uppercase()
        val enterprise = "EAP" in caps
        val wpa3 = "SAE" in caps || "SUITE_B" in caps
        val wpa2 = "WPA2" in caps || ("RSN" in caps && ("PSK" in caps || (enterprise && !wpa3)))
        val wpa = "WPA-" in caps
        val name = when {
            wpa2 && wpa3 -> "WPA2/WPA3"
            wpa3 -> "WPA3"
            wpa2 -> "WPA2"
            wpa -> "WPA"
            "OWE" in caps -> return "OWE"
            "WEP" in caps -> return "WEP"
            else -> return "Open"
        }
        return if (enterprise) "$name Enterprise" else name
    }
}
