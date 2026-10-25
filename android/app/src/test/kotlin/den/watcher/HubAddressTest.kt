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
    fun opensTheHubsPage() {
        assertEquals("http://192.168.1.20:9393/", HubAddress.pageUrl("192.168.1.20"))
        assertEquals("http://raspberrypi.local:8080/", HubAddress.pageUrl("http://raspberrypi.local:8080/"))
        assertNull(HubAddress.pageUrl(""))
        assertNull(HubAddress.pageUrl("pi:9393/devices"))
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

    @Test
    fun takesTheAddressFromTheHubsCode() {
        assertEquals("192.168.1.20:9393", HubAddress.fromCode("http://192.168.1.20:9393/"))
        assertEquals("raspberrypi.local:8080", HubAddress.fromCode(" HTTP://raspberrypi.local:8080 "))
        assertEquals("pi:9393", HubAddress.fromCode("http://pi"))
    }

    @Test
    fun refusesACodeWithoutAHubsAddress() {
        // A code holds the page's address, so text without http:// is no hub's.
        assertNull(HubAddress.fromCode("192.168.1.20:9393"))
        assertNull(HubAddress.fromCode("https://shop.example/offer"))
        assertNull(HubAddress.fromCode("http://shop.example/offer"))
        assertNull(HubAddress.fromCode("WIFI:S:Home;T:WPA;P:secret;;"))
    }
}
