package den.watcher

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import org.json.JSONObject

/** One event of Android's usage log: what happened at time, in Unix milliseconds, and to which app. */
data class UsageEvent(val time: Long, val type: Int, val app: String)

/**
 * One time an app was in use, from start for millis, in Unix milliseconds on
 * the phone's clock, or an unlock of the phone, whose app is empty and which
 * lasts no time. The label is the app's name as the phone shows it.
 */
data class AppUse(val app: String, val start: Long, val millis: Long, val label: String = "") {
    val isUnlock: Boolean get() = app.isEmpty()

    /** The use as the hub takes it, with the phone's number for it. */
    fun json(id: Long): JSONObject = JSONObject().apply {
        put("id", id)
        if (app.isNotEmpty()) put("app", app)
        if (label.isNotEmpty()) put("label", label)
        put("start", start)
        if (millis > 0) put("millis", millis)
    }
}

/**
 * The uses that are over, and the start of the one still going on, if any,
 * which the next read starts from, so it is found again whole.
 */
data class AppUses(val uses: List<AppUse>, val openSince: Long?)

/**
 * Reads when which app was in use and when the phone was unlocked from
 * Android's usage log, which Android gives only once the user allowed the
 * app *Usage access* in its settings. Android keeps the log for a few days
 * only, so the uses are kept in the Store until the hub has them.
 */
object Usage {
    // The types of UsageEvents.Event, as numbers, as some are newer than
    // the oldest Android the app runs on, which then just has none of them.
    const val ACTIVITY_RESUMED = 1
    const val ACTIVITY_PAUSED = 2
    const val SCREEN_NON_INTERACTIVE = 16
    const val KEYGUARD_SHOWN = 17
    const val KEYGUARD_HIDDEN = 18
    const val ACTIVITY_STOPPED = 23
    const val DEVICE_SHUTDOWN = 26

    /**
     * How long an app that was paused last may stay so before its use counts
     * as over, as the next event may just not be logged yet.
     */
    const val SETTLE_MILLIS = 5_000L

    /** The longest one use is kept as: a day, as long as the hub takes. */
    const val MAX_MILLIS = 24 * 60 * 60 * 1000L

    /** How far back the first read goes once usage access is allowed: as far as Android keeps its log. */
    const val FIRST_READ_MILLIS = 7 * 24 * 60 * 60 * 1000L

    /** Apps whose time is not counted: the phone's own screens, such as the home screen and the lock screen. */
    private val SYSTEM_SCREENS = setOf("com.android.systemui")

    /** Whether the user allowed the app to read the usage log. */
    @Suppress("DEPRECATION")
    fun allowed(context: Context): Boolean {
        val ops = context.getSystemService(AppOpsManager::class.java) ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * The uses from from up to now, in Unix milliseconds, each with the
     * app's name, leaving out the home screen, or none when the log may not
     * be read.
     */
    fun read(context: Context, from: Long, now: Long): AppUses {
        if (!allowed(context)) {
            return AppUses(emptyList(), null)
        }
        val manager = context.getSystemService(UsageStatsManager::class.java) ?: return AppUses(emptyList(), null)
        val events = mutableListOf<UsageEvent>()
        val log = runCatching { manager.queryEvents(from, now) }.getOrNull() ?: return AppUses(emptyList(), null)
        val event = UsageEvents.Event()
        while (log.hasNextEvent()) {
            log.getNextEvent(event)
            events += UsageEvent(event.timeStamp, event.eventType, event.packageName ?: "")
        }
        val pm = context.packageManager
        val labels = mutableMapOf<String, String>()
        val read = uses(events, now, homeScreens(pm) + SYSTEM_SCREENS)
        return read.copy(
            uses = read.uses.map { use ->
                if (use.isUnlock) use else use.copy(label = labels.getOrPut(use.app) { label(pm, use.app) })
            },
        )
    }

    /** The apps that are home screens, whose time is no app's. */
    private fun homeScreens(pm: PackageManager): Set<String> {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        return runCatching {
            pm.queryIntentActivities(home, 0).mapNotNull { it.activityInfo?.packageName }.toSet()
        }.getOrDefault(emptySet())
    }

    /** The app's name as the phone shows it, or empty when it is not known, as for an app removed since. */
    private fun label(pm: PackageManager, app: String): String = runCatching {
        pm.getApplicationLabel(pm.getApplicationInfo(app, 0)).toString().trim()
    }.getOrDefault("")

    /**
     * The uses that the events tell, read at now, leaving out the apps in
     * skip. An app is in use from when one of its screens comes to the front
     * until another app's does, the screen goes off or locks, or the phone
     * shuts down; a change between its own screens goes on with the same
     * use. An unlock is told by the lock screen going away.
     */
    fun uses(events: List<UsageEvent>, now: Long, skip: Set<String> = emptySet()): AppUses {
        val uses = mutableListOf<AppUse>()
        var app: String? = null
        var start = 0L
        var pausedAt: Long? = null

        fun close(end: Long) {
            val current = app
            if (current != null && end > start) {
                uses += AppUse(current, start, minOf(end - start, MAX_MILLIS))
            }
            app = null
            pausedAt = null
        }

        for (event in events.sortedBy { it.time }) {
            when (event.type) {
                ACTIVITY_RESUMED -> when {
                    event.app == app -> pausedAt = null
                    else -> {
                        close(pausedAt ?: event.time)
                        if (event.app.isNotEmpty() && event.app !in skip) {
                            app = event.app
                            start = event.time
                        }
                    }
                }
                ACTIVITY_PAUSED, ACTIVITY_STOPPED -> if (event.app == app && pausedAt == null) pausedAt = event.time
                SCREEN_NON_INTERACTIVE, KEYGUARD_SHOWN, DEVICE_SHUTDOWN -> close(pausedAt ?: event.time)
                KEYGUARD_HIDDEN -> uses += AppUse("", event.time, 0)
            }
        }
        val paused = pausedAt
        if (app != null && paused != null && now - paused >= SETTLE_MILLIS) {
            close(paused)
        }
        return AppUses(uses.sortedBy { it.start }, if (app != null) start else null)
    }
}
