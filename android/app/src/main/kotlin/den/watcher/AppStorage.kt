package den.watcher

import android.app.usage.StorageStatsManager
import android.content.Context
import android.os.storage.StorageManager

/**
 * Reads how much storage each app takes, with its data and cache, from
 * Android's own count, which needs the usage access the app usage needs. It
 * changes slowly and asking for every app takes a moment, so it is read at
 * most once an hour.
 */
object AppStorage {
    /** How long a read is used again, in milliseconds. */
    private const val KEEP_MILLIS = 60 * 60 * 1000L

    private var last: Pair<Long, List<AppBytes>>? = null

    /** The storage of each app the phone shows at now, in Unix milliseconds, or null when it may not be read. */
    @Synchronized
    fun read(context: Context, now: Long): List<AppBytes>? {
        if (!Usage.allowed(context)) {
            return null
        }
        last?.let { (at, apps) -> if (now - at in 0 until KEEP_MILLIS) return apps }
        val stats = context.getSystemService(StorageStatsManager::class.java) ?: return null
        val pm = context.packageManager
        val apps = runCatching { pm.getInstalledApplications(0) }.getOrDefault(emptyList()).mapNotNull { app ->
            val used = runCatching {
                val s = stats.queryStatsForPackage(StorageManager.UUID_DEFAULT, app.packageName, android.os.Process.myUserHandle())
                s.appBytes + s.dataBytes + s.cacheBytes
            }.getOrNull() ?: return@mapNotNull null
            if (used <= 0) return@mapNotNull null
            AppBytes(app.packageName, runCatching { pm.getApplicationLabel(app).toString().trim() }.getOrDefault(""), used)
        }
        last = now to apps
        return apps
    }

    /** The storage per app as the extra Storage per app. */
    fun extra(apps: List<AppBytes>): Extra = AppData.group(
        GROUP,
        Words("Storage per app", "Speicher pro App", "Stockage par app", "Almacenamiento por app"),
        apps,
        Words(
            "How much storage each app takes, with its data and cache, as Android counts it.",
            "Wie viel Speicher jede App belegt, mit ihren Daten und dem Cache, wie Android es zählt.",
            "L'espace de stockage de chaque app, avec ses données et son cache, selon le décompte d'Android.",
            "Cuánto almacenamiento ocupa cada app, con sus datos y su caché, según lo cuenta Android.",
        ),
    )

    /** The group of the storage per app. */
    const val GROUP = "app-storage"
}
