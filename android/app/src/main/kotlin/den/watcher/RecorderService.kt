package den.watcher

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder

/**
 * Records the phone's usage every half minute and sends it to the hub while
 * the phone is awake, so the hub's page shows it as within reach. Android
 * keeps it running only as a foreground service, with a notification of its
 * own; while the phone sleeps, SyncJob takes over.
 */
class RecorderService : Service() {
    private lateinit var thread: HandlerThread
    private lateinit var handler: Handler

    private val tick = object : Runnable {
        override fun run() {
            runCatching { Recorder.recordAndPush(this@RecorderService) }
            handler.postDelayed(this, INTERVAL_MILLIS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        thread = HandlerThread("recorder").apply { start() }
        handler = Handler(thread.looper)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = notification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        handler.removeCallbacks(tick)
        handler.post(tick)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        thread.quitSafely()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun notification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, getString(R.string.channel_name), NotificationManager.IMPORTANCE_MIN).apply {
                description = getString(R.string.channel_description)
                setShowBadge(false)
            },
        )
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notification_title))
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val INTERVAL_MILLIS = 30_000L
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL = "recording"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, RecorderService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RecorderService::class.java))
        }
    }
}
