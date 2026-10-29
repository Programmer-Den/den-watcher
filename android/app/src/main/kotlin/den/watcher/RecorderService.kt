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
import android.os.IBinder

/**
 * Keeps the app running while it records, with a notification of its own,
 * as Android requires for that, and starts RecordAlarm, which takes a
 * reading every half minute and sends it to the hub, so the hub's page shows
 * the phone as within reach.
 *
 * The notification is ongoing, but from Android 14 on the user can still
 * swipe it away while the phone is unlocked. NotificationDismissed then puts
 * it back at once, so it stays for as long as the app records.
 */
class RecorderService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = notification(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        RecordAlarm.start(this)
        return START_STICKY
    }

    override fun onDestroy() {
        RecordAlarm.stop(this)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val NOTIFICATION_ID = 1
        private const val CHANNEL = "recording"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, RecorderService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RecorderService::class.java))
        }

        /** The service's notification, also for NotificationDismissed to post it again. */
        fun notification(context: Context): Notification {
            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, context.getString(R.string.channel_name), NotificationManager.IMPORTANCE_MIN).apply {
                    description = context.getString(R.string.channel_description)
                    setShowBadge(false)
                },
            )
            val open = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE,
            )
            val dismissed = PendingIntent.getBroadcast(
                context,
                0,
                Intent(context, NotificationDismissed::class.java),
                PendingIntent.FLAG_IMMUTABLE,
            )
            return Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(context.getString(R.string.notification_title))
                .setContentIntent(open)
                .setDeleteIntent(dismissed)
                .setOngoing(true)
                .build()
        }
    }
}
