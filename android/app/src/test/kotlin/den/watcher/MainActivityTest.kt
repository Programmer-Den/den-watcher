package den.watcher

import android.widget.TextView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MainActivityTest {
    @Test
    fun namesTheAppsVersionInTheUpdatesCard() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        try {
            val activity = controller.get()
            val version = appVersion(activity)
            assertTrue(version.isNotEmpty())
            assertEquals(
                "This app is version $version.",
                activity.findViewById<TextView>(R.id.version).text.toString(),
            )
        } finally {
            controller.pause().stop().destroy()
        }
    }
}
