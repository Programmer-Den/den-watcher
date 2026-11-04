package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class PushTest {
    private fun minutes(count: Int, values: Int) =
        List(count) { i -> Minute(i * 60L, (0 until values).associate { "extra:v/$it" to it.toDouble() }) }

    @Test
    fun fitsAtMostTheMinutesTheHubTakes() {
        assertEquals(Push.MAX_MINUTES, Push.fit(minutes(500, 3)).size)
        assertEquals(10, Push.fit(minutes(10, 3)).size)
    }

    @Test
    fun fitsAtMostTheValuesTheHubTakes() {
        assertEquals(Push.MAX_VALUES / 1000, Push.fit(minutes(50, 1000)).size)
        // A minute with more than fit in one push is still sent, alone.
        assertEquals(1, Push.fit(minutes(3, Push.MAX_VALUES + 1)).size)
    }

    @Test
    fun leavesOutTheSnapshotWhenThereIsNone() {
        val body = Push.body(600, null, minutes(2, 1))
        assertEquals(600, body.getLong("now"))
        assertFalse(body.has("snapshot"))
        assertEquals(60, body.getJSONArray("minutes").getJSONObject(1).getLong("time"))
    }

    @Test
    fun sendsTheScansOnlyWhenThereAreSome() {
        assertFalse(Push.body(600, null, emptyList()).has("wifi"))
        val scan = Scan(540, emptyList()).json()
        val body = Push.body(600, null, emptyList(), scans = listOf(scan))
        assertEquals(540, body.getJSONArray("wifi").getJSONObject(0).getLong("time"))
    }

    @Test
    fun sendsTheUsesOfAppsOnlyWhenThereAreSome() {
        assertFalse(Push.body(600, null, emptyList()).has("uses"))
        val use = AppUse("chat", 540_000, 1_000, "Chat").json(7)
        val body = Push.body(600, null, emptyList(), uses = listOf(use))
        assertEquals(7, body.getJSONArray("uses").getJSONObject(0).getLong("id"))
    }

    @Test
    fun sendsTheConnectionsOnlyWhenThereAreSome() {
        assertFalse(Push.body(600, null, emptyList()).has("connections"))
        val connection = Connection("Home", 540_000, 600_000).json(3, open = true)
        val body = Push.body(600, null, emptyList(), connections = listOf(connection))
        assertEquals("Home", body.getJSONArray("connections").getJSONObject(0).getString("ssid"))
    }
}
