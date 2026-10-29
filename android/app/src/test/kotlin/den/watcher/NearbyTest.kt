package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NearbyTest {
    @Test
    fun hashesTheAddressAndItsMiddleAsTheHubDoes() {
        // As in den-watcher's TestAccessPointIDHashesTheAddressAndItsMiddleForTheBox.
        val json = AccessPoint("aa:bb:cc:dd:ee:ff", "Den", -60, 5180, 80, "WPA2", 6, true).json()!!
        assertEquals("17226b1f68ae", json.getString("id"))
        assertEquals("74c108fcc2a3", json.getString("box"))
        assertEquals(80.0, json.getDouble("signalPercent"), 0.0)
        assertEquals(-60, json.getInt("signalDBm"))
        assertEquals(true, json.getBoolean("connected"))
        assertNull(AccessPoint("aa:bb:cc", "Den", -60, 0, 0, "", 0, false).json())
    }

    @Test
    fun keepsTheSameScanReadAgainOnce() {
        assertFalse(Nearby.isNew(1_000, 1_000, 1_030))
        assertFalse(Nearby.isNew(1_001, 1_000, 1_030))
        assertTrue(Nearby.isNew(1_020, 1_000, 1_030))
        // The clock went back.
        assertTrue(Nearby.isNew(500, 1_000, 510))
    }

    @Test
    fun leavesOutWhatIsNotKnown() {
        val json = AccessPoint("AA:BB:CC:DD:EE:FF", "", -120, 0, 0, "", 0, false).json()!!
        assertEquals("17226b1f68ae", json.getString("id"))
        assertEquals(0.0, json.getDouble("signalPercent"), 0.0)
        for (key in listOf("ssid", "frequencyMHz", "widthMHz", "security", "generation", "connected")) {
            assertFalse(key, json.has(key))
        }
    }

    @Test
    fun namesTheSecurityAsTheHubDoes() {
        mapOf(
            "[ESS]" to "Open",
            "[WEP][ESS]" to "WEP",
            "[WPA-PSK-TKIP][ESS]" to "WPA",
            "[WPA2-PSK-CCMP][ESS]" to "WPA2",
            "[RSN-PSK-CCMP][ESS]" to "WPA2",
            "[RSN-SAE-CCMP][ESS]" to "WPA3",
            "[RSN-PSK+SAE-CCMP][ESS]" to "WPA2/WPA3",
            "[WPA2-EAP/SHA1-CCMP][RSN-EAP/SHA1-CCMP][ESS]" to "WPA2 Enterprise",
            "[RSN-OWE-CCMP][ESS]" to "OWE",
        ).forEach { (caps, want) -> assertEquals(caps, want, Nearby.security(caps)) }
    }

    @Test
    fun readsTheWidthAndGeneration() {
        assertEquals(20, Nearby.width(0))
        assertEquals(160, Nearby.width(4))
        assertEquals(0, Nearby.width(-1))
        assertEquals(6, Nearby.generation(6))
        assertEquals(7, Nearby.generation(8))
        assertEquals(0, Nearby.generation(1))
    }

    @Test
    fun aScanSendsItsTimeAndAccessPoints() {
        val scan = Scan(600, listOf(AccessPoint("aa:bb:cc:dd:ee:ff", "Den", -60, 5180, 80, "WPA2", 6, false), AccessPoint("bad", "", -60, 0, 0, "", 0, false)))
        val json = scan.json()
        assertEquals(600, json.getLong("time"))
        assertEquals(1, json.getJSONArray("accessPoints").length())
    }
}
