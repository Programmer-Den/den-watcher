package den.watcher

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.os.SystemClock
import java.util.concurrent.Executors

/**
 * Wakes the phone every half minute while recording, takes a reading and
 * sends it. A timer in the service would stop as soon as the screen goes
 * off, since the processor then sleeps; an alarm wakes it, and a wake lock
 * keeps it awake until the reading is sent. In deep sleep Android lets such
 * an alarm ring only about every 9 minutes, and SyncJob runs as well.
 */
class RecordAlarm : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = context.applicationContext
        if (!Settings(app).recording) {
            return
        }
        schedule(app, INTERVAL_MILLIS)
        val lock = app.getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "den.watcher:record")
        lock.acquire(LOCK_MILLIS)
        val pending = goAsync()
        worker.execute {
            try {
                runCatching { Recorder.recordAndPush(app) }
            } finally {
                if (lock.isHeld) lock.release()
                pending.finish()
            }
        }
    }

    companion object {
        private const val INTERVAL_MILLIS = 30_000L

        /** Longer than the most a reading and its pushes should take. */
        private const val LOCK_MILLIS = 60_000L

        private val worker = Executors.newSingleThreadExecutor()

        /** Rings at once, and from then on every half minute. */
        fun start(context: Context) = schedule(context.applicationContext, 0)

        fun stop(context: Context) {
            context.getSystemService(AlarmManager::class.java).cancel(intent(context.applicationContext))
        }

        private fun schedule(context: Context, delayMillis: Long) {
            context.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + delayMillis,
                intent(context),
            )
        }

        private fun intent(context: Context): PendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, RecordAlarm::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
