package den.watcher

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/**
 * Takes a reading, keeps its values and sends what the hub does not have
 * yet. The foreground service does this every half minute while the phone
 * is awake, and a job every quarter of an hour while it sleeps, so one
 * reading is taken at a time.
 */
object Recorder {
    /** The most pushes in a row, enough for a week of minutes. */
    private const val MAX_PUSHES = 100

    @Synchronized
    fun recordAndPush(context: Context) {
        val app = context.applicationContext
        val settings = Settings(app)
        val reading = Sampler.read(app)
        val rates = reading.ratesSince(settings.lastReading)
        settings.lastReading = reading
        Store(app).use { store ->
            store.add(reading.time, reading.values(rates))
            push(app, settings, store, reading.snapshot(rates, Sampler.device(app)))
        }
    }

    private fun push(context: Context, settings: Settings, store: Store, snapshot: org.json.JSONObject) {
        val url = HubAddress.pushUrl(settings.hubAddress)
        if (url == null) {
            settings.problem = Problem.NO_ADDRESS
            return
        }
        if (!unmetered(context)) {
            settings.problem = Problem.NOT_HOME
            return
        }
        var newest: org.json.JSONObject? = snapshot
        repeat(MAX_PUSHES) {
            val now = System.currentTimeMillis() / 1000
            val minutes = Push.fit(store.minutes(now))
            when (val answer = Hub.push(url, settings.code, Push.body(now, newest, minutes))) {
                is Hub.Answer.Failed -> {
                    settings.problem = answer.problem
                    return
                }
                is Hub.Answer.Taken -> {
                    settings.problem = null
                    settings.lastPush = now
                    newest = null
                    // Every minute sent is deleted, also one the hub left out, such as
                    // one older than it keeps, so it is not sent again and again.
                    if (minutes.isNotEmpty()) {
                        store.deleteUpTo(maxOf(answer.after, minutes.last().time))
                    }
                    if (minutes.size < Push.MAX_MINUTES && minutes.sumOf { it.values.size } < Push.MAX_VALUES) {
                        return
                    }
                }
            }
        }
    }

    /**
     * Whether the phone is on a network without a data limit, such as the
     * home Wi-Fi: only there is the hub tried, so mobile data is not spent.
     */
    private fun unmetered(context: Context): Boolean {
        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    }
}
