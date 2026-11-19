package den.watcher

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import kotlin.math.log2

/**
 * The phone's route on an OpenStreetMap map, drawn as the hub's page draws
 * it: a violet line with a light casing, a dot for its points, a numbered
 * circle for the places it stayed at, a ring at the start and a filled dot at
 * the latest point. A tap on a dot calls onSelect with the point's index.
 * It zooms like other map apps: pinch, double-tap, and drag with one finger to
 * move it, or with zoomIn, zoomOut and showWhole for buttons. It keeps the
 * zoom while new points come in, until showWhole.
 */
class RouteMapView(context: Context, attrs: AttributeSet?) : View(context, attrs) {
    /** Called with the index of the point whose dot was tapped. */
    var onSelect: ((Int) -> Unit)? = null

    /** Called when the zoom or what is shown changes, so buttons can follow. */
    var onZoom: (() -> Unit)? = null

    /** What the user zoomed or moved to, or null for the whole route. */
    private var camera: MapCamera? = null

    private var points: List<RoutePoint> = emptyList()
    private var places: List<Place> = emptyList()
    private var selected = -1
    private var layout: RouteLayout? = null
    private val density = resources.displayMetrics.density
    private val tiles = Tiles(context) { invalidate() }

    private val tilePaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val casing = stroke(Color.WHITE, 7f).apply { alpha = CASING_ALPHA }
    private val line = stroke(ROUTE, 3.5f)
    private val dotFill = fill(Color.WHITE)
    private val dotRing = stroke(ROUTE, 2f)
    private val surface = fill(context.getColor(R.color.surface))
    private val onSurface = fill(context.getColor(R.color.on_surface))
    private val ends = stroke(context.getColor(R.color.on_surface), 3f)
    private val placeRing = stroke(ROUTE, 2.5f)
    private val selectedRing = stroke(ROUTE, 3f)
    private val selectedHalo = stroke(Color.WHITE, 6f).apply { alpha = CASING_ALPHA }
    private val number = fill(context.getColor(R.color.on_surface)).apply {
        textSize = 11f
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }
    private val background = context.getColor(R.color.map_background)
    private val corner = RectF()
    private val path = Path()

