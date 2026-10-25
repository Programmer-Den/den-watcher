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
}
