package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TrackingTest {
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
        assertEquals(reading, reading.limitedTo(Tracking()))
        assertTrue(Tracking().tracksNearby)
    }

    @Test
    fun leavesOutWhatIsSwitchedOff() {
        val limited = reading.limitedTo(Tracking(battery = false, storage = false, traffic = false))
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
        val noSystem = Tracking(system = false)
        assertFalse(noSystem.tracksBattery || noSystem.tracksMemory || noSystem.tracksStorage)
        assertTrue(noSystem.tracksTraffic && noSystem.tracksNearby)
        val noNetwork = Tracking(network = false)
        assertFalse(noNetwork.tracksTraffic || noNetwork.tracksNearby)
        assertTrue(reading.limitedTo(noNetwork).traffic.isEmpty())
        assertEquals(0L, reading.limitedTo(noSystem).memoryTotalBytes)
    }
}
