package den.watcher

import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.content.Context
import android.net.ConnectivityManager
import android.os.Process
import java.util.Calendar

/** The data an app sent and received, as its package and the name the phone shows for it. */
data class AppBytes(val app: String, val label: String, val bytes: Long)

/** The data each app used today, over Wi-Fi and over mobile data, most first. */
data class AppTraffic(val wifi: List<AppBytes>, val mobile: List<AppBytes>)

/**
 * Reads how much data each app used since midnight from Android's own
 * count, which needs the usage access the app usage needs already. Android
 * counts it anyway, so reading it costs no battery; it is read at most every
 * 10 minutes, as it changes slowly and asking costs a moment of work.
 */
object AppData {
    /** The most apps a group lists; the others are added up as Other apps. */
    const val MAX_APPS = 12

    /** How long a read is used again, in milliseconds. */
    private const val KEEP_MILLIS = 10 * 60 * 1000L

    private var last: Pair<Long, AppTraffic>? = null

    /** The data each app used today at now, in Unix milliseconds, or null when the count may not be read. */
    @Synchronized
    fun read(context: Context, now: Long): AppTraffic? {
        if (!Usage.allowed(context)) {
            return null
        }
        last?.let { (at, traffic) -> if (now - at in 0 until KEEP_MILLIS) return traffic }
        val manager = context.getSystemService(NetworkStatsManager::class.java) ?: return null
        val start = midnight(now)
        val pm = context.packageManager
        fun of(type: Int): List<AppBytes> {
            val bytes = mutableMapOf<Int, Long>()
            runCatching {
                // Closed by hand, as NetworkStats is AutoCloseable only from Android 9 on.
                val stats = manager.querySummary(type, null, start, now)
                try {
                    val bucket = NetworkStats.Bucket()
                    while (stats.hasNextBucket()) {
                        stats.getNextBucket(bucket)
                        bytes.merge(bucket.uid, bucket.rxBytes + bucket.txBytes, Long::plus)
                    }
                } finally {
                    stats.close()
                }
            }
            return bytes.filterValues { it > 0 }.map { (uid, used) ->
                val app = when (uid) {
                    NetworkStats.Bucket.UID_REMOVED -> REMOVED
                    NetworkStats.Bucket.UID_TETHERING -> HOTSPOT
                    Process.SYSTEM_UID -> SYSTEM
                    else -> pm.getPackagesForUid(uid)?.minOrNull() ?: OTHER
                }
                val label = if (app in SPECIAL) "" else runCatching {
                    pm.getApplicationLabel(pm.getApplicationInfo(app, 0)).toString().trim()
                }.getOrDefault("")
                AppBytes(app, label, used)
            }
        }
        @Suppress("DEPRECATION")
        val traffic = AppTraffic(of(ConnectivityManager.TYPE_WIFI), of(ConnectivityManager.TYPE_MOBILE))
        last = now to traffic
        return traffic
    }

    /** The data per app as the extras Data per app: Wi-Fi and Data per app: mobile data. */
    fun extras(traffic: AppTraffic): List<Extra> = buildList {
        if (traffic.wifi.isNotEmpty()) {
            add(group(WIFI, Words("Data per app today: Wi-Fi", "Daten pro App heute: WLAN", "Données par app aujourd'hui : Wi-Fi", "Datos por app hoy: Wi-Fi"), traffic.wifi))
        }
        if (traffic.mobile.isNotEmpty()) {
            add(
                group(
                    MOBILE,
                    Words("Data per app today: mobile", "Daten pro App heute: mobil", "Données par app aujourd'hui : mobile", "Datos por app hoy: móvil"),
                    traffic.mobile,
                ),
            )
        }
    }

    /**
     * The group of the apps, most first: the same app under several numbers,
     * as after an update, is added up, apps without a name and those past
     * MAX_APPS are Other apps.
     */
    private fun group(id: String, title: Words, apps: List<AppBytes>): Extra {
        val byApp = apps.groupBy { if (it.app in SPECIAL || it.label.isNotEmpty()) it.app else OTHER }
            .map { (app, uses) -> AppBytes(app, uses.first().label, uses.sumOf { it.bytes }) }
            .sortedWith(compareByDescending<AppBytes> { it.bytes }.thenBy { it.app })
        val named = byApp.filter { it.app != OTHER }
        val shown = named.take(MAX_APPS)
        val other = byApp.filter { it.app == OTHER }.sumOf { it.bytes } + named.drop(MAX_APPS).sumOf { it.bytes }
        val ids = mutableSetOf<String>()
        return Extra(
            id = id,
            title = title,
            description = Words(
                "How much each app sent and received since midnight, as Android counts it.",
                "Wie viel jede App seit Mitternacht gesendet und empfangen hat, wie Android es zählt.",
                "Ce que chaque app a envoyé et reçu depuis minuit, selon le décompte d'Android.",
                "Cuánto envió y recibió cada app desde medianoche, según lo cuenta Android.",
            ),
            values = shown.map { app ->
                ExtraValue(uniqueId(idOf(app.app), ids), labelOf(app), ExtraUnit.BYTES, value = app.bytes.toDouble())
            } + if (other > 0) {
                listOf(ExtraValue(uniqueId(OTHER, ids), labelOf(AppBytes(OTHER, "", other)), ExtraUnit.BYTES, value = other.toDouble()))
            } else {
                emptyList()
            },
        )
    }

    private fun labelOf(app: AppBytes): Words = when (app.app) {
        REMOVED -> Words("Removed apps", "Entfernte Apps", "Apps supprimées", "Apps eliminadas")
        HOTSPOT -> Words("Hotspot", "Hotspot", "Point d'accès", "Punto de acceso")
        SYSTEM -> Words("Android system", "Android-System", "Système Android", "Sistema Android")
        OTHER -> Words("Other apps", "Andere Apps", "Autres apps", "Otras apps")
        else -> Words(app.label, app.label, app.label, app.label)
    }

    /** An id for the package as den-watcher takes one: lowercase letters, digits, - and _, up to 40 characters. */
    fun idOf(app: String): String =
        app.lowercase().map { if (it in 'a'..'z' || it in '0'..'9' || it == '_' || it == '-') it else '-' }
            .joinToString("").takeLast(40).trim('-').ifEmpty { OTHER }

    private fun uniqueId(id: String, taken: MutableSet<String>): String {
        var candidate = id
        var n = 2
        while (!taken.add(candidate)) {
            candidate = "${id.take(37)}-${n++}"
        }
        return candidate
    }

    private fun midnight(now: Long): Long = Calendar.getInstance().apply {
        timeInMillis = now
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    /** The group of the data over Wi-Fi. */
    const val WIFI = "app-data-wifi"

    /** The group of the mobile data. */
    const val MOBILE = "app-data-mobile"

    private const val REMOVED = "removed"
    private const val HOTSPOT = "hotspot"
    private const val SYSTEM = "android"
    private const val OTHER = "other"
    private val SPECIAL = setOf(REMOVED, HOTSPOT, SYSTEM)
}
