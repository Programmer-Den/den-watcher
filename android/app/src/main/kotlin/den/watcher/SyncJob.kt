package den.watcher

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context

/**
 * Takes a reading and sends what the hub does not have yet about every
 * quarter of an hour, the most often Android runs a job, also while the
 * phone sleeps, so the history has no long gaps and the phone sends it soon
 * after it is back home.
 */
class SyncJob : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        Thread {
            runCatching { Recorder.recordAndPush(this) }
            jobFinished(params, false)
        }.start()
        return true
    }

    // The next run comes as planned.
    override fun onStopJob(params: JobParameters): Boolean = false

    companion object {
        private const val JOB_ID = 1
        private const val INTERVAL_MILLIS = 15 * 60 * 1000L

        fun schedule(context: Context) {
            val job = JobInfo.Builder(JOB_ID, ComponentName(context, SyncJob::class.java))
                .setPeriodic(INTERVAL_MILLIS)
                .setPersisted(true)
                .build()
            context.getSystemService(JobScheduler::class.java).schedule(job)
        }

        fun cancel(context: Context) {
            context.getSystemService(JobScheduler::class.java).cancel(JOB_ID)
        }
    }
}