    private val scaler = ScaleGestureDetector(
        context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                zoomAt(log2(detector.scaleFactor.toDouble()), detector.focusX, detector.focusY)
                return true
            }
        },
    )

    private val gestures = GestureDetector(
        context,
        object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true

            override fun onScroll(e1: MotionEvent?, e2: MotionEvent, distanceX: Float, distanceY: Float): Boolean {
                val map = layout ?: return false
                move(RouteMap.panBy(map.camera, -distanceX / density.toDouble(), -distanceY / density.toDouble()))
                return true
            }

            override fun onDoubleTap(e: MotionEvent): Boolean {
                zoomAt(1.0, e.x, e.y)
                return true
            }

            override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                val map = layout ?: return false
                val i = RouteMap.dotAt(map, e.x / density.toDouble(), e.y / density.toDouble(), REACH_DP)
                if (i >= 0) {
                    performClick()
                    onSelect?.invoke(i)
                }
                return true
            }
        },
    )

    /** Whether the map is zoomed or moved away from the whole route. */
    val zoomed: Boolean get() = camera != null

    /** Whether the map can zoom in or out further. */
    val canZoomIn: Boolean get() = (layout?.camera?.zoom ?: RouteMap.MAX_ZOOM.toDouble()) < RouteMap.MAX_ZOOM
    val canZoomOut: Boolean get() = (layout?.camera?.zoom ?: RouteMap.MIN_ZOOM.toDouble()) > RouteMap.MIN_ZOOM

    /** Zooms in one level around the middle. */
    fun zoomIn() = zoomAt(1.0, width / 2f, height / 2f)

    /** Zooms out one level around the middle. */
    fun zoomOut() = zoomAt(-1.0, width / 2f, height / 2f)

    /** Shows the whole route again, as when the map opens. */
    fun showWhole() {
        camera = null
        relayout()
        invalidate()
        onZoom?.invoke()
    }

    /** Zooms by levels around the spot x, y in pixels of the view. */
    private fun zoomAt(levels: Double, x: Float, y: Float) {
        val map = layout ?: return
        val w = width / density.toDouble()
        val h = height / density.toDouble()
        move(RouteMap.zoomAround(map.camera, levels, x / density.toDouble(), y / density.toDouble(), w, h))
    }

    private fun move(to: MapCamera) {
        camera = to
        relayout()
        invalidate()
        onZoom?.invoke()
    }

    /** Shows points with their places, and the point at selected marked, or none for -1. */
    fun show(points: List<RoutePoint>, places: List<Place>, selected: Int) {
        val changed = points != this.points || places != this.places
        this.points = points
        this.places = places
        this.selected = selected
        if (changed) {
            relayout()
            onZoom?.invoke()
        }
        invalidate()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val height = minOf((width * HEIGHT_SHARE).toInt(), (MAX_HEIGHT_DP * density).toInt())
        setMeasuredDimension(width, resolveSize(height, heightMeasureSpec))
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        relayout()
    }

    override fun onDetachedFromWindow() {
        tiles.close()
        super.onDetachedFromWindow()
    }

    private fun relayout() {
        layout = RouteMap.layout(points, places, width / density.toDouble(), height / density.toDouble(), camera)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(background)
        val map = layout ?: return
        canvas.save()
        // The map is laid out in dp, as the hub's page lays it out in CSS pixels.
        canvas.scale(density, density)
        for (t in map.tiles) {
            tiles.get(t)?.let {
                corner.set(t.left.toFloat(), t.top.toFloat(), (t.left + t.size).toFloat(), (t.top + t.size).toFloat())
                canvas.drawBitmap(it, null, corner, tilePaint)
            }
        }
        path.reset()
        map.points.forEachIndexed { i, p ->
            if (i == 0) path.moveTo(p.x.toFloat(), p.y.toFloat()) else path.lineTo(p.x.toFloat(), p.y.toFloat())
        }
        canvas.drawPath(path, casing)
        canvas.drawPath(path, line)
        for (i in map.dots) {
            val p = map.points[i]
            canvas.drawCircle(p.x.toFloat(), p.y.toFloat(), 3f, dotFill)
            canvas.drawCircle(p.x.toFloat(), p.y.toFloat(), 3f, dotRing)
        }
        map.places.forEachIndexed { i, p ->
            canvas.drawCircle(p.x.toFloat(), p.y.toFloat(), 9f, surface)
            canvas.drawCircle(p.x.toFloat(), p.y.toFloat(), 9f, placeRing)
            canvas.drawText("${i + 1}", p.x.toFloat(), p.y.toFloat() - (number.ascent() + number.descent()) / 2, number)
        }
        val start = map.points.first()
        val end = map.points.last()
        canvas.drawCircle(start.x.toFloat(), start.y.toFloat(), 6f, surface)
        canvas.drawCircle(start.x.toFloat(), start.y.toFloat(), 6f, ends)
        canvas.drawCircle(end.x.toFloat(), end.y.toFloat(), 6f, onSurface)
        canvas.drawCircle(end.x.toFloat(), end.y.toFloat(), 6f, ends)
        map.points.getOrNull(selected)?.let {
            canvas.drawCircle(it.x.toFloat(), it.y.toFloat(), 8f, selectedHalo)
            canvas.drawCircle(it.x.toFloat(), it.y.toFloat(), 8f, selectedRing)
        }
        canvas.restore()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (layout == null) {
            return false
        }
        // The map takes the drag, not the scrolling screen around it.
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> parent?.requestDisallowInterceptTouchEvent(true)
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> parent?.requestDisallowInterceptTouchEvent(false)
        }
        scaler.onTouchEvent(event)
        if (!scaler.isInProgress) {
            gestures.onTouchEvent(event)
        }
        return true
    }

    override fun performClick(): Boolean = super.performClick()

    private fun stroke(color: Int, width: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        this.color = color
        strokeWidth = width
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private fun fill(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        this.color = color
    }

    private companion object {
        /** The route's own color, as on the hub's page: a strong violet the map's roads, water and parks never use. */
        val ROUTE = Color.rgb(0x7b, 0x1f, 0xa2)

        /** The casing's opacity, 85 % as on the hub's page. */
        const val CASING_ALPHA = 217

        /** The map's height as a share of its width, and at most, in dp. */
        const val HEIGHT_SHARE = 0.9
        const val MAX_HEIGHT_DP = 480

        /** How far from a dot a tap still hits it, in dp: a finger is broad. */
        const val REACH_DP = 20.0
    }
}
