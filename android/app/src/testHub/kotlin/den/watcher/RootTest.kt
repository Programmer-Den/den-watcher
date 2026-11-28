package den.watcher

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RootTest {
    private val output = """
        cpu  100 0 100 700 100 0 0 0 0 0
        cpu0 50 0 50 350 50 0 0 0 0 0
        cpu1 50 0 50 350 50 0 0 0 0 0
        intr 12345
        --den-watcher--
        1804800
        2419200
        --den-watcher--
        cpu-0-0-usr 41200
        battery 30000
        gpuss-0 39800
        cpu-0-0-usr 43000
        pm8150b-ibat-lvl0 0
        sdm-therm -40000
        empty-zone
        --den-watcher--
        cpu  250 0 250 1300 200 0 0 0 0 0
        cpu0 150 0 150 650 50 0 0 0 0 0
        cpu1 100 0 100 650 150 0 0 0 0 0
        intr 23456
    """.trimIndent()

    @After
    fun forget() {
        Root.granted = null
        Root.run = { _, _ -> null }
    }

    @Test
    fun readsTheProcessorAndTheTemperatures() {
        val reading = Root.parse(output)!!
        // All: 300 busy of 1000 ticks. Core 0: 200 of 500. Core 1: 100 of 500, as iowait counts as idle.
        assertEquals(30.0, reading.processor.usagePercent, 0.001)
        assertEquals(listOf(40.0, 20.0), reading.processor.coreUsagePercent)
        assertEquals(2419.2, reading.processor.clockMHz!!, 0.001)
        assertEquals(
            listOf(Sensor("cpu-0-0-usr", 41.2), Sensor("gpuss-0", 39.8), Sensor("cpu-0-0-usr_2", 43.0)),
            reading.sensors,
        )
    }

    @Test
    fun readsZonesInWholeDegreesAndInTenths() {
        val zones = "xo-therm 38\nquiet-therm 385\npa-therm 38500\nodd 1999\noff 0\nbroken 200000"
        val reading = Root.parse(output.replace("cpu-0-0-usr 41200", zones))!!
        assertEquals(
            listOf(
                Sensor("xo-therm", 38.0),
                Sensor("quiet-therm", 38.5),
                Sensor("pa-therm", 38.5),
                // 199.9 °C in tenths is no temperature.
                Sensor("gpuss-0", 39.8),
                Sensor("cpu-0-0-usr", 43.0),
            ),
            reading.sensors,
        )
    }

    @Test
    fun countsOnlyTheCoresOnInBothReadings() {
        val reading = Root.parse(output.replace("cpu1 100 0 100 650 150 0 0 0 0 0", ""))!!
        assertEquals(listOf(40.0), reading.processor.coreUsagePercent)
    }

    @Test
    fun takesNoOtherOutput() {
        assertNull(Root.parse("Permission denied"))
        assertNull(Root.parse(output.substringBefore("cpu  250")))
    }

    @Test
    fun asksOnceAndGoesOnWithoutRootWhenRefused() {
        var asked = 0
        Root.run = { _, seconds ->
            asked++
            assertEquals(30L, seconds)
            null
        }
        assertNull(Root.read())
        assertNull(Root.read())
        assertEquals(1, asked)
        assertEquals(false, Root.granted)
    }

    @Test
    fun keepsRootWhenAReadingFailsLater() {
        val answers = mutableListOf(output, null, output)
        Root.run = { _, _ -> answers.removeAt(0) }
        assertEquals(30.0, Root.read()!!.processor.usagePercent, 0.001)
        assertNull(Root.read())
        assertEquals(true, Root.granted)
        assertEquals(30.0, Root.read()!!.processor.usagePercent, 0.001)
    }
}
