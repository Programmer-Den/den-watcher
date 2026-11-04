package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WifiLogTest {
    private val home = Connection("Home", 1_000_000, 1_030_000)

    @Test
    fun goesOnWithTheSameWifi() {
        val followed = WifiLog.follow(home, "Home", 1_060_000)
        assertFalse(followed.closed)
        assertEquals(Connection("Home", 1_000_000, 1_060_000), followed.open)
    }

    @Test
    fun endsWhenThePhoneLeavesTheWifi() {
        val followed = WifiLog.follow(home, null, 1_060_000)
        assertTrue(followed.closed)
        assertNull(followed.open)
    }

    @Test
    fun startsAnotherOnAnotherWifi() {
        val followed = WifiLog.follow(home, "Work", 1_060_000)
        assertTrue(followed.closed)
        assertEquals(Connection("Work", 1_060_000, 1_060_000), followed.open)
    }

    @Test
    fun startsAnewAfterALongGapOrWhenTheClockWentBack() {
        val later = home.end + WifiLog.MAX_GAP_MILLIS + 1
        assertEquals(Connection("Home", later, later), WifiLog.follow(home, "Home", later).open)
        assertTrue(WifiLog.follow(home, "Home", later).closed)
        assertEquals(Connection("Home", 500, 500), WifiLog.follow(home, "Home", 500).open)
    }

    @Test
    fun startsTheFirst() {
        val followed = WifiLog.follow(null, "Home", 5)
        assertFalse(followed.closed)
        assertEquals(Connection("Home", 5, 5), followed.open)
        assertEquals(WifiLog.Followed(false, null), WifiLog.follow(null, null, 5))
    }

    @Test
    fun readsTheNameAndOnlyAName() {
        assertEquals("Home", WifiLog.name("\"Home\""))
        assertEquals("café 5G", WifiLog.name("\"café 5G\""))
        assertEquals("0a1b2c", WifiLog.name("0a1b2c"))
        assertNull(WifiLog.name("<unknown ssid>"))
        assertNull(WifiLog.name("\"\""))
        assertNull(WifiLog.name(null))
    }

    @Test
    fun sendsTheOpenOneAsOpen() {
        val json = home.json(7, open = true)
        assertEquals(7, json.getLong("id"))
        assertEquals("Home", json.getString("ssid"))
        assertEquals(1_030_000, json.getLong("end"))
        assertTrue(json.getBoolean("open"))
        assertFalse(home.json(7, open = false).has("open"))
    }
}
