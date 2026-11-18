package den.watcher

import android.os.Looper
import android.view.View
import android.widget.TextView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration
import java.util.concurrent.Executor

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MapActivityTest {
    private val store = Store(RuntimeEnvironment.getApplication())
    private val background = MapActivity.background
    private val now = System.currentTimeMillis()

    @Before
    fun readInPlace() {
        MapActivity.background = Executor { it.run() }
    }

    @After
    fun close() {
        MapActivity.background = background
        store.close()
    }

    private fun point(minutesAgo: Int) = RoutePoint(now - minutesAgo * 60_000L, 53.5511, 9.9937, 20.0)

    private fun pointsShown(activity: MapActivity) = activity.findViewById<TextView>(R.id.points).text.toString()

    @Test
    fun addsTheNewPointsWhileTheMapIsOpen() {
        store.addMapPoint(point(30))
        store.addMapPoint(point(20))
        val activity = Robolectric.buildActivity(MapActivity::class.java).setup().get()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(View.VISIBLE, activity.findViewById<View>(R.id.route_group).visibility)
        assertEquals(activity.resources.getQuantityString(R.plurals.map_points, 2, 2), pointsShown(activity))
        store.addMapPoint(point(1))
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMinutes(1))
        assertEquals(activity.resources.getQuantityString(R.plurals.map_points, 3, 3), pointsShown(activity))
    }

    @Test
    fun showsNothingButTheRangeUntilThePointsAreRead() {
        // Reads that never finish.
        MapActivity.background = Executor { }
        val activity = Robolectric.buildActivity(MapActivity::class.java).setup().get()
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(View.GONE, activity.findViewById<View>(R.id.none).visibility)
        assertEquals(View.GONE, activity.findViewById<View>(R.id.route_group).visibility)
        assertEquals(View.GONE, activity.findViewById<View>(R.id.places_group).visibility)
    }
}
