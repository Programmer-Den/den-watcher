package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NetworksTest {
    @Test
    fun namesTheRangeAndTheGateway() {
        assertEquals("192.168.1.0/24 via 192.168.1.1", Networks.id(listOf("192.168.1.20/24"), listOf("192.168.1.1")))
        assertEquals("10.0.0.0/8", Networks.id(listOf("10.20.30.40/8"), emptyList()))
        assertEquals("172.16.4.0/22 via 172.16.4.1", Networks.id(listOf("172.16.5.9/22"), listOf("172.16.4.1", "172.16.4.2")))
    }

    @Test
    fun sameNetworkForEveryAddressInIt() {
        assertEquals(
            Networks.id(listOf("192.168.1.20/24"), listOf("192.168.1.1")),
            Networks.id(listOf("192.168.1.77/24"), listOf("192.168.1.1")),
        )
    }

    @Test
    fun noNetworkWithoutAnAddress() {
        assertNull(Networks.id(emptyList(), listOf("192.168.1.1")))
        assertNull(Networks.id(listOf("fe80::1/64", "300.1.1.1/24", "1.2.3.4/40"), emptyList()))
    }
}
