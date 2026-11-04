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
class SavingTest {
    private val app = RuntimeEnvironment.getApplication()
    private val power = shadowOf(app.getSystemService(PowerManager::class.java))

    @Test
    fun readsLessOftenOnlyWhileSavingWithTheScreenOff() {
        power.setIsInteractive(false)
        assertEquals(30_000L, Saving.interval(app, 30_000L))
        Settings(app).saveBattery = true
        assertTrue(Saving.on(app))
        assertEquals(Saving.SAVING_INTERVAL_MILLIS, Saving.interval(app, 30_000L))
        power.setIsInteractive(true)
        assertEquals(30_000L, Saving.interval(app, 30_000L))
    }

    @Test
    fun savesWhileAndroidsBatterySaverIsOn() {
        assertFalse(Saving.on(app))
        power.setIsPowerSaveMode(true)
        assertTrue(Saving.on(app))
    }

    @Test
    fun isNeverLockedByTheHub() {
        val settings = Settings(app).apply {
            paired = true
            releasedAt = 0
            releasedUntil = 0
        }
        assertTrue(settings.locked())
        settings.saveBattery = true
        assertTrue(settings.saveBattery)
    }
}
