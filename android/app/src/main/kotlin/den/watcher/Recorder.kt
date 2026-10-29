package den.watcher

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/**
 * Takes a reading, keeps its values and the networks nearby, and sends what
 * the hub does not have yet. RecordAlarm does this every half minute, and
 * SyncJob every quarter of an hour, so one reading is taken at a time.
 */
object Recorder {
    /** The most pushes in a row, enough for a week of minutes. */
    private const val MAX_PUSHES = 100

    @Synchronized
    fun recordAndPush(context: Context) {
        val app = context.applicationContext
        val settings = Settings(app)
        val choice = settings.dataChoice
        val reading = Sampler.read(app).limitedTo(choice)
        val rates = reading.ratesSince(settings.lastReading)
        settings.lastReading = reading
        Store(app).use { store ->
            store.add(reading.time, reading.values(rates))
            // A scan is kept once, when Android scanned again since, also
            // after the clock went back; none while they are not collected.
            val scan = if (choice.collectsNearby) Nearby.read(app, reading.time) else null
            scan?.takeIf { it.time > settings.lastScan || settings.lastScan > reading.time }?.let {
                store.addScan(it)
                settings.lastScan = it.time
            }
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
            val scans = store.scans()
            val needKey = settings.hubKey.isEmpty()
            when (val answer = Hub.push(url, settings.code, Push.body(now, newest, minutes, needKey, scans))) {
                is Hub.Answer.Failed -> {
                    settings.problem = answer.problem
                    return
                }
                is Hub.Answer.Taken -> {
                    settings.problem = null
                    settings.lastPush = now
                    settings.paired = true
                    // A key is taken only while the app has none, so another
                    // server at the hub's address cannot give its own.
                    if (needKey && Release.isKey(answer.key)) {
                        settings.hubKey = answer.key
                    }
                    if (answer.releaseSeconds > 0 &&
                        Release.proves(settings.hubKey, now, answer.releaseSeconds, answer.releaseProof)
                    ) {
                        settings.releasedUntil = now + minOf(answer.releaseSeconds, Release.MAX_SECONDS)
                    }
                    if (newest != null) {
                        checkNetwork(context, settings)
                    }
                    newest = null
                    // Every minute sent is deleted, also one the hub left out, such as
                    // one older than it keeps, so it is not sent again and again.
                    if (minutes.isNotEmpty()) {
                        store.deleteUpTo(maxOf(answer.after, minutes.last().time))
                    }
                    // A hub that takes no scans answers none; they are kept for a week.
                    if (answer.wifiAfter > 0) {
                        store.deleteScansUpTo(answer.wifiAfter)
                    }
                    val moreScans = scans.size == Push.MAX_SCANS && answer.wifiAfter > 0
                    if (minutes.size < Push.MAX_MINUTES && minutes.sumOf { it.values.size } < Push.MAX_VALUES && !moreScans) {
                        return
                    }
                }
            }
        }
    }

    /**
     * Remembers the network the hub was first reached on as the usual one,
     * and tells the user, once per network, when it is reached on another:
     * another device may answer at the hub's address there.
     */
    private fun checkNetwork(context: Context, settings: Settings) {
        val network = Networks.current(context) ?: return
        val usual = settings.usualNetworks
        when {
            usual.isEmpty() -> settings.usualNetworks = setOf(network)
            network in usual -> settings.otherNetwork = null
            network != settings.otherNetwork -> {
                settings.otherNetwork = network
                OtherNetworkNotice.show(context, network)
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
