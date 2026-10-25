package den.watcher

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.TrafficStats
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import java.util.TimeZone

/**
 * Reads the phone's usage through what Android gives every app without a
 * permission: the battery, memory, storage and the traffic of Wi-Fi and
 * mobile data. Android lets no app read how busy the processor is.
 */
object Sampler {
    fun read(context: Context): Reading {
        val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val tenthsCelsius = battery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE) ?: Int.MIN_VALUE
        val plugged = (battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0

        val memory = ActivityManager.MemoryInfo()
        context.getSystemService(ActivityManager::class.java).getMemoryInfo(memory)

        val storage = StatFs(Environment.getDataDirectory().path)

        return Reading(
            time = System.currentTimeMillis() / 1000,
            uptimeSeconds = SystemClock.elapsedRealtime() / 1000,
            batteryPercent = if (level >= 0 && scale > 0) level * 100.0 / scale else null,
            pluggedIn = plugged,
            batteryCelsius = if (tenthsCelsius != Int.MIN_VALUE && tenthsCelsius != 0) tenthsCelsius / 10.0 else null,
            memoryTotalBytes = memory.totalMem,
            memoryAvailableBytes = memory.availMem,
            storageTotalBytes = storage.totalBytes,
            storageFreeBytes = storage.availableBytes,
            traffic = traffic(),
        )
    }

    /** The traffic of Wi-Fi and of mobile data; Android counts the rest as Wi-Fi, such as a cable. */
    private fun traffic(): Map<String, Traffic> {
        val totalReceived = TrafficStats.getTotalRxBytes()
        val totalSent = TrafficStats.getTotalTxBytes()
        if (totalReceived == TrafficStats.UNSUPPORTED.toLong() || totalSent == TrafficStats.UNSUPPORTED.toLong()) {
            return emptyMap()
        }
        val mobileReceived = TrafficStats.getMobileRxBytes().coerceAtLeast(0)
        val mobileSent = TrafficStats.getMobileTxBytes().coerceAtLeast(0)
        return mapOf(
            WIFI to Traffic((totalReceived - mobileReceived).coerceAtLeast(0), (totalSent - mobileSent).coerceAtLeast(0)),
            MOBILE to Traffic(mobileReceived, mobileSent),
        )
    }

    /** What the phone is, as the hub's page tells it. */
    fun device(context: Context): DeviceInfo {
        val zone = TimeZone.getDefault()
        val now = System.currentTimeMillis()
        val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
        return DeviceInfo(
            name = Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME) ?: Build.MODEL,
            appVersion = version,
            os = "Android ${Build.VERSION.RELEASE}",
            kernel = System.getProperty("os.version") ?: "",
            architecture = System.getProperty("os.arch") ?: "",
            maker = Build.MANUFACTURER.replaceFirstChar { it.uppercase() },
            model = Build.MODEL,
            timeZoneName = zone.getDisplayName(zone.inDaylightTime(java.util.Date(now)), TimeZone.SHORT),
            timeZoneOffsetSeconds = zone.getOffset(now) / 1000,
        )
    }

    const val WIFI = "wifi"
    const val MOBILE = "mobile"
}
