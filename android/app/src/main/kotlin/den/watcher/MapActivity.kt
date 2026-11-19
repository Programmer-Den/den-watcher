package den.watcher

import android.app.Activity
import android.database.sqlite.SQLiteException
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateUtils
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.NumberFormat
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * The phone's own location route on a map, as the hub's page shows it, from
 * what the phone kept for it: over the last day or week, how far it went,
 * the places it stayed at, and for a tapped point the Wi-Fi networks the
 * phone scanned there. It works anywhere, also without the hub; only the
 * map's tiles come from OpenStreetMap. The points and scans are read off the
 * main thread, on one thread of its own with one connection to the
 * database, and every minute while the map is shown it looks whether the
 * recorder kept new points.
 */
class MapActivity : Activity() {
    private lateinit var map: RouteMapView
    private var days = 1
    private var points: List<RoutePoint> = emptyList()

    /** The places the phone stayed at and how far it went, worked out once for each read of the points. */
    private var places: List<Place> = emptyList()
    private var meters = 0.0

    private val main = Handler(Looper.getMainLooper())
    private var resumed = false

    /** Reads the points and scans; the store is opened and closed on it. */
    private val background: ExecutorService = Executors.newSingleThreadExecutor()
    private lateinit var store: Store

    /** Set once the map is closed, so the reads still waiting do nothing. */
    @Volatile private var closed = false

    /** The places the list shows, so it is built again only when they change. */
    private var placesShown: List<Place>? = null

    /** The scan whose networks the list shows. */
    private var scanShown: SeenScan? = null

    /** The time of the point whose networks the list shows, or null. */
    private var scanShownFor: Long? = null

    /** Counts the reads, so the answer of one the range changed after is dropped. */
    private var loads = 0
    private val reload = Runnable { load() }

