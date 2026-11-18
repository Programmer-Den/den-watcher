package den.watcher

import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong
import kotlin.math.sin

/** A place the phone stayed at for RouteMap.STOP_MILLIS or longer: where, from when to when, Unix milliseconds. */
data class Stop(val lat: Double, val lon: Double, val start: Long, val end: Long)

/** A place the phone stayed at, maybe several times: where, how long in all in milliseconds and how often. */
data class Place(val lat: Double, val lon: Double, val millis: Long, val visits: Int)

/** Where something is drawn on the map, in its units: dp from its top left corner. */
data class MapSpot(val x: Double, val y: Double)

/** One OpenStreetMap tile of the map: which one, and where its top left corner is drawn. */
data class MapTile(val zoom: Int, val x: Int, val y: Int, val left: Double, val top: Double) {
    /** Where OpenStreetMap serves it. */
    val url: String get() = "https://tile.openstreetmap.org/$zoom/$x/$y.png"
}

/**
 * The map of a route: its tiles, and where its points and places are drawn,
 * and which points get a dot: of points closer together than
 * RouteMap.DOT_SPACING, as while the phone stays at a place, only the
 * newest, so the dots do not pile up.
 */
data class RouteLayout(
    val zoom: Int,
    val tiles: List<MapTile>,
    val points: List<MapSpot>,
    val places: List<MapSpot>,
    val dots: List<Int>,
)

/**
 * The map of the phone's own route as the hub's page draws it: the
 * OpenStreetMap tiles it needs at the closest zoom that shows the whole
 * route, how far the phone went and the places it stayed at.
 */
object RouteMap {
    /** The size of a tile, in map units at its zoom. */
    const val TILE = 256.0

    /** The zoom levels the map picks from: from a country to a street. */
    const val MIN_ZOOM = 3
    const val MAX_ZOOM = 17

    /** The room around the route on the map, in map units. */
    const val PADDING = 24.0

    /** How close points must be to count as one place the phone stayed at, in meters. */
    const val STOP_METERS = 150.0

    /** How long the phone must stay at a place for it to count as a stop. */
    const val STOP_MILLIS = 10 * 60_000L

    /** How close two points may be drawn, in map units, before only the newer of them gets a dot. */
    const val DOT_SPACING = 8.0

    /**
     * How far the phone went along the points, in meters: a step shorter
     * than the points are vague is left out, as the position wavers while the
     * phone stays where it is.
     */
    fun distance(points: List<RoutePoint>): Double {
        var total = 0.0
        for (i in 1 until points.size) {
            val step = Route.meters(points[i - 1], points[i])
            if (step > max(points[i - 1].accuracy, points[i].accuracy)) {
                total += step
            }
        }
        return total
    }

    /**
     * The places the phone stayed at, oldest first: points one after the
     * other within STOP_METERS of the first of them, for STOP_MILLIS or
     * longer, at the middle of those points.
     */
    fun stops(points: List<RoutePoint>): List<Stop> {
        val found = mutableListOf<Stop>()
        var first = 0
        fun close(end: Int) {
            val group = points.subList(first, end)
            if (group.isNotEmpty() && group.last().time - group.first().time >= STOP_MILLIS) {
                found += Stop(group.sumOf { it.lat } / group.size, group.sumOf { it.lon } / group.size, group.first().time, group.last().time)
            }
        }
        for (i in 1 until points.size) {
            if (Route.meters(points[first], points[i]) > STOP_METERS) {
                close(i)
                first = i
            }
        }
        close(points.size)
        return found
    }

    /**
     * The places of the stops, the one the phone stayed at longest first: a
     * stop within STOP_METERS of a place found before counts as another
     * visit there.
     */
    fun places(stops: List<Stop>): List<Place> {
        val all = mutableListOf<Place>()
        for (s in stops) {
            val here = RoutePoint(0, s.lat, s.lon, 0.0)
            val i = all.indexOfFirst { Route.meters(RoutePoint(0, it.lat, it.lon, 0.0), here) <= STOP_METERS }
            if (i >= 0) {
                all[i] = all[i].copy(millis = all[i].millis + s.end - s.start, visits = all[i].visits + 1)
            } else {
                all += Place(s.lat, s.lon, s.end - s.start, 1)
            }
        }
        return all.sortedByDescending { it.millis }
    }

    /**
     * The map of the points on a map of width by height units, at the
     * closest zoom that shows all of them with PADDING around, centered on
     * them, or null without points.
     */
    fun layout(points: List<RoutePoint>, places: List<Place>, width: Double, height: Double): RouteLayout? {
        if (points.isEmpty() || width <= 0 || height <= 0) {
            return null
        }
        val north = points.maxOf { it.lat }
        val south = points.minOf { it.lat }
        val east = points.maxOf { it.lon }
        val west = points.minOf { it.lon }
        val zoom = (MAX_ZOOM downTo MIN_ZOOM).firstOrNull { z ->
            val nw = project(north, west, z)
            val se = project(south, east, z)
            se.x - nw.x <= width - 2 * PADDING && se.y - nw.y <= height - 2 * PADDING
        } ?: MIN_ZOOM
        val nw = project(north, west, zoom)
        val se = project(south, east, zoom)
        val left = (nw.x + se.x) / 2 - width / 2
        val top = (nw.y + se.y) / 2 - height / 2
        fun at(lat: Double, lon: Double): MapSpot {
            val p = project(lat, lon, zoom)
            return MapSpot(round(p.x - left), round(p.y - top))
        }
        val count = 1 shl zoom
        val tiles = mutableListOf<MapTile>()
        for (ty in floor(top / TILE).toInt()..floor((top + height) / TILE).toInt()) {
            if (ty < 0 || ty >= count) {
                continue
            }
            for (tx in floor(left / TILE).toInt()..floor((left + width) / TILE).toInt()) {
                tiles += MapTile(zoom, Math.floorMod(tx, count), ty, round(tx * TILE - left), round(ty * TILE - top))
            }
        }
        val drawn = points.map { at(it.lat, it.lon) }
        val cells = LinkedHashMap<Pair<Long, Long>, Int>()
        drawn.forEachIndexed { i, p -> cells[(p.x / DOT_SPACING).roundToLong() to (p.y / DOT_SPACING).roundToLong()] = i }
        return RouteLayout(zoom, tiles, drawn, places.map { at(it.lat, it.lon) }, cells.values.sorted())
    }

    /**
     * The index of the dot nearest to x, y on the map within reach map
     * units, or -1 when none is, as for a tap.
     */
    fun dotAt(layout: RouteLayout, x: Double, y: Double, reach: Double): Int {
        var best = -1
        var bestDistance = reach * reach
        for (i in layout.dots) {
            val p = layout.points[i]
            val d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)
            if (d <= bestDistance) {
                best = i
                bestDistance = d
            }
        }
        return best
    }

    /** Where a point is on the whole map of the world at a zoom, in its units (Web Mercator). */
    private fun project(lat: Double, lon: Double, zoom: Int): MapSpot {
        val size = TILE * (1 shl zoom)
        val s = min(max(sin(lat * PI / 180), -0.9999), 0.9999)
        return MapSpot((lon + 180) / 360 * size, (0.5 - ln((1 + s) / (1 - s)) / (4 * PI)) * size)
    }

    private fun round(n: Double): Double = Math.round(n * 10) / 10.0
}
