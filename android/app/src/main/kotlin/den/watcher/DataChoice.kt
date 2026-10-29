package den.watcher

/**
 * Which data the app collects, as chosen under Which data do you want to
 * collect, in the same groups as den-watcher's installers: System basics
 * (the battery, memory and storage) and Network (the traffic of Wi-Fi and
 * mobile data, and the Wi-Fi networks nearby). A value is collected when its group and its own switch
 * are on; everything is on until switched off.
 */
data class DataChoice(
    val system: Boolean = true,
    val battery: Boolean = true,
    val memory: Boolean = true,
    val storage: Boolean = true,
    val network: Boolean = true,
    val traffic: Boolean = true,
    val nearby: Boolean = true,
) {
    val collectsBattery: Boolean get() = system && battery
    val collectsMemory: Boolean get() = system && memory
    val collectsStorage: Boolean get() = system && storage
    val collectsTraffic: Boolean get() = network && traffic
    val collectsNearby: Boolean get() = network && nearby

    /**
     * Whether a value kept under name, as Reading.values names it, is
     * collected, so a minute kept before its switch was turned off does not
     * send it after.
     */
    fun keeps(name: String): Boolean = when {
        name == "battery" || name == "temperature:${Reading.BATTERY_SENSOR}" -> collectsBattery
        name == "memory" -> collectsMemory
        name.startsWith("disk:") -> collectsStorage
        name.startsWith("network.") -> collectsTraffic
        else -> true
    }
}

/**
 * The reading without the data the choice leaves out, as if the phone did not
 * tell it: the hub's page then leaves those values out, as it does for a
 * phone that cannot read them.
 */
fun Reading.limitedTo(choice: DataChoice): Reading = copy(
    batteryPercent = batteryPercent.takeIf { choice.collectsBattery },
    pluggedIn = pluggedIn && choice.collectsBattery,
    batteryCelsius = batteryCelsius.takeIf { choice.collectsBattery },
    memoryTotalBytes = if (choice.collectsMemory) memoryTotalBytes else 0,
    memoryAvailableBytes = if (choice.collectsMemory) memoryAvailableBytes else 0,
    storageTotalBytes = if (choice.collectsStorage) storageTotalBytes else 0,
    storageFreeBytes = if (choice.collectsStorage) storageFreeBytes else 0,
    traffic = if (choice.collectsTraffic) traffic else emptyMap(),
)
