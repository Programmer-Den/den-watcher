package den.watcher

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SettingsTest {
    private val settings = Settings(RuntimeEnvironment.getApplication()).apply {
        paired = true
        releasedAt = 1_000
        releasedUntil = 1_600
    }

    @Test
    fun isUnlockedOnlyWhileTheHubAllowsAChange() {
        assertFalse(settings.locked(1_000))
        assertFalse(settings.locked(1_599))
        assertTrue(settings.locked(1_600))
    }

    @Test
    fun staysLockedWhenTheClockIsSetBackToBeforeTheHubAllowedAChange() {
        assertTrue(settings.locked(999))
        assertTrue(settings.locked(10))
    }

    @Test
    fun isNotLockedBeforeTheHubTookAPush() {
        settings.paired = false
        assertFalse(settings.locked(5_000))
    }
}
