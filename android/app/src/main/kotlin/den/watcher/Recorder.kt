package den.watcher

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/**
 * Takes a reading, keeps its values, the networks nearby, the Wi-Fi the
 * phone is connected to, the location route and the uses of apps, and sends what
 * the hub does not have yet. RecordAlarm does this every half minute (every
 * minute with the screen off, see Saving), and
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
        // While steps are off, the count is let go, so switching them on again starts today at 0.
        if (!choice.collectsSteps) {
            settings.stepCount = null
        }
        val reading = Sampler.read(app).limitedTo(choice).let {
            // Read only while collected, as they take a moment or open Android's Bluetooth profiles or start the step counter.
            val now = System.currentTimeMillis()
            it.copy(
                appTraffic = if (choice.collectsApps) AppData.read(app, now) else null,
                appStorage = if (choice.collectsStorage) AppStorage.read(app, now) else null,
                bluetooth = if (choice.collectsBluetooth) Bluetooth.read(app) else null,
                steps = if (choice.collectsSteps) countSteps(app, settings) else null,
            )
        }
        // How often to ask for a scan and a position: less often while the phone stands still.
        val every = Still.every(still(app, settings))
        val rates = reading.ratesSince(settings.lastReading)
        settings.lastReading = reading
        Store(app).use { store ->
            store.add(reading.time, reading.values(rates))
            // A scan is kept once, when Android scanned again since, also
            // after the clock went back. While they are not collected, none
            // is kept and the ones kept before are not sent any more.
            if (choice.collectsNearby) {
                val scan = Nearby.read(app, reading.time)
                scan?.takeIf { Nearby.isNew(it.time, settings.lastScan, reading.time) }?.let {
                    store.addScan(it)
                    store.addMapScan(SeenScan.of(it))
                    settings.lastScan = it.time
                    val place = Still.place(it)
                    settings.wifiStill = Still.samePlace(settings.lastPlace, place)
                    settings.lastPlace = place
                }
                // Its results are read at the next reading, half a minute or a minute later.
                // While saving battery, only the scans Android makes on its own are read.
                val now = System.currentTimeMillis()
                if (!Saving.on(app) && Nearby.scanDue(settings.lastScanRequest, (scan?.time ?: 0) * 1000, now, every) && Nearby.requestScan(app)) {
                    settings.lastScanRequest = now
                    asked(app, settings)
                }
            } else {
                store.deleteScansUpTo(Long.MAX_VALUE)
                store.deleteMapScans()
                settings.wifiStill = null
                settings.lastPlace = emptySet()
            }
            // While they are not collected, none is kept and the ones kept
            // before are not sent any more.
            if (choice.collectsConnected) {
                store.addConnection(WifiLog.connected(app), System.currentTimeMillis())
            } else {
                store.deleteConnections()
            }
            recordRoute(app, settings, store, choice, every)
            recordUses(app, settings, store, choice)
            push(app, settings, store) { reading.snapshot(rates, Sampler.device(app)) }
        }
    }

    /**
     * Keeps the newest position Android has as a point of the route when the
     * phone moved since the point before or stayed for a while, and asks
     * Android for a new one every Route.ASK_EVERY_MILLIS (Still.STILL_EVERY_MILLIS
     * while the phone stands still), which the next reading finds; while saving battery it asks for none. While the route
     * is not collected, none is kept and the ones kept before are not sent
     * any more, nor shown on the app's map.
     */
    private fun recordRoute(context: Context, settings: Settings, store: Store, choice: DataChoice, every: Long) {
        if (!choice.collectsRoute) {
            store.deleteRouteUpTo(Long.MAX_VALUE)
            store.deleteMapRoute()
            settings.lastRoutePoint = null
            return
        }
        val now = System.currentTimeMillis()
        Route.latest(context, now)?.takeIf { Route.keeps(settings.lastRoutePoint, it) }?.let {
            store.addRoutePoint(it)
            store.addMapPoint(it)
            settings.lastRoutePoint = it
        }
        if (!Saving.on(context) && Route.askDue(settings.lastRouteAsk, now, every) && Route.ask(context)) {
            settings.lastRouteAsk = now
            asked(context, settings)
        }
    }

    /** Whether the phone stands still since the app last asked for a scan or a position, as Still tells it. */
    private fun still(context: Context, settings: Settings): Boolean {
        val (stepsAtAsk, networkAtAsk) = settings.stillAtAsk
        return Still.isStill(settings.wifiStill, settings.stepCount?.counter, stepsAtAsk, wifiNetwork(context), networkAtAsk)
    }

    /** Keeps the step counter and the network at the time the app asked for a scan or a position, for still. */
    private fun asked(context: Context, settings: Settings) {
        settings.stillAtAsk = settings.stepCount?.counter to wifiNetwork(context)
    }

    /** The Wi-Fi or cable network the phone is on, as Networks names it, or null on mobile data or none. */
    private fun wifiNetwork(context: Context): String? {
        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return null
        val local = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        return if (local) Networks.current(context) else null
    }

    /**
     * Keeps the uses of apps and unlocks Android logged since the last read,
     * once the user allowed usage access, from as far back as Android keeps
     * its log the first time. While they are not collected, the next read
     * starts from now, so nothing from the time they were switched off is
     * read, none is kept, and the ones kept before are not sent any more.
     */
    private fun recordUses(context: Context, settings: Settings, store: Store, choice: DataChoice) {
        val now = System.currentTimeMillis()
        if (!choice.collectsApps) {
            settings.usesReadUntil = now
            store.deleteUsesUpTo(Long.MAX_VALUE)
            return
        }
        if (!Usage.allowed(context)) {
            return
        }
        // After the clock went back, from as far back as the first time.
        val until = settings.usesReadUntil
        val from = if (until in 1..now) until else now - Usage.FIRST_READ_MILLIS
        val read = Usage.read(context, from, now)
        store.addUses(read.uses)
        settings.usesReadUntil = read.openSince ?: now
    }

    /**
     * The steps of today, from the step counter's newest value, which the
     * count kept since the reading before goes on from; null until the
     * counter told one.
     */
    private fun countSteps(context: Context, settings: Settings): Long? {
        val counter = Steps.read(context) ?: return null
        val day = java.time.LocalDate.now().toEpochDay()
        // The first count starts today at 0, as the counter's steps since the phone started are not all today's.
        val count = (settings.stepCount ?: StepCount(day, 0, counter)).next(counter, day)
        settings.stepCount = count
        return count.today
    }

    /**
     * Sends what the hub does not have yet, with the newest reading, which is
     * made only when it is sent. On a network that is not a usual one, where
     * the hub did not answer lately, it waits (see Hub.waits), so a Wi-Fi at
     * work does not keep the phone awake at every reading.
     */
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
        val network = Networks.current(context)
        if (Hub.waits(address, network, settings.usualNetworks, settings.unreachable, System.currentTimeMillis() / 1000)) {
            settings.problem = Problem.UNREACHABLE
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
            val uses = if (choice.collectsApps) store.uses() else emptyList()
            val connections = if (choice.collectsConnected) store.connections() else emptyList()
            val route = if (choice.collectsRoute) store.routePoints() else emptyList()
            val needKey = settings.hubKey.isEmpty()
            val answer = Hub.push(url, settings.code, Push.body(now, newest, minutes, needKey, scans, uses, connections, route))
            synchronized(hubLock) {
                // Another hub was scanned meanwhile, whose pairing starts anew.
                if (settings.hubAddress != address) {
                    return
                }
                when (answer) {
                    is Hub.Answer.Failed -> {
                        settings.problem = answer.problem
                        if (answer.problem == Problem.UNREACHABLE && network != null) {
                            settings.unreachable = Hub.place(address, network) to now
                        }
                        return
                    }
                    is Hub.Answer.Taken -> {
                        settings.problem = null
                        settings.unreachable = null
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
                        // A hub that takes no uses answers none; they are kept until one does.
                        val lastUse = uses.lastOrNull()?.optLong("id") ?: 0L
                        if (answer.usesAfter > 0) {
                            store.deleteUsesUpTo(minOf(answer.usesAfter, lastUse))
                        }
                        // A hub that takes no connections answers none; they are kept until one does.
                        val lastConnection = connections.lastOrNull()?.optLong("id") ?: 0L
                        if (answer.connectionsAfter > 0) {
                            store.connectionsTaken(minOf(answer.connectionsAfter, lastConnection))
                        }
                        // A hub that takes no route answers none; the points are kept until one does.
                        val lastPoint = route.lastOrNull()?.optLong("id") ?: 0L
                        if (answer.routeAfter > 0) {
                            store.deleteRouteUpTo(minOf(answer.routeAfter, lastPoint))
                        }
                        val moreMinutes = minutes.size < stored.size || stored.size == Push.MAX_MINUTES
                        val moreScans = scans.size == Push.MAX_SCANS && answer.wifiAfter > 0
                        val moreUses = uses.size == Push.MAX_USES && answer.usesAfter > 0
                        val moreConnections = connections.size == Push.MAX_CONNECTIONS && answer.connectionsAfter > 0
                        val moreRoute = route.size == Push.MAX_ROUTE && answer.routeAfter > 0
                        if (!moreMinutes && !moreScans && !moreUses && !moreConnections && !moreRoute) {
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
