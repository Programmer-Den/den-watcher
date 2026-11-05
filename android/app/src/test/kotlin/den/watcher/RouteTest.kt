package den.watcher

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RouteTest {
    private val store = Store(RuntimeEnvironment.getApplication())
    private val home = RoutePoint(1_000_000, 53.5511, 9.9937, 20.0)

    @After
    fun close() = store.close()

    @Test
    fun measuresTheWayAlongTheEarth() {
        // About 1.1 km north.
        val north = home.copy(lat = home.lat + 0.01)
        assertEquals(1112.0, Route.meters(home, north), 2.0)
        assertEquals(0.0, Route.meters(home, home), 0.0)
    }

    @Test
    fun keepsAPointWhenThePhoneMovedOrStayedForAWhile() {
        assertTrue(Route.keeps(null, home))
        val near = home.copy(time = home.time + 60_000, lat = home.lat + 0.0002)
        assertFalse("22 m is within the points' accuracy", Route.keeps(home, near))
        val moved = home.copy(time = home.time + 60_000, lat = home.lat + 0.002)
        assertTrue("222 m away", Route.keeps(home, moved))
        val vague = moved.copy(accuracy = 500.0)
        assertFalse("222 m is within 500 m", Route.keeps(home, vague))
        assertTrue(Route.keeps(home, home.copy(time = home.time + Route.STILL_EVERY_MILLIS)))
        assertFalse("not newer", Route.keeps(home, moved.copy(time = home.time)))
        assertFalse("too vague", Route.keeps(null, home.copy(accuracy = Route.MAX_ACCURACY_METERS + 1)))
        assertTrue("the clock went back", Route.keeps(home, home.copy(time = home.time - Route.FRESH_MILLIS - 1)))
    }

    @Test
    fun asksForAPositionEveryFewMinutes() {
        assertTrue(Route.askDue(0, 1_000_000))
        assertFalse(Route.askDue(1_000_000, 1_000_000 + Route.ASK_EVERY_MILLIS - 1))
        assertTrue(Route.askDue(1_000_000, 1_000_000 + Route.ASK_EVERY_MILLIS))
        assertTrue("the clock went back", Route.askDue(2_000_000, 1_000_000))
    }

    @Test
    fun keepsTheLastPointAsText() {
        assertEquals(home, RoutePoint.parse(home.text()))
        assertNull(RoutePoint.parse(null))
        assertNull(RoutePoint.parse("1,2,x,4"))
    }

    @Test
    fun keepsThePointsUntilTheHubHasThem() {
        store.addRoutePoint(home)
        store.addRoutePoint(home.copy(time = home.time + 60_000, lat = 53.56))
        val sent = store.routePoints()
        assertEquals(2, sent.size)
        assertEquals(53.56, sent.last().getDouble("lat"), 0.0)
        assertEquals(home.time, sent.first().getLong("time"))
        store.deleteRouteUpTo(sent.first().getLong("id"))
        assertEquals(1, store.routePoints().size)
        store.deleteRouteUpTo(Long.MAX_VALUE)
        assertTrue(store.routePoints().isEmpty())
    }

    @Test
    fun sendsThePointsOnlyWhenThereAreSome() {
        assertFalse(Push.body(600, null, emptyList()).has("route"))
        val body = Push.body(600, null, emptyList(), route = listOf(home.json(7)))
        val point = body.getJSONArray("route").getJSONObject(0)
        assertEquals(7, point.getLong("id"))
        assertEquals(9.9937, point.getDouble("lon"), 0.0)
    }

    @Test
    fun theSwitchTurnsTheRouteOff() {
        assertTrue(DataChoice().collectsRoute)
        assertFalse(DataChoice(route = false).collectsRoute)
    }
}
