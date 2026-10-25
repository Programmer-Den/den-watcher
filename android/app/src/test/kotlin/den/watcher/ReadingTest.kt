package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReadingTest {
    private fun reading(time: Long, uptime: Long, wifi: Traffic, mobile: Traffic = Traffic(0, 0)) = Reading(
        time = time,
        uptimeSeconds = uptime,
        batteryPercent = 80.0,
        pluggedIn = false,
        batteryCelsius = 31.5,
        memoryTotalBytes = 8_000,
        memoryAvailableBytes = 2_000,
        storageTotalBytes = 100,
        storageFreeBytes = 25,
        traffic = mapOf(Sampler.WIFI to wifi, Sampler.MOBILE to mobile),
    )

    @Test
    fun measuresSpeedsSinceTheReadingBefore() {
        val before = reading(1_000, 500, Traffic(1_000, 100))
        val now = reading(1_030, 530, Traffic(4_000, 400), Traffic(300, 0))
        val rates = now.ratesSince(before)
        assertEquals(Rates(100.0, 10.0), rates[Sampler.WIFI])
        assertEquals(Rates(10.0, 0.0), rates[Sampler.MOBILE])
    }

    @Test
    fun measuresNoSpeedsAfterARestartOrWithoutAReadingBefore() {
        val before = reading(1_000, 500, Traffic(1_000, 100))
        assertTrue(reading(1_030, 20, Traffic(4_000, 400)).ratesSince(before).isEmpty())
        assertTrue(reading(1_030, 530, Traffic(4_000, 400)).ratesSince(null).isEmpty())
        assertTrue(reading(1_000, 530, Traffic(4_000, 400)).ratesSince(before).isEmpty())
        assertFalse(Sampler.WIFI in reading(1_030, 530, Traffic(10, 400)).ratesSince(before))
    }

    @Test
    fun namesValuesAsDenWatcherDoes() {
        val now = reading(1_030, 530, Traffic(4_000, 400))
        val values = now.values(mapOf(Sampler.WIFI to Rates(100.0, 10.0)))
        assertEquals(
            mapOf(
                "battery" to 80.0,
                "temperature:battery" to 31.5,
                "memory" to 75.0,
                "disk:/data" to 75.0,
                "network.receive:wifi" to 100.0,
                "network.send:wifi" to 10.0,
            ),
            values,
        )
    }

    @Test
    fun tellsNoCoresInTheSnapshot() {
        val device = DeviceInfo("Pixel", "3.6.0", "Android 15", "6.1", "aarch64", "Google", "Pixel 8", "CET", 3600)
        val snapshot = reading(1_030, 530, Traffic(4_000, 400)).snapshot(emptyMap(), device)
        assertEquals(0, snapshot.getJSONObject("cpu").getInt("cores"))
        assertEquals("1970-01-01T00:17:10Z", snapshot.getString("time"))
        assertEquals(0, snapshot.getJSONArray("gpus").length())
        assertEquals("/data", snapshot.getJSONArray("disks").getJSONObject(0).getString("path"))
        assertEquals(2, snapshot.getJSONArray("network").length())
        assertEquals(80.0, snapshot.getJSONObject("battery").getDouble("percent"), 0.0)
    }
}
