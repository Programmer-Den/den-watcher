package den.watcher

import android.os.PowerManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ActiveTest {
    private val app = RuntimeEnvironment.getApplication()
    private val power = shadowOf(app.getSystemService(PowerManager::class.java))

    @Test
    fun isOffUntilSwitchedOn() {
        assertFalse(Settings(app).activeTracking)
        assertFalse(Active.on(app))
        Settings(app).activeTracking = true
        assertTrue(Active.on(app))
    }

    @Test
    fun pausesWhileSavingBattery() {
        val settings = Settings(app).apply { activeTracking = true }
        settings.saveBattery = true
        assertFalse(Active.on(app))
        settings.saveBattery = false
        power.setIsPowerSaveMode(true)
        assertFalse(Active.on(app))
        power.setIsPowerSaveMode(false)
        assertTrue(Active.on(app))
    }

    @Test
    fun asksEveryMinuteAlsoWhileStill() {
        assertEquals(Active.EVERY_MILLIS, Active.every(active = true, still = false))
        assertEquals(Active.EVERY_MILLIS, Active.every(active = true, still = true))
        assertEquals(Nearby.SCAN_EVERY_MILLIS, Active.every(active = false, still = false))
        assertEquals(Still.STILL_EVERY_MILLIS, Active.every(active = false, still = true))
    }

    @Test
    fun isNeverLockedByTheHub() {
        val settings = Settings(app).apply {
            paired = true
            releasedAt = 0
            releasedUntil = 0
        }
        assertTrue(settings.locked())
        settings.activeTracking = true
        assertTrue(settings.activeTracking)
    }
}
