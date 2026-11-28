package den.watcher

import org.json.JSONArray
import org.json.JSONObject

/** The bytes a network has received and sent since the phone started. */
data class Traffic(val received: Long, val sent: Long)

/** How fast a network received and sent, in bytes per second. */
data class Rates(val receive: Double, val send: Double)

/**
 * How busy the processor was, in all and per core, in percent, and its
 * highest clock in MHz, or null when unknown. Android lets no app read it,
 * so only the hub app reads it, on a rooted device.
 */
data class Processor(val usagePercent: Double, val coreUsagePercent: List<Double>, val clockMHz: Double?)

/** The temperature of one sensor, as den-watcher names it. */
data class Sensor(val name: String, val celsius: Double)

/**
 * One reading of the phone. Times are Unix seconds on the phone's clock;
 * null is a value the phone does not tell.
 */
data class Reading(
    val time: Long,
    val uptimeSeconds: Long,
    /** How often the phone has started, so a restart is told; 0 when it is not known. */
    val boot: Int = 0,
    val batteryPercent: Double?,
    val pluggedIn: Boolean,
    val batteryCelsius: Double?,
    val memoryTotalBytes: Long,
    val memoryAvailableBytes: Long,
    val storageTotalBytes: Long,
    val storageFreeBytes: Long,
    /** The traffic of each network, by its name: wifi and mobile. */
    val traffic: Map<String, Traffic>,
    /** What the battery tells beyond its charge and temperature. */
    val batteryDetails: BatteryDetails? = null,
    /** How hot the phone runs. */
    val thermal: Thermal? = null,
    /** The data each app used today. */
    val appTraffic: AppTraffic? = null,
    /** The Wi-Fi the phone is connected to. */
    val wifiLink: WifiLink? = null,
    /** The mobile network's signal. */
    val mobileSignal: MobileSignal? = null,
    /** The storage each app takes. */
    val appStorage: List<AppBytes>? = null,
    /** The Bluetooth devices connected to the phone. */
    val bluetooth: List<BluetoothDevice>? = null,
    /** The steps counted today. */
    val steps: Long? = null,
    /** The processor, which only a rooted hub app reads. */
    val processor: Processor? = null,
    /** The temperatures besides the battery's, which only a rooted hub app reads. */
    val sensors: List<Sensor> = emptyList(),
) {
    val memoryUsedBytes: Long get() = (memoryTotalBytes - memoryAvailableBytes).coerceAtLeast(0)
    val memoryUsedPercent: Double get() = percent(memoryUsedBytes, memoryTotalBytes)
    val storageUsedBytes: Long get() = (storageTotalBytes - storageFreeBytes).coerceAtLeast(0)
    val storageUsedPercent: Double get() = percent(storageUsedBytes, storageTotalBytes)

    /**
     * How fast each network received and sent since the reading before,
     * which may be from long ago, as while the phone was asleep: the average
     * over that time, by the time since the phone started, which a change of
     * the clock does not move. None after a restart of the phone, whose
     * counters then start again, and none for a network whose counters went
     * back.
     */
    fun ratesSince(before: Reading?): Map<String, Rates> {
        val restarted = boot != 0 && before?.boot != 0 && boot != before?.boot
        if (before == null || restarted || uptimeSeconds <= before.uptimeSeconds) {
            return emptyMap()
        }
        val seconds = (uptimeSeconds - before.uptimeSeconds).toDouble()
        return traffic.mapNotNull { (name, now) ->
            val then = before.traffic[name] ?: return@mapNotNull null
            val received = now.received - then.received
            val sent = now.sent - then.sent
            if (received < 0 || sent < 0) null else name to Rates(received / seconds, sent / seconds)
        }.toMap()
    }

    /**
     * The values the hub keeps in its history, named as den-watcher names
     * them: the battery's charge and temperature, memory and storage used in
     * percent, and each network's speed, and on a rooted hub app the
     * processor's usage and the other temperatures.
     */
    fun values(rates: Map<String, Rates>): Map<String, Double> = buildMap {
        processor?.let { put("cpu", it.usagePercent) }
        batteryPercent?.let { put("battery", it) }
        batteryCelsius?.let { put("temperature:$BATTERY_SENSOR", it) }
        sensors.forEach { put("temperature:${it.name}", it.celsius) }
        if (memoryTotalBytes > 0) put("memory", memoryUsedPercent)
        if (storageTotalBytes > 0) put("disk:$STORAGE_PATH", storageUsedPercent)
        for ((name, rate) in rates) {
            put("network.receive:$name", rate.receive)
            put("network.send:$name", rate.send)
        }
        extras().forEach { putAll(it.historyValues()) }
    }

    /** The values beyond the fields every device tells, as den-watcher's extras. */
    fun extras(): List<Extra> = buildList {
        batteryDetails?.let { add(Health.batteryExtra(it)) }
        thermal?.let { add(Health.thermalExtra(it)) }
        wifiLink?.let { add(Signal.wifiExtra(it)) }
        mobileSignal?.let { add(Signal.mobileExtra(it)) }
        appTraffic?.let { addAll(AppData.extras(it)) }
        appStorage?.takeIf { it.isNotEmpty() }?.let { add(AppStorage.extra(it)) }
        bluetooth?.let { add(Bluetooth.extra(it)) }
        steps?.let { add(Steps.extra(it)) }
    }

    /**
     * The reading as the hub's page shows it, in the form of den-watcher's
     * own. Without the processor, which an app cannot read without root, it
     * tells no cores and the page leaves the processor out.
     */
    fun snapshot(rates: Map<String, Rates>, device: DeviceInfo): JSONObject = JSONObject().apply {
        put("name", device.name)
        put("version", device.appVersion)
        put("time", java.time.Instant.ofEpochSecond(time).toString())
        put("timeZone", JSONObject().put("name", device.timeZoneName).put("offsetSeconds", device.timeZoneOffsetSeconds))
        put("uptimeSeconds", uptimeSeconds)
        put(
            "cpu",
            processor?.let {
                JSONObject()
                    .put("usagePercent", it.usagePercent)
                    .put("cores", it.coreUsagePercent.size)
                    .put("coreUsagePercent", JSONArray(it.coreUsagePercent))
                    .apply { it.clockMHz?.let { clock -> put("clockMHz", clock) } }
            } ?: JSONObject().put("usagePercent", 0).put("cores", 0),
        )
        put(
            "memory",
            JSONObject()
                .put("totalBytes", memoryTotalBytes)
                .put("usedBytes", memoryUsedBytes)
                .put("usedPercent", memoryUsedPercent)
                .put("availableBytes", memoryAvailableBytes),
        )
        put(
            "temperatures",
            JSONArray().apply {
                batteryCelsius?.let { put(JSONObject().put("sensor", BATTERY_SENSOR).put("celsius", it)) }
                sensors.forEach { put(JSONObject().put("sensor", it.name).put("celsius", it.celsius)) }
            },
        )
        put(
            "disks",
            JSONArray().apply {
                if (storageTotalBytes > 0) {
                    put(
                        JSONObject()
                            .put("path", STORAGE_PATH)
                            .put("totalBytes", storageTotalBytes)
                            .put("usedBytes", storageUsedBytes)
                            .put("usedPercent", storageUsedPercent),
                    )
                }
            },
        )
        put(
            "network",
            JSONArray().apply {
                for ((name, counters) in traffic.toSortedMap()) {
                    val rate = rates[name]
                    put(
                        JSONObject()
                            .put("name", name)
                            .put("receivedBytes", counters.received)
                            .put("sentBytes", counters.sent)
                            .put("receiveBytesPerSecond", rate?.receive ?: 0.0)
                            .put("sendBytesPerSecond", rate?.send ?: 0.0),
                    )
                }
            },
        )
        put("gpus", JSONArray())
        batteryPercent?.let {
            put(
                "battery",
                JSONObject().put("percent", it).put("pluggedIn", pluggedIn).apply {
                    batteryDetails?.watts?.let { watts -> put("watts", watts) }
                },
            )
        }
        extras().takeIf { it.isNotEmpty() }?.let { extras ->
            put("extras", JSONArray().apply { extras.forEach { put(it.json()) } })
        }
        put(
            "system",
            JSONObject()
                .put("os", device.os)
                .put("kernel", device.kernel)
                .put("architecture", device.architecture)
                .put("maker", device.maker)
                .put("model", device.model),
        )
    }

    companion object {
        /** The sensor the battery's temperature is shown as. */
        const val BATTERY_SENSOR = "battery"

        /** The storage the phone's apps and files are on. */
        const val STORAGE_PATH = "/data"

        private fun percent(part: Long, whole: Long): Double =
            if (whole > 0) part * 100.0 / whole else 0.0
    }
}

/** What the phone is, read once, as den-watcher tells it of a machine. */
data class DeviceInfo(
    val name: String,
    val appVersion: String,
    val os: String,
    val kernel: String,
    val architecture: String,
    val maker: String,
    val model: String,
    val timeZoneName: String,
    val timeZoneOffsetSeconds: Int,
)
