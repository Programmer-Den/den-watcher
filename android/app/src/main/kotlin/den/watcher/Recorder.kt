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

    /**
     * Held while the hub's address and what belongs to it change: by a push
     * taking the hub's answer and by scanning another hub, so an answer of
     * the old hub is never kept for the new one.
     */
    val hubLock = Any()

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
            // after the clock went back. While they are not collected, none
            // is kept and the ones kept before are not sent any more.
            if (choice.collectsNearby) {
                Nearby.read(app, reading.time)?.takeIf { Nearby.isNew(it.time, settings.lastScan, reading.time) }?.let {
                    store.addScan(it)
                    settings.lastScan = it.time
                }
            } else {
                store.deleteScansUpTo(Long.MAX_VALUE)
            }
            push(app, settings, store) { reading.snapshot(rates, Sampler.device(app)) }
        }
    }

    /** Sends what the hub does not have yet, with the newest reading, which is made only when it is sent. */
    private fun push(context: Context, settings: Settings, store: Store, snapshot: () -> org.json.JSONObject) {
        val address = settings.hubAddress
        val url = HubAddress.pushUrl(address)
        if (url == null) {
            settings.problem = Problem.NO_ADDRESS
            return
        }
        if (!unmetered(context)) {
            settings.problem = Problem.NOT_HOME
            return
        }
        var newest: org.json.JSONObject? = snapshot()
        repeat(MAX_PUSHES) {
            val now = System.currentTimeMillis() / 1000
            // The values switched off since they were kept are not sent.
            val choice = settings.dataChoice
            val stored = store.minutes(now).map { minute ->
                minute.copy(values = minute.values.filterKeys(choice::keeps))
            }
            val minutes = Push.fit(stored)
            val scans = store.scans()
            val needKey = settings.hubKey.isEmpty()
            val answer = Hub.push(url, settings.code, Push.body(now, newest, minutes, needKey, scans))
            synchronized(hubLock) {
                // Another hub was scanned meanwhile, whose pairing starts anew.
                if (settings.hubAddress != address) {
                    return
                }
                when (answer) {
                    is Hub.Answer.Failed -> {
                        settings.problem = answer.problem
                        return
                    }
                    is Hub.Answer.Taken -> {
                        settings.problem = null
                        settings.lastPush = now
                        // A key is taken only while the app has none, so another
                        // server at the hub's address cannot give its own.
                        if (needKey && Release.isKey(answer.key)) {
                            settings.hubKey = answer.key
                        }
                        // Locked only with a key, which a change is allowed with.
                        settings.paired = settings.hubKey.isNotEmpty()
                        // A proof for a push no later than the one that last allowed a
                        // change is an old answer again, as after the clock was set back.
                        if (answer.releaseSeconds > 0 && now > settings.releasedAt &&
                            Release.proves(settings.hubKey, now, answer.releaseSeconds, answer.releaseProof)
                        ) {
                            settings.releasedAt = now
                            settings.releasedUntil = now + minOf(answer.releaseSeconds, Release.MAX_SECONDS)
                        }
                        if (newest != null) {
                            checkNetwork(context, settings)
                        }
                        newest = null
                        // Every minute sent is deleted, also one the hub left out, such as
                        // one older than it keeps, so it is not sent again and again; none
                        // that was not sent, whatever the answer says.
                        if (minutes.isNotEmpty()) {
                            store.deleteUpTo(minutes.last().time)
                        }
                        // A hub that takes no scans answers none; they are kept for a week.
                        val lastScan = scans.lastOrNull()?.optLong("time") ?: 0L
                        if (answer.wifiAfter > 0) {
                            store.deleteScansUpTo(minOf(answer.wifiAfter, lastScan))
                        }
                        val moreMinutes = minutes.size < stored.size || stored.size == Push.MAX_MINUTES
                        val moreScans = scans.size == Push.MAX_SCANS && answer.wifiAfter > 0
                        if (!moreMinutes && !moreScans) {
                            return
                        }
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
