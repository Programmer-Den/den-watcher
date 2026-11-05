package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppDataTest {
    @Test
    fun usesAReadAgainOnlyWhileYoungAndOfTheSameDay() {
        val day = 86_400_000L
        val minute = 60_000L
        assertTrue(AppData.reusable(day - 20 * minute, 0, day - 15 * minute, 0))
        // Read at 23:55, asked at 00:02: yesterday's count is not today's.
        assertFalse(AppData.reusable(day - 5 * minute, 0, day + 2 * minute, day))
        assertFalse(AppData.reusable(0, 0, 10 * minute, 0))
        // After the clock went back.
        assertFalse(AppData.reusable(10 * minute, 0, 5 * minute, 0))
    }

    @Test
    fun listsTheAppsMostFirstAndAddsUpTheRest() {
        val apps = (1..15).map { AppBytes("org.example.app$it", "App $it", it * 1_000L) } +
            AppBytes("org.example.app3", "App 3", 10_000) +
            AppBytes("org.hidden", "", 7) +
            AppBytes("removed", "", 40_000)
        val extras = AppData.extras(AppTraffic(apps, emptyList()))
        assertEquals(listOf(AppData.WIFI), extras.map { it.id })
        val values = extras.single().values
        assertEquals(AppData.MAX_APPS + 1, values.size)
        assertEquals("Removed apps", values.first().label.en)
        assertEquals("App 15", values[1].label.en)
        // The same app under two numbers is added up.
        assertEquals(13_000.0, values.single { it.label.en == "App 3" }.value!!, 0.0)
        // Past the first 12 named ones, and the ones without a name.
        val other = values.last()
        assertEquals("other", other.id)
        assertEquals("Andere Apps", other.label.de)
        assertEquals(5_000.0 + 4_000.0 + 2_000.0 + 1_000.0 + 7, other.value!!, 0.0)
        assertTrue(values.all { it.unit == ExtraUnit.BYTES && !it.history })
    }

    @Test
    fun leavesOutANetworkWithoutData() {
        val extras = AppData.extras(AppTraffic(emptyList(), listOf(AppBytes("org.example", "Example", 10))))
        assertEquals(listOf(AppData.MOBILE), extras.map { it.id })
        assertEquals("Datos por app hoy: móvil", extras.single().title.es)
    }

    @Test
    fun makesIdsDenWatcherTakes() {
        assertEquals("org-mozilla-firefox", AppData.idOf("org.mozilla.firefox"))
        assertEquals(40, AppData.idOf("com.example." + "a".repeat(60)).length)
        assertEquals("other", AppData.idOf("..."))
    }

    @Test
    fun tellsTheStoragePerAppAsAnExtra() {
        val extra = AppStorage.extra(listOf(AppBytes("org.example.small", "Small", 10), AppBytes("org.example.big", "Big", 2_000)))
        assertEquals(AppStorage.GROUP, extra.id)
        assertEquals("Speicher pro App", extra.title.de)
        assertEquals(listOf("Big", "Small"), extra.values.map { it.label.en })
        val reading = Reading(1_000, 500, 0, null, false, null, 0, 0, 0, 0, emptyMap(), appStorage = listOf(AppBytes("org.example", "Example", 5)))
        assertEquals(listOf(AppStorage.GROUP), reading.extras().map { it.id })
        assertEquals(emptyList<Extra>(), reading.limitedTo(DataChoice(storage = false)).extras())
    }
}
