package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HubAddressTest {
    @Test
    fun takesAddressesWithAndWithoutPort() {
        assertEquals("http://192.168.1.20:9393/api/phone/minutes", HubAddress.pushUrl("192.168.1.20"))
        assertEquals("http://192.168.1.20:8080/api/phone/minutes", HubAddress.pushUrl(" 192.168.1.20:8080 "))
        assertEquals("http://raspberrypi.local:9393/api/phone/minutes", HubAddress.pushUrl("http://raspberrypi.local:9393/"))
        assertEquals("http://pi:9393/api/phone/minutes", HubAddress.pushUrl("HTTP://pi"))
    }

    @Test
    fun refusesWhatIsNoAddress() {
        assertNull(HubAddress.pushUrl(""))
        assertNull(HubAddress.pushUrl("https://pi:9393"))
        assertNull(HubAddress.pushUrl("pi:9393/devices"))
        assertNull(HubAddress.pushUrl("user@pi"))
        assertNull(HubAddress.pushUrl("pi:99999"))
        assertNull(HubAddress.pushUrl("my pi"))
    }
}
