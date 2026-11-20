package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StillTest {
    private val home = "192.168.1.0/24 via 192.168.1.1"

    @Test
    fun samePlaceWhenTheScansShareHalfTheAccessPoints() {
        assertEquals(true, Still.samePlace(setOf("a", "b", "c", "d"), setOf("a", "b", "x", "y")))
        assertEquals(true, Still.samePlace(setOf("a", "b"), setOf("a", "x", "y", "z", "w")))
        assertEquals(false, Still.samePlace(setOf("a", "b", "c"), setOf("a", "x", "y")))
        assertNull(Still.samePlace(emptySet(), setOf("a")))
    }

    @Test
    fun stillWhenEverythingKnownSaysSo() {
        assertTrue(Still.isStill(true, 1_020, 1_000, home, home))
        assertTrue("only the scans are known", Still.isStill(true, null, null, null, null))
        assertTrue("only the steps are known", Still.isStill(null, 1_000 + Still.MAX_STEPS, 1_000, null, null))
    }

    @Test
    fun movingWhenAnythingSaysSo() {
        assertFalse("other access points", Still.isStill(false, 1_000, 1_000, home, home))
        assertFalse("walked", Still.isStill(true, 1_001 + Still.MAX_STEPS, 1_000, home, home))
        assertFalse("left the Wi-Fi", Still.isStill(true, 1_000, 1_000, null, home))
        assertFalse("another Wi-Fi", Still.isStill(true, 1_000, 1_000, "10.0.0.0/16 via 10.0.0.1", home))
    }

    @Test
    fun notStillWhenNothingIsKnown() {
        assertFalse(Still.isStill(null, null, null, null, null))
        assertFalse("the counter started again", Still.isStill(null, 10, 1_000, null, null))
    }

    @Test
    fun asksLessOftenWhileStill() {
        assertEquals(Still.STILL_EVERY_MILLIS, Still.every(true))
        assertEquals(Nearby.SCAN_EVERY_MILLIS, Still.every(false))
        assertEquals(Route.ASK_EVERY_MILLIS, Nearby.SCAN_EVERY_MILLIS)
    }

    @Test
    fun scansAndAsksAtThePaceGiven() {
        val now = 10_000_000L
        assertFalse(Nearby.scanDue(now - Nearby.SCAN_EVERY_MILLIS, 0, now, Still.STILL_EVERY_MILLIS))
        assertTrue(Nearby.scanDue(now - Still.STILL_EVERY_MILLIS, 0, now, Still.STILL_EVERY_MILLIS))
        assertFalse(Route.askDue(now - Route.ASK_EVERY_MILLIS, now, Still.STILL_EVERY_MILLIS))
        assertTrue(Route.askDue(now - Still.STILL_EVERY_MILLIS, now, Still.STILL_EVERY_MILLIS))
    }
}