    /** The time of the point whose networks are shown, kept by time as the route moves on, or null. */
    private var selectedTime: Long? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_map)
        val context = applicationContext
        background.execute { store = Store(context) }
        days = savedInstanceState?.getInt(DAYS, 1) ?: 1
        selectedTime = savedInstanceState?.getLong(SELECTED, -1)?.takeIf { it >= 0 }
        map = findViewById(R.id.map)
        map.onSelect = { i ->
            val time = points.getOrNull(i)?.time
            selectedTime = if (time == selectedTime) null else time
            show()
        }
        val zoomIn = findViewById<View>(R.id.zoom_in)
        val zoomOut = findViewById<View>(R.id.zoom_out)
        val zoomWhole = findViewById<View>(R.id.zoom_whole)
        zoomIn.setOnClickListener { map.zoomIn() }
        zoomOut.setOnClickListener { map.zoomOut() }
        zoomWhole.setOnClickListener { map.showWhole() }
        map.onZoom = {
            enable(zoomIn, map.canZoomIn)
            enable(zoomOut, map.canZoomOut)
            enable(zoomWhole, map.zoomed)
        }
        map.onZoom?.invoke()
        findViewById<View>(R.id.back).setOnClickListener { finish() }
        findViewById<Button>(R.id.range_day).setOnClickListener { setDays(1) }
        findViewById<Button>(R.id.range_week).setOnClickListener { setDays(7) }
        findViewById<Button>(R.id.previous).setOnClickListener { step(-1) }
        findViewById<Button>(R.id.next).setOnClickListener { step(1) }
        findViewById<Button>(R.id.close).setOnClickListener {
            selectedTime = null
            show()
        }
        findViewById<Button>(R.id.latest).setOnClickListener {
            selectedTime = points.lastOrNull()?.time
            show()
        }
        findViewById<TextView>(R.id.legend).text = getString(R.string.map_legend)
        // Nothing but the range until the points are read.
        showRanges()
        for (id in listOf(R.id.none, R.id.route_group, R.id.places_group)) {
            findViewById<View>(id).visibility = View.GONE
        }
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        load()
    }

    override fun onPause() {
        super.onPause()
        resumed = false
        main.removeCallbacks(reload)
    }

    override fun onDestroy() {
        super.onDestroy()
        closed = true
        main.removeCallbacksAndMessages(null)
        background.execute { store.close() }
        background.shutdown()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(DAYS, days)
        outState.putLong(SELECTED, selectedTime ?: -1)
    }

    private fun setDays(to: Int) {
        if (to != days) {
            days = to
            map.showWhole()
            showRanges()
            load()
        }
    }

    /**
     * Reads the points of the range off the main thread, with the places and
     * distance worked out from them, and looks again every RELOAD_MILLIS
     * while the map is shown: when the recorder kept a point since, or the
     * range moved past the oldest one, the points are read again; a scan may
     * have come in for the picked point too.
     */
    private fun load() {
        main.removeCallbacks(reload)
        val number = ++loads
        val since = System.currentTimeMillis() - days * DAY_MILLIS
        val shown = points
        val shownPlaces = places
        val shownMeters = meters
        background.execute {
            if (closed) return@execute
            val read = try {
                // The same count, oldest and newest point as shown: nothing changed.
                val (count, oldest, newest) = store.mapPointsSince(since)
                if (count == shown.size && oldest == shown.firstOrNull()?.time && newest == shown.lastOrNull()?.time) {
                    shown
                } else {
                    store.mapPoints(since)
                }
            } catch (e: SQLiteException) {
                Log.w(TAG, "could not read the route for the map", e)
                main.post { if (number == loads && !isDestroyed) failed() }
                return@execute
            }
            val changed = read !== shown
            val stayed = if (changed) RouteMap.places(RouteMap.stops(read)) else shownPlaces
            val went = if (changed) RouteMap.distance(read) else shownMeters
            main.post {
                if (number != loads || isDestroyed) return@post
                findViewById<TextView>(R.id.none).setText(R.string.map_none)
                if (changed || points.isEmpty()) {
                    points = read
                    places = stayed
                    meters = went
                    show()
                } else {
                    // Only a scan may have come in for the picked point.
                    showPoint(points.indexOfFirst { it.time == selectedTime })
                }
                if (resumed) main.postDelayed(reload, RELOAD_MILLIS)
            }
        }
    }

    /**
     * The route could not be read, as when the database is busy: says so
     * where nothing is shown yet, keeps what is shown, and tries again.
     */
    private fun failed() {
        if (points.isEmpty()) {
            findViewById<TextView>(R.id.none).apply {
                setText(R.string.map_read_failed)
                visibility = View.VISIBLE
            }
        }
        if (resumed) main.postDelayed(reload, RELOAD_MILLIS)
    }

    private fun step(by: Int) {
        val next = points.getOrNull(points.indexOfFirst { it.time == selectedTime } + by) ?: return
        selectedTime = next.time
        show()
    }

    private fun show() {
        showRanges()
        val any = points.isNotEmpty()
        findViewById<View>(R.id.none).visibility = if (any) View.GONE else View.VISIBLE
        findViewById<View>(R.id.route_group).visibility = if (any) View.VISIBLE else View.GONE
        findViewById<View>(R.id.places_group).visibility = if (places.isEmpty()) View.GONE else View.VISIBLE
        if (!any) {
            selectedTime = null
            return
        }
        val km = NumberFormat.getNumberInstance().apply {
            minimumFractionDigits = 1
            maximumFractionDigits = 1
        }.format(meters / 1000)
        findViewById<TextView>(R.id.distance).text = getString(R.string.map_distance, km)
        findViewById<TextView>(R.id.points).text = resources.getQuantityString(R.plurals.map_points, points.size, points.size)
        val selected = points.indexOfFirst { it.time == selectedTime }
        if (selected < 0) {
            selectedTime = null
        }
        map.show(points, places, selected)
        showPoint(selected)
        if (places != placesShown) {
            showPlaces(places)
        }
    }

    /** A zoom button that can or cannot be pressed, greyed out when not. */
    private fun enable(button: View, enabled: Boolean) {
        button.isEnabled = enabled
        button.alpha = if (enabled) 1f else DISABLED_ALPHA
    }

    private fun showRanges() {
        showRange(R.id.range_day, days == 1)
        showRange(R.id.range_week, days == 7)
    }

    private fun showRange(id: Int, picked: Boolean) {
        findViewById<Button>(id).apply {
            setBackgroundResource(if (picked) R.drawable.button_filled else R.drawable.button_outlined)
            setTextColor(getColorStateList(if (picked) R.color.button_filled_text else R.color.button_outlined_text))
        }
    }

    /** The point at index with the networks scanned there, or the hint to tap one for -1. */
    private fun showPoint(index: Int) {
        val point = points.getOrNull(index)
        findViewById<View>(R.id.pick_group).visibility = if (point == null) View.VISIBLE else View.GONE
        findViewById<View>(R.id.point_group).visibility = if (point == null) View.GONE else View.VISIBLE
        if (point?.time != scanShownFor) {
            // Another point: its networks are read anew. The same one keeps
            // the list it shows until it is read again.
            findViewById<LinearLayout>(R.id.networks).removeAllViews()
            findViewById<TextView>(R.id.scan_summary).text = ""
            scanShownFor = null
            scanShown = null
        }
        point ?: return
        findViewById<TextView>(R.id.point_time).text = time(point.time)
        findViewById<TextView>(R.id.point_accuracy).text =
            getString(R.string.map_accuracy, NumberFormat.getIntegerInstance().format(point.accuracy.roundToInt()))
        findViewById<Button>(R.id.previous).isEnabled = index > 0
        findViewById<Button>(R.id.next).isEnabled = index < points.size - 1
        background.execute {
            if (closed) return@execute
            val scan = try {
                store.mapScanNear(point.time / 1000)
            } catch (e: SQLiteException) {
                Log.w(TAG, "could not read the scan for the map", e)
                main.post {
                    if (!isDestroyed && selectedTime == point.time && scanShownFor != point.time) {
                        findViewById<TextView>(R.id.scan_summary).setText(R.string.map_read_failed)
                    }
                }
                return@execute
            }
            main.post {
                // Shown only if the point is still the one picked.
                if (!isDestroyed && selectedTime == point.time) showScan(point, scan)
            }
        }
    }

    /** The networks scanned near the picked point, or that there were none. */
    private fun showScan(point: RoutePoint, scan: SeenScan?) {
        if (scanShownFor == point.time && scanShown == scan) {
            return
        }
        scanShownFor = point.time
        scanShown = scan
        val list = findViewById<LinearLayout>(R.id.networks)
        list.removeAllViews()
        val summary = findViewById<TextView>(R.id.scan_summary)
        if (scan == null) {
            summary.setText(R.string.map_no_scan)
            return
        }
        val networks = resources.getQuantityString(R.plurals.map_networks, scan.networks.size, scan.networks.size)
        summary.text = getString(R.string.map_scan_summary, networks, offset(scan.time - point.time / 1000))
        for (n in scan.networks) {
            list.addView(network(n, list))
        }
    }

    /** How far the scan was from the point, in seconds: at it, or minutes before or after it. */
    private fun offset(seconds: Long): String {
        val minutes = (seconds / 60.0).roundToInt()
        return when {
            minutes == 0 -> getString(R.string.map_scan_at)
            minutes < 0 -> resources.getQuantityString(R.plurals.map_scan_before, abs(minutes), abs(minutes))
            else -> resources.getQuantityString(R.plurals.map_scan_after, minutes, minutes)
        }
    }

    /** One network as a row: its name, whether the phone was connected, its channel, band, security and signal. */
    private fun network(n: SeenNetwork, list: LinearLayout): View {
        val row = layoutInflater.inflate(R.layout.map_row, list, false)
        val name = row.findViewById<TextView>(R.id.row_title)
        name.text = buildString {
            append(n.ssid.ifEmpty { getString(R.string.map_hidden) })
            if (n.connected) append(" · ").append(getString(R.string.map_connected))
        }
        name.alpha = if (n.ssid.isEmpty()) HIDDEN_ALPHA else 1f
        val band = when (n.band) {
            0 -> null
            24 -> getString(R.string.map_band_24)
            else -> getString(R.string.map_band, n.band)
        }
        val security = if (n.security == "Open") getString(R.string.map_open_network) else n.security
        val percent = NumberFormat.getIntegerInstance().format(n.percent.roundToInt())
        row.findViewById<TextView>(R.id.row_detail).text = listOfNotNull(
            n.channel.takeIf { it > 0 }?.toString(),
            band,
            security.ifEmpty { null },
            getString(R.string.map_signal, percent),
        ).joinToString(" · ")
        return row
    }

    /** The places the phone stayed at, the longest first, numbered as on the map. */
    private fun showPlaces(places: List<Place>) {
        placesShown = places
        val list = findViewById<LinearLayout>(R.id.places)
        list.removeAllViews()
        places.forEachIndexed { i, p ->
            val row = layoutInflater.inflate(R.layout.map_row, list, false)
            row.findViewById<TextView>(R.id.row_title).text = getString(R.string.map_place, i + 1, duration(p.millis))
            row.findViewById<TextView>(R.id.row_detail).text = resources.getQuantityString(R.plurals.map_visits, p.visits, p.visits)
            list.addView(row)
        }
    }

    /** A time of the route, with the weekday and date, in the phone's language. */
    private fun time(millis: Long): String = DateUtils.formatDateTime(
        this,
        millis,
        DateUtils.FORMAT_SHOW_WEEKDAY or DateUtils.FORMAT_ABBREV_WEEKDAY or DateUtils.FORMAT_SHOW_DATE or
            DateUtils.FORMAT_ABBREV_MONTH or DateUtils.FORMAT_SHOW_TIME,
    )

    private fun duration(millis: Long): String {
        val minutes = (millis / 60_000).toInt()
        return if (minutes < 60) getString(R.string.map_minutes, minutes) else getString(R.string.map_hours, minutes / 60, minutes % 60)
    }

    private companion object {
        private const val DAY_MILLIS = 24 * 60 * 60_000L
        private const val RELOAD_MILLIS = 60_000L
        private const val TAG = "MapActivity"
        private const val DAYS = "days"

        /** How visible a zoom button is that cannot be pressed, as Material greys out disabled controls. */
        private const val DISABLED_ALPHA = 0.38f
        private const val SELECTED = "selected"
        private const val HIDDEN_ALPHA = 0.7f
    }
}
