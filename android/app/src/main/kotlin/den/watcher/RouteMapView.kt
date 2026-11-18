package den.watcher

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View

/**
 * The phone's route on an OpenStreetMap map, drawn as the hub's page draws
 * it: a violet line with a light casing, a dot for its points, a numbered
 * circle for the places it stayed at, a ring at the start and a filled dot at
 * the latest point. A tap on a dot calls onSelect with the point's index.
 */
class RouteMapView(context: Context, attrs: AttributeSet?) : View(context, attrs) {
    /** Called with the index of the point whose dot was tapped. */
    var onSelect: ((Int) -> Unit)? = null

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

    /** Shows points with their places, and the point at selected marked, or none for -1. */
    fun show(points: List<RoutePoint>, places: List<Place>, selected: Int) {
        val changed = points != this.points || places != this.places
        this.points = points
        this.places = places
        this.selected = selected
        if (changed) {
            relayout()
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
        layout = RouteMap.layout(points, places, width / density.toDouble(), height / density.toDouble())
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
                corner.set(t.left.toFloat(), t.top.toFloat(), (t.left + RouteMap.TILE).toFloat(), (t.top + RouteMap.TILE).toFloat())
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
        val map = layout ?: return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> return true
            MotionEvent.ACTION_UP -> {
                val i = RouteMap.dotAt(map, event.x / density.toDouble(), event.y / density.toDouble(), REACH_DP)
                if (i >= 0) {
                    performClick()
                    onSelect?.invoke(i)
                }
                return true
            }
        }
        return super.onTouchEvent(event)
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
