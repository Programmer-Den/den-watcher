package den.watcher

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RouteMapTest {
    private val store = Store(RuntimeEnvironment.getApplication())
    private val home = RoutePoint(1_800_000_000_000L, 53.5511, 9.9937, 20.0)

    @After
    fun close() = store.close()

    private fun at(minutes: Int, north: Double = 0.0, accuracy: Double = 20.0) =
        RoutePoint(home.time + minutes * 60_000L, home.lat + north, home.lon, accuracy)

    @Test
    fun countsOnlyStepsLongerThanThePointsAreVague() {
        // About 1.1 km north, then a wobble of 10 m within the accuracy.
        val points = listOf(at(0), at(10, 0.01), at(11, 0.01009))
        assertEquals(1112.0, RouteMap.distance(points), 2.0)
        assertEquals(0.0, RouteMap.distance(listOf(at(0))), 0.0)
    }

    @Test
    fun findsThePlacesStayedAtTheLongestFirst() {
        val points = listOf(
            // Home for 20 minutes, away, at work for 40, and home again for 15.
            at(0), at(10), at(20),
            at(30, 0.05), at(40, 0.05), at(70, 0.05),
            at(90), at(105),
        )
        val stops = RouteMap.stops(points)
        assertEquals(3, stops.size)
        val places = RouteMap.places(stops)
        assertEquals(2, places.size)
        assertEquals(40 * 60_000L, places[0].millis)
        assertEquals(1, places[0].visits)
        assertEquals(35 * 60_000L, places[1].millis)
        assertEquals(2, places[1].visits)
    }

    @Test
    fun leavesOutAShortStop() {
        assertTrue(RouteMap.stops(listOf(at(0), at(5), at(6, 0.05))).isEmpty())
    }

    @Test
    fun fitsTheRouteOnTheMapWithItsTiles() {
        val points = listOf(at(0), at(10, 0.01), at(20, 0.02))
        val map = RouteMap.layout(points, emptyList(), 400.0, 360.0)!!
        assertTrue(map.zoom in RouteMap.MIN_ZOOM..RouteMap.MAX_ZOOM)
        for (p in map.points) {
            assertTrue(p.x in RouteMap.PADDING - 1..400 - RouteMap.PADDING + 1)
            assertTrue(p.y in RouteMap.PADDING - 1..360 - RouteMap.PADDING + 1)
        }
        // North is up.
        assertTrue(map.points[2].y < map.points[0].y)
        // The tiles cover the whole map, without a gap.
        assertTrue(map.tiles.any { it.left <= 0 && it.top <= 0 })
        assertTrue(map.tiles.any { it.left + RouteMap.TILE >= 400 && it.top + RouteMap.TILE >= 360 })
        assertTrue(map.tiles.all { it.url == "https://tile.openstreetmap.org/${it.zoom}/${it.x}/${it.y}.png" })
    }

    @Test
    fun zoomsToAStreetForOnePoint() {
        val map = RouteMap.layout(listOf(home), emptyList(), 400.0, 360.0)!!
        assertEquals(RouteMap.MAX_ZOOM, map.zoom)
        assertEquals(200.0, map.points[0].x, 0.1)
        assertEquals(180.0, map.points[0].y, 0.1)
        assertNull(RouteMap.layout(emptyList(), emptyList(), 400.0, 360.0))
    }

    @Test
    fun givesPointsDrawnOnTopOfEachOtherOneDot() {
        // Staying at home: only the newest of the points there gets a dot.
        val points = listOf(at(0), at(10), at(20), at(30, 0.01))
        val map = RouteMap.layout(points, emptyList(), 400.0, 360.0)!!
        assertEquals(listOf(2, 3), map.dots)
    }

    @Test
    fun findsTheDotATapHits() {
        val points = listOf(at(0), at(30, 0.01))
        val map = RouteMap.layout(points, emptyList(), 400.0, 360.0)!!
        val end = map.points[1]
        assertEquals(1, RouteMap.dotAt(map, end.x + 5, end.y - 5, 20.0))
        assertEquals(-1, RouteMap.dotAt(map, end.x + 50, end.y, 20.0))
    }

    @Test
    fun keepsTheRouteForTheMapAfterTheHubHasIt() {
        store.addRoutePoint(at(0))
        store.addMapPoint(at(0))
        store.addMapPoint(at(10, 0.01))
        store.deleteRouteUpTo(Long.MAX_VALUE)
        assertEquals(listOf(at(0), at(10, 0.01)), store.mapPoints(0))
        assertEquals(listOf(at(10, 0.01)), store.mapPoints(at(5).time))
        store.deleteMapRoute()
        assertTrue(store.mapPoints(0).isEmpty())
    }

    @Test
    fun keepsTheMapsRouteAndScansForAWeek() {
        val week = Store.KEEP_MAP_MILLIS
        val minute = 60_000L
        val now = System.currentTimeMillis() / minute * minute
        val old = home.copy(time = now - week - 10 * minute)
        val recent = home.copy(time = now - week + 10 * minute)
        // A point ahead of the clock deletes nothing more than one now would.
        store.addMapPoint(recent)
        store.addMapPoint(home.copy(time = now + 2 * week))
        assertEquals(2, store.mapPoints(0).size)
        store.deleteMapRoute()
        store.addMapPoint(old)
        store.addMapScan(SeenScan(old.time / 1000, emptyList()))
        store.addMapPoint(recent)
        assertEquals(2, store.mapPoints(0).size)
        // Now, and the first ones are older than a week.
        store.addMapPoint(home.copy(time = now))
        store.addMapScan(SeenScan(now / 1000, emptyList()))
        assertEquals(listOf(now - week + 10 * minute, now), store.mapPoints(0).map { it.time })
        assertNull(store.mapScanNear(old.time / 1000))
        assertEquals(now / 1000, store.mapScanNear(now / 1000)?.time)
    }

    @Test
    fun keepsAScanForTheMapEveryFewMinutes() {
        val t = home.time / 1000
        fun scan(time: Long) = SeenScan(time, listOf(SeenNetwork("Home", -50, 5180, "WPA2", true)))
        store.addMapScan(scan(t))
        store.addMapScan(scan(t + 60))
        store.addMapScan(scan(t + Store.MAP_SCAN_EVERY_SECONDS))
        assertEquals(t, store.mapScanNear(t + 100)?.time)
        assertEquals(t + Store.MAP_SCAN_EVERY_SECONDS, store.mapScanNear(t + 200)?.time)
        assertEquals(scan(t).networks, store.mapScanNear(t)?.networks)
        assertNull(store.mapScanNear(t + Store.MAP_SCAN_EVERY_SECONDS + SeenScan.WITHIN_SECONDS + 1))
        // After the clock went back, a scan is kept at once.
        store.addMapScan(scan(t - 3600))
        assertEquals(t - 3600, store.mapScanNear(t - 3600)?.time)
        store.deleteMapScans()
        assertNull(store.mapScanNear(t))
    }

    @Test
    fun keepsTheScannedNetworksStrongestFirstWithoutTheirAddress() {
        val scan = Scan(
            1_800_000_000L,
            listOf(
                AccessPoint("0a:1b:2c:3d:4e:5f", "Cafe", -80, 2437, 20, "Open", 4, false),
                AccessPoint("0a:1b:2c:3d:4e:60", "", -60, 5955, 80, "WPA3", 6, false),
                AccessPoint("0a:1b:2c:3d:4e:61", "Home", -45, 5180, 80, "WPA2/WPA3", 6, true),
            ),
        )
        val seen = SeenScan.of(scan)
        assertEquals(listOf("Home", "", "Cafe"), seen.networks.map { it.ssid })
        assertEquals(seen, SeenScan.parse(seen.time, seen.text()))
        assertTrue("0a:1b" !in seen.text())
        assertNull(SeenScan.parse(seen.time, "not json"))
        val (homeWifi, hidden, cafe) = seen.networks
        assertEquals(36 to 5, homeWifi.channel to homeWifi.band)
        assertEquals(1 to 6, hidden.channel to hidden.band)
        assertEquals(6 to 24, cafe.channel to cafe.band)
        assertEquals(40.0, cafe.percent, 0.0)
    }
}
