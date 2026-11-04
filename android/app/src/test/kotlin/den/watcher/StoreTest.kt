package den.watcher

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class StoreTest {
    private val store = Store(RuntimeEnvironment.getApplication())

    @After
    fun close() = store.close()

    private val start = 1_800_000_000_000L

    @Test
    fun keepsOneConnectionWhileThePhoneStaysOnAWifi() {
        store.addConnection("Home", start)
        store.addConnection("Home", start + 30_000)
        store.addConnection("Home", start + 60_000)
        val sent = store.connections()
        assertEquals(1, sent.size)
        assertEquals(start, sent[0].getLong("start"))
        assertEquals(start + 60_000, sent[0].getLong("end"))
        assertTrue(sent[0].getBoolean("open"))
    }

    @Test
    fun sendsTheOpenOneAgainOnlyOnceItWentOn() {
        store.addConnection("Home", start)
        store.connectionsTaken(store.connections().last().getLong("id"))
        assertTrue(store.connections().isEmpty())
        store.addConnection("Home", start + 60_000)
        assertTrue(store.connections().isEmpty())
        store.addConnection("Home", start + WifiLog.RESEND_MILLIS)
        assertEquals(start + WifiLog.RESEND_MILLIS, store.connections().single().getLong("end"))
    }

    @Test
    fun deletesTheOnesOverOnceTheHubHasThem() {
        store.addConnection("Home", start)
        store.addConnection("Home", start + 30_000)
        store.addConnection(null, start + 60_000)
        store.addConnection("Work", start + 90_000)
        val sent = store.connections()
        assertEquals(listOf("Home", "Work"), sent.map { it.getString("ssid") })
        assertFalse(sent[0].has("open"))
        assertEquals(start + 30_000, sent[0].getLong("end"))
        store.connectionsTaken(sent.last().getLong("id"))
        // The open one stays, until it is over and the hub has it too.
        assertTrue(store.connections().isEmpty())
        store.addConnection(null, start + 120_000)
        val over = store.connections().single()
        assertEquals("Work", over.getString("ssid"))
        store.connectionsTaken(over.getLong("id"))
        store.addConnection(null, start + 150_000)
        assertTrue(store.connections().isEmpty())
    }

    @Test
    fun keepsWhatTheHubDoesNotHaveYet() {
        store.addConnection("Home", start)
        store.addConnection("Work", start + 30_000)
        val sent = store.connections()
        store.connectionsTaken(sent.first().getLong("id"))
        assertEquals(listOf("Work"), store.connections().map { it.getString("ssid") })
        store.deleteConnections()
        assertTrue(store.connections().isEmpty())
    }
}
