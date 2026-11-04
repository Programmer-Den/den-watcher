package den.watcher

import android.os.BatteryManager
import android.os.PowerManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HealthTest {
    private val details = BatteryDetails(
        status = BatteryManager.BATTERY_STATUS_CHARGING,
        plugged = BatteryManager.BATTERY_PLUGGED_USB,
        health = BatteryManager.BATTERY_HEALTH_GOOD,
        volts = 4.0,
        milliamps = -500.0,
        cycles = 312,
    )

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
        traffic = emptyMap(),
        batteryDetails = details,
        thermal = Thermal(PowerManager.THERMAL_STATUS_LIGHT, 42.0),
    )

    @Test
    fun measuresThePowerWithoutTheSign() {
        assertEquals(2.0, details.watts!!, 1e-9)
        assertNull(details.copy(milliamps = null).watts)
        assertNull(details.copy(volts = null).watts)
    }

    @Test
    fun keepsThePowerAndTheHeadroomInTheHistory() {
        val values = reading.values(emptyMap())
        assertEquals(2.0, values["extra:battery-health/power"]!!, 1e-9)
        assertEquals(42.0, values["extra:thermal/headroom"]!!, 1e-9)
        // A phone that tells neither keeps none of them.
        val without = reading.copy(batteryDetails = details.copy(volts = null), thermal = Thermal(PowerManager.THERMAL_STATUS_NONE, null))
        assertFalse(without.values(emptyMap()).keys.any { it.startsWith("extra:") })
    }

    @Test
    fun tellsTheDetailsAsExtrasInEveryLanguage() {
        val snapshot = reading.snapshot(emptyMap(), device())
        assertEquals(2.0, snapshot.getJSONObject("battery").getDouble("watts"), 1e-9)
        val extras = snapshot.getJSONArray("extras")
        assertEquals(2, extras.length())
        val battery = extras.getJSONObject(0)
        assertEquals(Health.BATTERY, battery.getString("id"))
        assertEquals("Akkuzustand", battery.getJSONObject("titles").getString("de"))
        val items = (0 until battery.getJSONArray("items").length()).map { battery.getJSONArray("items").getJSONObject(it) }.associateBy { it.getString("id") }
        assertEquals(listOf("power", "state", "charger", "health", "cycles", "voltage", "current"), items.keys.toList())
        assertTrue(items.getValue("power").getBoolean("history"))
        assertEquals("Charging", items.getValue("state").getString("text"))
        assertEquals("Lädt", items.getValue("state").getJSONObject("texts").getString("de"))
        assertEquals("USB", items.getValue("charger").getString("text"))
        assertEquals(312.0, items.getValue("cycles").getDouble("value"), 0.0)
        assertEquals(-500.0, items.getValue("current").getDouble("value"), 0.0)
        val heat = extras.getJSONObject(1)
        assertEquals(Health.THERMAL, heat.getString("id"))
        assertEquals("Light", heat.getJSONArray("items").getJSONObject(1).getString("text"))
    }

    @Test
    fun leavesOutTheExtrasThatAreNotCollected() {
        val limited = reading.limitedTo(DataChoice(thermal = false))
        assertEquals(listOf(Health.BATTERY), limited.extras().map { it.id })
        assertTrue(reading.limitedTo(DataChoice(battery = false, thermal = false)).extras().isEmpty())
        assertFalse(reading.limitedTo(DataChoice(system = false)).snapshot(emptyMap(), device()).has("extras"))
        assertFalse(DataChoice(thermal = false).keeps("extra:thermal/headroom"))
        assertFalse(DataChoice(battery = false).keeps("extra:battery-health/power"))
        assertTrue(DataChoice().keeps("extra:thermal/headroom"))
    }

    @Test
    fun describesTheExtrasAmongTheMinutes() {
        val minutes = listOf(Minute(60, mapOf("memory" to 50.0, "extra:thermal/headroom" to 30.0)))
        val extras = Push.body(120, null, minutes).getJSONObject("extras")
        assertEquals(listOf("extra:thermal/headroom"), extras.keys().asSequence().toList())
        val info = extras.getJSONObject("extra:thermal/headroom")
        assertEquals("Heat", info.getString("title"))
        assertEquals("percent", info.getString("unit"))
        assertEquals("Bis zur Drosselung", info.getJSONObject("labels").getString("de"))
        assertFalse(Push.body(120, null, listOf(Minute(60, mapOf("memory" to 50.0)))).has("extras"))
    }

    private fun device() = DeviceInfo("Phone", "1.0", "Android 15", "6.1", "aarch64", "Google", "Pixel 8", "CET", 3600)
}
