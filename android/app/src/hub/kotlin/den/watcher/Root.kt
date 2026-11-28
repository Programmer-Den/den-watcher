package den.watcher

import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * What only root can read, which a rooted hub app adds to its phone part's
 * readings: how busy the processor and each core are, its clock, and the
 * temperatures of the device's thermal zones. Android hides them from apps.
 *
 * Root is asked for at the first reading after the app starts, through `su`,
 * whose root manager (Magisk, KernelSU) asks the user once. Without `su`, or
 * when root is refused, the app goes on with what Android gives every app and
 * does not ask again until it starts again. Everything is only read.
 */
object Root {
    /** How long the first ask waits, while the root manager may ask the user. */
    private const val ASK_SECONDS = 30L

    /** How long a reading waits once root is granted. */
    private const val READ_SECONDS = 10L

    /** Marks where one part of the script's output ends. */
    private const val END = "--den-watcher--"

    /**
     * Reads the files in one `su` call: the processor's counters twice, a
     * second apart, for its usage in between, the clock of each group of
     * cores and each thermal zone's name and temperature.
     */
    private val SCRIPT = """
        cat /proc/stat
        echo $END
        cat /sys/devices/system/cpu/cpufreq/policy*/scaling_cur_freq 2>/dev/null
        echo $END
        for zone in /sys/class/thermal/thermal_zone*; do echo "${'$'}(cat ${'$'}zone/type 2>/dev/null) ${'$'}(cat ${'$'}zone/temp 2>/dev/null)"; done
        echo $END
        sleep 1
        cat /proc/stat
    """.trimIndent()

    /** The most thermal zones kept, as den-watcher keeps of a device's sensors. */
    private const val MAX_SENSORS = 64

    /** The highest temperature taken as one, in °C; above is a zone that tells something else. */
    private const val MAX_CELSIUS = 150.0

    /**
     * Runs a script as root, waiting at most the seconds, and returns what it
     * printed, or null when there is no root, it was refused or took too
     * long. Tests replace it.
     */
    internal var run: (script: String, seconds: Long) -> String? = ::su

    /** Whether root was granted since the app started; null before it was asked. */
    @Volatile
    var granted: Boolean? = null
        internal set

    /** What root reads now, or null without root. */
    @Synchronized
    fun read(): RootReading? {
        if (granted == false) {
            return null
        }
        val reading = run(SCRIPT, if (granted == null) ASK_SECONDS else READ_SECONDS)?.let(::parse)
        // Once granted, a reading that fails is skipped, not taken as a refusal.
        if (granted == null) {
            granted = reading != null
        }
        return reading
    }

    /** The reading in the script's output, or null when it is not the script's. */
    internal fun parse(output: String): RootReading? {
        val parts = output.split(END)
        if (parts.size != 4) {
            return null
        }
        val before = cpuTimes(parts[0])
        val after = cpuTimes(parts[3])
        val total = before[ALL]?.let { start -> after[ALL]?.let { start.usageTo(it) } } ?: return null
        // Cores the kernel switched off in between have no line, so only those in both count.
        val cores = after.keys.filter { it != ALL && it in before }
            .sortedBy { it.removePrefix(ALL).toIntOrNull() ?: Int.MAX_VALUE }
            .map { before.getValue(it).usageTo(after.getValue(it)) }
        val clock = parts[1].lines().mapNotNull { it.trim().toLongOrNull() }.maxOrNull()?.let { it / 1000.0 }
        return RootReading(Processor(total, cores, clock), sensors(parts[2]))
    }

    /** The name of /proc/stat's line for all cores; each core's is this and its number. */
    private const val ALL = "cpu"

    /** The busy and total time of the processor and of each core, by their line's name. */
    private fun cpuTimes(stat: String): Map<String, CpuTimes> = stat.lines().mapNotNull { line ->
        val fields = line.trim().split(Regex("\\s+"))
        if (!fields[0].startsWith(ALL) || fields.size < 9) return@mapNotNull null
        // user nice system idle iowait irq softirq steal; guest is counted in user already.
        val times = fields.subList(1, 9).map { it.toLongOrNull() ?: return@mapNotNull null }
        val idle = times[3] + times[4]
        fields[0] to CpuTimes(times.sum() - idle, times.sum())
    }.toMap()

    /** Below this, a thermal zone's value is taken as whole degrees. */
    private const val DEGREES_BELOW = 200L

    /** Below this, and from DEGREES_BELOW, a thermal zone's value is taken as tenths of a degree. */
    private const val TENTHS_BELOW = 2_000L

    /**
     * A thermal zone's value in °C. Linux keeps millidegrees, but some
     * Android kernels tell single zones in whole degrees (38) or in tenths
     * (385), which as millidegrees were 0.04 °C or 0.4 °C. No zone of a
     * running device is colder than 2 °C, so a value that small is one of
     * those.
     */
    internal fun toCelsius(value: Long): Double = when {
        value < DEGREES_BELOW -> value.toDouble()
        value < TENTHS_BELOW -> value / 10.0
        else -> value / 1000.0
    }

    /**
     * The thermal zones that tell a temperature, by their name, in °C (see
     * toCelsius); a name used again gets its count, as den-watcher numbers
     * sensors of the same name. The battery's zone is left out, as Android
     * tells its temperature already.
     */
    private fun sensors(zones: String): List<Sensor> {
        val seen = mutableMapOf<String, Int>()
        return zones.lines().mapNotNull { line ->
            val name = line.substringBeforeLast(' ').trim()
            val celsius = toCelsius(line.substringAfterLast(' ').trim().toLongOrNull() ?: return@mapNotNull null)
            if (name.isEmpty() || name == Reading.BATTERY_SENSOR || celsius <= 0 || celsius > MAX_CELSIUS) {
                return@mapNotNull null
            }
            val count = (seen[name] ?: 0) + 1
            seen[name] = count
            Sensor(if (count == 1) name else "${name}_$count", celsius)
        }.take(MAX_SENSORS)
    }

    private fun su(script: String, seconds: Long): String? = try {
        val process = ProcessBuilder("su", "-c", script).redirectErrorStream(true).start()
        // The output is a few kilobytes, which the pipe holds until it is read.
        if (!process.waitFor(seconds, TimeUnit.SECONDS)) {
            process.destroy()
            null
        } else {
            process.inputStream.bufferedReader().readText().takeIf { process.exitValue() == 0 }
        }
    } catch (_: IOException) {
        // No su: the device is not rooted.
        null
    }
}

/** What root read: the processor and the thermal zones' temperatures. */
data class RootReading(val processor: Processor, val sensors: List<Sensor>)

/** How long the processor or a core was busy, and in all, in ticks since the start. */
private data class CpuTimes(val busy: Long, val total: Long) {
    /** How busy it was from this up to then, in percent. */
    fun usageTo(then: CpuTimes): Double {
        val total = then.total - total
        return if (total > 0) ((then.busy - busy) * 100.0 / total).coerceIn(0.0, 100.0) else 0.0
    }
}
