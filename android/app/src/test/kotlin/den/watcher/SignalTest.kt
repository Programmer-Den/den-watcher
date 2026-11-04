package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SignalTest {
    private val reading = Reading(
        time = 1_000,
        uptimeSeconds = 500,
        batteryPercent = null,
        pluggedIn = false,
        batteryCelsius = null,
        memoryTotalBytes = 0,
        memoryAvailableBytes = 0,
        storageTotalBytes = 0,
        storageFreeBytes = 0,
        traffic = emptyMap(),
        wifiLink = WifiLink(dBm = -60, mbps = 866, mhz = 5180),
        mobileSignal = MobileSignal(Cellular.G5, level = 3, dBm = -95),
    )

    @Test
    fun measuresTheQualityAsTheWifiAddOnDoes() {
        assertEquals(100.0 * 50 / 70, WifiLink(-60, null, null).qualityPercent!!, 1e-9)
        assertEquals(0.0, WifiLink(-120, null, null).qualityPercent!!, 0.0)
        assertEquals(100.0, WifiLink(-20, null, null).qualityPercent!!, 0.0)
        assertNull(WifiLink(null, 72, null).qualityPercent)
    }

    @Test
    fun namesTheBands() {
        assertEquals("2.4 GHz", Signal.band(2437))
        assertEquals("5 GHz", Signal.band(5180))
        assertEquals("6 GHz", Signal.band(5955))
        assertNull(Signal.band(null))
    }

    @Test
    fun keepsTheQualityAndTheBarsInTheHistory() {
        val values = reading.values(emptyMap())
        assertEquals(100.0 * 50 / 70, values["extra:wifi/wifi-quality"]!!, 1e-9)
        assertEquals(75.0, values["extra:mobile-signal/level"]!!, 0.0)
        assertEquals(2, values.keys.count { it.startsWith("extra:") })
    }

    @Test
    fun tellsTheSignalAsExtras() {
        val extras = reading.extras()
        assertEquals(listOf(Signal.WIFI, Signal.MOBILE), extras.map { it.id })
        val wifi = extras[0].values.associateBy { it.id }
        assertEquals(listOf("wifi-quality", "wifi-signal", "wifi-speed", "wifi-band"), wifi.keys.toList())
        assertEquals(-60.0, wifi.getValue("wifi-signal").value!!, 0.0)
        assertEquals("5 GHz", wifi.getValue("wifi-band").text!!.en)
        val mobile = extras[1].values.associateBy { it.id }
        assertEquals("5G", mobile.getValue("network").text!!.en)
        assertEquals("Kein Empfang", Signal.mobileExtra(MobileSignal(Cellular.NONE, 0, null)).values[1].text!!.de)
    }

    @Test
    fun leavesOutTheSignalWithTheTraffic() {
        val limited = reading.limitedTo(DataChoice(traffic = false))
        assertTrue(limited.extras().isEmpty())
        assertFalse(DataChoice(network = false).keeps("extra:wifi/wifi-quality"))
        assertFalse(DataChoice(traffic = false).keeps("extra:mobile-signal/level"))
    }

    @Test
    fun describesTheSignalAmongTheMinutes() {
        val minutes = listOf(Minute(60, mapOf("extra:mobile-signal/level" to 50.0)))
        val info = Push.body(120, null, minutes).getJSONObject("extras").getJSONObject("extra:mobile-signal/level")
        assertEquals("Mobile signal", info.getString("title"))
        assertEquals("Signalbalken", info.getJSONObject("labels").getString("de"))
    }
}
