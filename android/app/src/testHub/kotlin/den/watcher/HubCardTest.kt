package den.watcher

import android.view.View
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class HubCardTest {
    @After
    fun resetAddress() {
        LanAddress.lookup = { null }
    }

    @Test
    fun theCardComesFirstAndTheRecordingSendsToTheHubNextToIt() {
        val app = RuntimeEnvironment.getApplication()
        HubState(app).running = true
        LanAddress.lookup = { "192.168.1.20" }
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        try {
            val activity = controller.get()
            shadowOf(android.os.Looper.getMainLooper()).idle()
            val content = activity.findViewById<LinearLayout>(R.id.content)
            assertEquals(R.id.hub_card, content.getChildAt(2).id)
            assertEquals(HubConfig.LOCAL_ADDRESS, Settings(activity).hubAddress)
            assertEquals(
                "The hub is running at 192.168.1.20:9393.",
                activity.findViewById<TextView>(R.id.hub_status).text.toString(),
            )
            assertEquals(View.VISIBLE, activity.findViewById<View>(R.id.hub_code).visibility)
            // The hub is started with the screen.
            assertEquals(HubService::class.java.name, shadowOf(app).nextStartedService.component?.className)
        } finally {
            controller.pause().stop().destroy()
        }
    }

    @Test
    fun switchingTheHubOffStopsIt() {
        val app = RuntimeEnvironment.getApplication()
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        try {
            val activity = controller.get()
            activity.findViewById<Switch>(R.id.hub_run).isChecked = false
            assertFalse(HubState(app).wanted)
            assertEquals(HubService::class.java.name, shadowOf(app).nextStoppedService.component?.className)
            assertEquals("The hub is switched off.", activity.findViewById<TextView>(R.id.hub_status).text.toString())
            assertEquals(View.GONE, activity.findViewById<View>(R.id.hub_code).visibility)
            assertFalse(activity.findViewById<View>(R.id.hub_open).isEnabled)
        } finally {
            controller.pause().stop().destroy()
        }
    }

    @Test
    fun aFailureIsShown() {
        val app = RuntimeEnvironment.getApplication()
        HubState(app).failure = "listen tcp :9393: bind: address already in use"
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        try {
            val activity = controller.get()
            shadowOf(android.os.Looper.getMainLooper()).idle()
            val status = activity.findViewById<TextView>(R.id.hub_status).text.toString()
            assertTrue(status, status.startsWith("The hub stopped: listen tcp :9393"))
        } finally {
            controller.pause().stop().destroy()
        }
    }

    @Test
    fun anotherScannedHubIsKept() {
        val app = RuntimeEnvironment.getApplication()
        Settings(app).hubAddress = "192.168.1.30:9393"
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        try {
            val activity = controller.get()
            shadowOf(android.os.Looper.getMainLooper()).idle()
            assertEquals("192.168.1.30:9393", Settings(activity).hubAddress)
            assertEquals(View.GONE, activity.findViewById<View>(R.id.hub_own_phone).visibility)
        } finally {
            controller.pause().stop().destroy()
        }
    }
}
