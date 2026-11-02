package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppUsesTest {
    private fun resumed(time: Long, app: String) = UsageEvent(time, Usage.ACTIVITY_RESUMED, app)
    private fun paused(time: Long, app: String) = UsageEvent(time, Usage.ACTIVITY_PAUSED, app)

    @Test
    fun anAppIsInUseUntilAnotherOneComesToTheFront() {
        val events = listOf(
            UsageEvent(900, Usage.KEYGUARD_HIDDEN, ""),
            resumed(1_000, "chat"),
            paused(5_000, "chat"),
            resumed(5_100, "maps"),
            paused(9_000, "maps"),
            UsageEvent(9_050, Usage.SCREEN_NON_INTERACTIVE, ""),
        )
        val read = Usage.uses(events, 20_000)
        assertEquals(
            listOf(AppUse("", 900, 0), AppUse("chat", 1_000, 4_000), AppUse("maps", 5_100, 3_900)),
            read.uses,
        )
        assertNull(read.openSince)
    }

    @Test
    fun aChangeBetweenTheScreensOfOneAppGoesOnWithTheSameUse() {
        val events = listOf(
            resumed(1_000, "chat"),
            paused(2_000, "chat"),
            resumed(2_010, "chat"),
            paused(4_000, "chat"),
            UsageEvent(4_100, Usage.KEYGUARD_SHOWN, ""),
        )
        assertEquals(listOf(AppUse("chat", 1_000, 3_000)), Usage.uses(events, 10_000).uses)
    }

    @Test
    fun theUseStillGoingOnIsReadAgainFromItsStart() {
        val events = listOf(resumed(1_000, "video"), paused(3_000, "maps"))
        val read = Usage.uses(events, 60_000)
        assertEquals(emptyList<AppUse>(), read.uses)
        assertEquals(1_000L, read.openSince)
        // Paused only just now: the next app may not be logged yet.
        assertEquals(1_000L, Usage.uses(listOf(resumed(1_000, "video"), paused(58_000, "video")), 60_000).openSince)
        // Paused long enough ago: over.
        val over = Usage.uses(listOf(resumed(1_000, "video"), paused(50_000, "video")), 60_000)
        assertEquals(listOf(AppUse("video", 1_000, 49_000)), over.uses)
        assertNull(over.openSince)
    }

    @Test
    fun theHomeScreenIsNoAppsTime() {
        val events = listOf(
            resumed(1_000, "launcher"),
            resumed(2_000, "chat"),
            paused(3_000, "chat"),
            resumed(3_050, "launcher"),
        )
        val read = Usage.uses(events, 10_000, skip = setOf("launcher"))
        assertEquals(listOf(AppUse("chat", 2_000, 1_000)), read.uses)
        assertNull(read.openSince)
    }

    @Test
    fun aUseIsKeptAsADayAtMost() {
        val events = listOf(resumed(0, "video"), UsageEvent(Usage.MAX_MILLIS * 2, Usage.DEVICE_SHUTDOWN, ""))
        assertEquals(listOf(AppUse("video", 0, Usage.MAX_MILLIS)), Usage.uses(events, Usage.MAX_MILLIS * 3).uses)
    }

    @Test
    fun theHubGetsAnUnlockWithoutAppOrLength() {
        val unlock = AppUse("", 900, 0).json(3)
        assertEquals(3, unlock.getLong("id"))
        assertEquals(900, unlock.getLong("start"))
        assertEquals(setOf("id", "start"), unlock.keys().asSequence().toSet())
        val use = AppUse("chat", 1_000, 4_000, "Chat").json(4)
        assertEquals("chat", use.getString("app"))
        assertEquals("Chat", use.getString("label"))
        assertEquals(4_000, use.getLong("millis"))
    }
}
