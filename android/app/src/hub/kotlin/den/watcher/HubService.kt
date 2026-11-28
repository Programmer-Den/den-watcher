package den.watcher

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings.Global
import den.watcher.go.mobile.Mobile
import java.io.File
import java.util.TimeZone
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Runs the den-watcher hub inside the app's own process, with a notification
 * of its own, as Android requires for that, until the hub is switched off.
 *
 * The hub asks every device every 5 seconds, so the service keeps the CPU
 * and the Wi-Fi awake while it runs: the device is meant to sit on its
 * charger. It checks every minute that the hub still runs and starts it
 * again when it stopped, such as when another app held its port.
 */
class HubService : Service() {
    private val handler = Handler(Looper.getMainLooper())

    /** Starts and stops the hub, which can take a few seconds, off the main thread. */
    private val worker: ExecutorService = Executors.newSingleThreadExecutor()
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    private val check = object : Runnable {
        override fun run() {
            worker.execute { keepRunning() }
            handler.postDelayed(this, CHECK_MILLIS)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = notification(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        holdLocks()
        handler.removeCallbacks(check)
        handler.post(check)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(check)
        worker.execute {
            Mobile.stop()
            HubState(this).running = false
        }
        worker.shutdown()
        releaseLocks()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /** Starts the hub unless it runs, and keeps how it went for the screen. */
    private fun keepRunning() {
        val state = HubState(this)
        if (Mobile.running()) {
            state.running = true
            return
        }
        try {
            Mobile.start(hubSettings(), TimeZone.getDefault().id, LanAddress.dnsServers(this))
            // It may stop at once, such as when another app holds its port.
            Thread.sleep(START_WAIT_MILLIS)
            state.running = Mobile.running()
            state.failure = Mobile.failure()
        } catch (e: Exception) {
            state.running = false
            state.failure = e.message ?: e.toString()
        }
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(this))
    }

    /** The hub's settings, with this device's phone part when its recording sends to this hub. */
    private fun hubSettings(): String {
        val settings = Settings(this)
        if (settings.hubAddress.isEmpty()) {
            settings.hubAddress = HubConfig.LOCAL_ADDRESS
        }
        val ownPhone = if (settings.hubAddress == HubConfig.LOCAL_ADDRESS) {
            HubConfig.phoneName(Global.getString(contentResolver, Global.DEVICE_NAME), Build.MODEL) + "=" + settings.code
        } else {
            null
        }
        return HubConfig.settings(File(filesDir, "den-watcher.db").path, filesDir.path, ownPhone)
    }

    private fun holdLocks() {
        if (wakeLock == null) {
            wakeLock = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "den-watcher:hub")
                .apply { setReferenceCounted(false); acquire() }
        }
        val wifi = applicationContext.getSystemService(WifiManager::class.java) ?: return
        if (wifiLock == null) {
            // The mode that keeps Wi-Fi awake with the screen off.
            @Suppress("DEPRECATION")
            val mode = WifiManager.WIFI_MODE_FULL_HIGH_PERF
            wifiLock = wifi.createWifiLock(mode, "den-watcher:hub")
                .apply { setReferenceCounted(false); acquire() }
        }
        if (multicastLock == null) {
            multicastLock = wifi.createMulticastLock("den-watcher:hub")
                .apply { setReferenceCounted(false); acquire() }
        }
    }

    private fun releaseLocks() {
        wakeLock?.release()
        wifiLock?.release()
        multicastLock?.release()
        wakeLock = null
        wifiLock = null
        multicastLock = null
    }

    companion object {
        const val NOTIFICATION_ID = 2
        private const val CHANNEL = "hub"

        /** How often the service checks that the hub still runs. */
        private const val CHECK_MILLIS = 60_000L

        /** How long a start waits before it tells whether the hub runs. */
        private const val START_WAIT_MILLIS = 3_000L

        fun start(context: Context) {
            context.startForegroundService(Intent(context, HubService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, HubService::class.java))
        }

        /** The text that tells how the hub goes: where it runs, why it stopped, or that it is starting. */
        fun statusText(context: Context): String {
            val state = HubState(context)
            return when {
                !state.wanted -> context.getString(R.string.hub_off)
                state.failure.isNotEmpty() && !state.running -> context.getString(R.string.hub_failed, state.failure)
                !state.running -> context.getString(R.string.hub_starting)
                else -> LanAddress.ipv4(context)?.let { context.getString(R.string.hub_running, "$it:${HubConfig.PORT}") }
                    ?: context.getString(R.string.hub_running_no_network)
            }
        }

        private fun notification(context: Context): Notification {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, context.getString(R.string.hub_channel_name), NotificationManager.IMPORTANCE_MIN).apply {
                    description = context.getString(R.string.hub_channel_description)
                    setShowBadge(false)
                },
            )
            val open = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE,
            )
            return Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(context.getString(R.string.hub_notification_title))
                .setContentText(statusText(context))
                .setContentIntent(open)
                .setOngoing(true)
                .build()
        }
    }
}
