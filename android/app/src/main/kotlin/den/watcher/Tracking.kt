package den.watcher

/**
 * What the app tracks, as picked under What to track, in the same groups as
 * den-watcher's installers: System basics (the battery, memory and storage)
 * and Network (the traffic of Wi-Fi and mobile data, and the Wi-Fi
 * networks nearby). A value is tracked when its group and its own switch
 * are on; everything is on until switched off.
 */
data class Tracking(
    val system: Boolean = true,
    val battery: Boolean = true,
    val memory: Boolean = true,
    val storage: Boolean = true,
    val network: Boolean = true,
    val traffic: Boolean = true,
    val nearby: Boolean = true,
) {
    val tracksBattery: Boolean get() = system && battery
    val tracksMemory: Boolean get() = system && memory
    val tracksStorage: Boolean get() = system && storage
    val tracksTraffic: Boolean get() = network && traffic
    val tracksNearby: Boolean get() = network && nearby
}

/**
 * The reading without what tracking leaves out, as if the phone did not
 * tell it: the hub's page then leaves those values out, as it does for a
 * phone that cannot read them.
 */
fun Reading.limitedTo(tracking: Tracking): Reading = copy(
    batteryPercent = batteryPercent.takeIf { tracking.tracksBattery },
    pluggedIn = pluggedIn && tracking.tracksBattery,
    batteryCelsius = batteryCelsius.takeIf { tracking.tracksBattery },
    memoryTotalBytes = if (tracking.tracksMemory) memoryTotalBytes else 0,
    memoryAvailableBytes = if (tracking.tracksMemory) memoryAvailableBytes else 0,
    storageTotalBytes = if (tracking.tracksStorage) storageTotalBytes else 0,
    storageFreeBytes = if (tracking.tracksStorage) storageFreeBytes else 0,
    traffic = if (tracking.tracksTraffic) traffic else emptyMap(),
)
