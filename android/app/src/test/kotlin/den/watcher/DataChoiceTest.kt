package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DataChoiceTest {
    private val reading = Reading(
        time = 1_000,
        uptimeSeconds = 500,
        batteryPercent = 80.0,
        pluggedIn = true,
        batteryCelsius = 31.5,
        memoryTotalBytes = 8_000,
        memoryAvailableBytes = 2_000,
        storageTotalBytes = 100,
        storageFreeBytes = 25,
        traffic = mapOf(Sampler.WIFI to Traffic(1_000, 100)),
    )

    @Test
    fun keepsEverythingByDefault() {
        assertEquals(reading, reading.limitedTo(DataChoice()))
        assertTrue(DataChoice().collectsNearby)
    }

    @Test
    fun leavesOutWhatIsSwitchedOff() {
        val limited = reading.limitedTo(DataChoice(battery = false, storage = false, traffic = false))
        assertNull(limited.batteryPercent)
        assertNull(limited.batteryCelsius)
        assertFalse(limited.pluggedIn)
        assertEquals(8_000L, limited.memoryTotalBytes)
        assertEquals(0L, limited.storageTotalBytes)
        assertTrue(limited.traffic.isEmpty())
        val values = limited.values(emptyMap())
        assertEquals(setOf("memory"), values.keys)
    }

    @Test
    fun aGroupSwitchedOffLeavesOutAllOfIt() {
        val noSystem = DataChoice(system = false)
        assertFalse(noSystem.collectsBattery || noSystem.collectsMemory || noSystem.collectsStorage)
        assertTrue(noSystem.collectsTraffic && noSystem.collectsNearby)
        val noNetwork = DataChoice(network = false)
        assertFalse(noNetwork.collectsTraffic || noNetwork.collectsNearby)
        assertTrue(reading.limitedTo(noNetwork).traffic.isEmpty())
        assertEquals(0L, reading.limitedTo(noSystem).memoryTotalBytes)
    }
}
