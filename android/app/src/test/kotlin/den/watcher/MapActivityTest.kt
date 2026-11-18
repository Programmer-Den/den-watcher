package den.watcher

import android.os.Looper
import android.view.View
import android.widget.TextView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MapActivityTest {
    private val store = Store(RuntimeEnvironment.getApplication())
    private val now = System.currentTimeMillis()

    @After
    fun close() = store.close()

    private fun point(minutesAgo: Int) = RoutePoint(now - minutesAgo * 60_000L, 53.5511, 9.9937, 20.0)

    private fun pointsShown(activity: MapActivity) = activity.findViewById<TextView>(R.id.points).text.toString()

    private fun points(activity: MapActivity, count: Int) = activity.resources.getQuantityString(R.plurals.map_points, count, count)

    /** Runs the main thread until the map's own thread has read what it shows. */
    private fun waitFor(done: () -> Boolean) {
        repeat(250) {
            shadowOf(Looper.getMainLooper()).idle()
            if (done()) return
            Thread.sleep(20)
        }
    }

    @Test
    fun addsTheNewPointsWhileTheMapIsOpen() {
        store.addMapPoint(point(30))
        store.addMapPoint(point(20))
        val activity = Robolectric.buildActivity(MapActivity::class.java).setup().get()
        waitFor { pointsShown(activity) == points(activity, 2) }
        assertEquals(View.VISIBLE, activity.findViewById<View>(R.id.route_group).visibility)
        assertEquals(points(activity, 2), pointsShown(activity))
        store.addMapPoint(point(1))
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMinutes(1))
        waitFor { pointsShown(activity) == points(activity, 3) }
        assertEquals(points(activity, 3), pointsShown(activity))
    }

    @Test
    fun showsNothingButTheRangeUntilThePointsAreRead() {
        // The main thread has not run what the map's own thread read yet.
        val activity = Robolectric.buildActivity(MapActivity::class.java).setup().get()
        assertEquals(View.GONE, activity.findViewById<View>(R.id.none).visibility)
        assertEquals(View.GONE, activity.findViewById<View>(R.id.route_group).visibility)
        assertEquals(View.GONE, activity.findViewById<View>(R.id.places_group).visibility)
        waitFor { activity.findViewById<View>(R.id.none).visibility == View.VISIBLE }
        assertEquals(View.VISIBLE, activity.findViewById<View>(R.id.none).visibility)
    }
}
