package den.watcher

import java.net.Inet6Address
import java.net.InetAddress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LanAddressTest {
    private val ipv4 = InetAddress.getByName("192.168.1.20")

    @Test
    fun listsAnAddressWithItsSubnet() {
        assertEquals("192.168.1.20/24", LanAddress.withSubnet(ipv4, 24))
        assertEquals("127.0.0.1/8", LanAddress.withSubnet(InetAddress.getByName("127.0.0.1"), 8))
        val ipv6 = LanAddress.withSubnet(InetAddress.getByName("2001:db8:1:2::20"), 64)!!
        assertTrue(ipv6, ipv6.startsWith("2001:db8:1:2:") && ipv6.endsWith("/64"))
    }

    @Test
    fun leavesOutTheInterfaceOfALinkLocalAddress() {
        val bytes = InetAddress.getByName("fe80::1").address
        val scoped = LanAddress.withSubnet(Inet6Address.getByAddress(null, bytes, 3), 64)!!
        assertTrue(scoped, scoped.startsWith("fe80:") && scoped.endsWith("/64") && '%' !in scoped)
    }

    @Test
    fun leavesOutWhatHasNoSubnet() {
        assertNull(LanAddress.withSubnet(null, 24))
        assertNull(LanAddress.withSubnet(ipv4, -1))
        // Longer than an IPv4 address, as Java tells of some interfaces.
        assertNull(LanAddress.withSubnet(ipv4, 64))
    }
}
