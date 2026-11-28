package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HubConfigTest {
    @Test
    fun settingsHaveTheDatabaseTheDiskAndTheOwnPhone() {
        assertEquals(
            "LISTEN_ADDR=:9393\nDATABASE_PATH=/data/files/den-watcher.db\nDISK_PATHS=/data/files\nHUB_OWN_PHONE=Old Pixel=7KQMX2RP",
            HubConfig.settings("/data/files/den-watcher.db", "/data/files", "Old Pixel=7KQMX2RP"),
        )
        assertEquals(
            "LISTEN_ADDR=:9393\nDATABASE_PATH=/db\nDISK_PATHS=/data",
            HubConfig.settings("/db", "/data", null),
        )
    }

    @Test
    fun phoneNameIsTheDevicesNameOrItsModel() {
        assertEquals("Old Pixel", HubConfig.phoneName(" Old Pixel ", "Pixel 6"))
        assertEquals("Pixel 6", HubConfig.phoneName(null, "Pixel 6"))
        assertEquals("Pixel 6", HubConfig.phoneName("  ", "Pixel 6"))
        // The setting is name=code, so the name holds no = or comma.
        assertEquals("ab cd", HubConfig.phoneName("a=b c,d", "Pixel 6"))
        assertEquals(64, HubConfig.phoneName("x".repeat(100), "Pixel 6").length)
    }

    @Test
    fun phoneNameIsNeverTheHubsOwn() {
        assertEquals("Hub phone", HubConfig.phoneName("Host Hub", "Pixel 6"))
        assertEquals("Hub phone", HubConfig.phoneName("local", "Pixel 6"))
        assertEquals("Hub phone", HubConfig.phoneName("---", "Pixel 6"))
    }

    @Test
    fun pageUrlHasThePort() {
        assertEquals("http://192.168.1.20:9393/", HubConfig.pageUrl("192.168.1.20"))
        assertEquals("http://[fd00::1]:9393/", HubConfig.pageUrl("fd00::1"))
        assertNull(HubConfig.pageUrl(null))
    }

    @Test
    fun theOwnRecordingSendsToTheHubNextToIt() {
        assertEquals("http://127.0.0.1:9393/api/phone/minutes", HubAddress.pushUrl(HubConfig.LOCAL_ADDRESS))
    }
}
