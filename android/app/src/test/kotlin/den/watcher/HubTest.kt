package den.watcher

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubTest {
    private val home = "192.168.1.0/24 via 192.168.1.1"
    private val work = "10.0.0.0/16 via 10.0.0.1"
    private val address = "192.168.1.9:9393"
    private val usual = setOf(home)

    @Test
    fun waitsOnAnotherNetworkWhereTheHubDidNotAnswerLately() {
        val unreachable = Hub.place(address, work) to 1_000L
        assertTrue(Hub.waits(address, work, usual, unreachable, 1_000L))
        assertTrue(Hub.waits(address, work, usual, unreachable, 1_000L + Hub.RETRY_ELSEWHERE_SECONDS - 1))
        assertFalse(Hub.waits(address, work, usual, unreachable, 1_000L + Hub.RETRY_ELSEWHERE_SECONDS))
    }

    @Test
    fun triesAtOnceOnTheUsualNetwork() {
        assertFalse(Hub.waits(address, home, usual, Hub.place(address, home) to 1_000L, 1_010L))
    }

    @Test
    fun triesAtOnceBeforeAUsualNetworkIsKnown() {
        assertFalse(Hub.waits(address, work, emptySet(), Hub.place(address, work) to 1_000L, 1_010L))
    }

    @Test
    fun triesAtOnceOnAnotherNetworkOrAddress() {
        val unreachable = Hub.place(address, work) to 1_000L
        assertFalse(Hub.waits(address, "172.16.0.0/24 via 172.16.0.1", usual, unreachable, 1_010L))
        assertFalse(Hub.waits("192.168.1.10:9393", work, usual, unreachable, 1_010L))
        assertFalse(Hub.waits(address, null, usual, unreachable, 1_010L))
        assertFalse(Hub.waits(address, work, usual, null, 1_010L))
    }

    @Test
    fun triesAtOnceAfterTheClockWentBack() {
        assertFalse(Hub.waits(address, work, usual, Hub.place(address, work) to 1_000L, 900L))
    }
}
