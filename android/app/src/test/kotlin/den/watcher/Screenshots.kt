package den.watcher

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Looper
import android.os.Process
import android.view.View
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.concurrent.Executor

/**
 * Draws the app's screen in a few states, light and dark, into PNGs for a
 * pull request. Gradle runs it only with -Pscreenshots=<folder>, as the
 * Android app workflow does; the other unit tests leave it out. SDK 34, as
 * Robolectric needs Java 21 for 35.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class Screenshots {
    private val folder = File(System.getProperty("screenshots") ?: "build/screenshots")

    @Test
    fun firstStart() = shot("1-first-start") {}

    @Test
    fun recording() = shot("2-recording") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    @Test
    fun notHome() = shot("3-not-home") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
        problem = Problem.NOT_HOME
    }

    @Test
    fun notAdded() = shot("4-not-added") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        problem = Problem.NOT_ADDED
    }

    @Test
    fun otherNetwork() = shot("8-other-network") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
        usualNetworks = setOf("192.168.1.0/24 via 192.168.1.1")
        otherNetwork = "10.0.0.0/24 via 10.0.0.1"
    }

    @Test
    fun nearby() = shot("9-nearby", permissions = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)) {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    @Test
    fun dataChoice() = shot("10-data-choice") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
        dataChoice = DataChoice(storage = false, network = false)
    }

    @Test
    fun appUsage() = shot("11-app-usage", usageAccess = true) {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    @Test
    fun german() = shot("5-german", "de") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    @Test
    fun locked() = shot("6-locked") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
        paired = true
    }

    @Test
    fun released() = shot("7-released") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
        paired = true
        releasedUntil = RELEASED_UNTIL
    }

    @Test
    fun map() = shot("12-map", screen = MapActivity::class.java, fill = ::keepRoute) {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    @Test
    fun mapPoint() = shot(
        "13-map-point",
        screen = MapActivity::class.java,
        fill = ::keepRoute,
        // Taps the point at the café.
        tap = { (it as MapActivity).findViewById<RouteMapView>(R.id.map).onSelect?.invoke(5) },
    ) {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    @Test
    fun mapGerman() = shot("14-map-german", "de", screen = MapActivity::class.java, fill = ::keepRoute) {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    /** A morning's route kept for the map, from home past a café to work, with the scans along it. */
    private fun keepRoute(store: Store) {
        // On the hour, so the light and the dark screenshot keep the same points.
        val hour = 60 * 60_000L
        val start = (System.currentTimeMillis() - 3 * hour) / hour * hour
        val way = listOf(
            0 to (53.5511 to 9.9937), 10 to (53.5512 to 9.9938), 25 to (53.5510 to 9.9936),
            32 to (53.5530 to 9.9890), 40 to (53.5560 to 9.9850), 52 to (53.5561 to 9.9851),
            60 to (53.5585 to 9.9800), 68 to (53.5620 to 9.9760), 80 to (53.5621 to 9.9761),
            110 to (53.5622 to 9.9759), 150 to (53.5620 to 9.9760),
        )
        for ((minutes, at) in way) {
            val time = start + minutes * 60_000L
            store.addMapPoint(RoutePoint(time, at.first, at.second, 25.0))
            store.addMapScan(
                SeenScan(
                    time / 1000 + 40,
                    listOf(
                        SeenNetwork(if (minutes < 30) "Home" else "Café Hafen", -48, 5180, "WPA2/WPA3", minutes < 30),
                        SeenNetwork("Neighbours", -67, 2437, "WPA2", false),
                        SeenNetwork("", -74, 5500, "WPA3", false),
                        SeenNetwork("Free Wi-Fi", -82, 2462, "Open", false),
                    ),
                ),
            )
        }
    }

    /**
     * Saves the screen with settings as set and the permissions granted, and
     * usage access when usageAccess is set, as <name>-light.png and
     * <name>-dark.png: the main screen, or another with what fill keeps in
     * the Store, after tap.
     */
    private fun shot(
        name: String,
        language: String? = null,
        permissions: Array<String> = emptyArray(),
        usageAccess: Boolean = false,
        screen: Class<out Activity> = MainActivity::class.java,
        fill: (Store) -> Unit = {},
        tap: (Activity) -> Unit = {},
        set: Settings.() -> Unit,
    ) {
        folder.mkdirs()
        for (mode in listOf("light", "dark")) {
            val qualifiers = listOfNotNull(language, if (mode == "dark") "night" else "notnight")
            RuntimeEnvironment.setQualifiers("+" + qualifiers.joinToString("-"))
            val app = RuntimeEnvironment.getApplication()
            app.getSharedPreferences("settings", 0).edit().clear().commit()
            Settings(app).set()
            shadowOf(app).grantPermissions(*permissions)
            shadowOf(app.getSystemService(AppOpsManager::class.java)).setMode(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                app.packageName,
                if (usageAccess) AppOpsManager.MODE_ALLOWED else AppOpsManager.MODE_DEFAULT,
            )
            Store(app).use(fill)
            // The map reads its points in place, so they are there for the shot.
            MapActivity.background = Executor { it.run() }
            val activity = Robolectric.buildActivity(screen).setup().get()
            // Runs the status refresh that onResume posts.
            shadowOf(Looper.getMainLooper()).idle()
            tap(activity)
            val content = activity.findViewById<View>(R.id.content)
            val metrics = activity.resources.displayMetrics
            val width = metrics.widthPixels
            content.measure(
                View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
            )
            val height = maxOf(content.measuredHeight, metrics.heightPixels)
            content.layout(0, 0, width, content.measuredHeight)
            if (screen != MainActivity::class.java) {
                // A first draw asks for the map's tiles, which come in on the main thread.
                content.draw(Canvas(Bitmap.createBitmap(width, content.measuredHeight, Bitmap.Config.ARGB_8888)))
                repeat(TILE_WAIT_SECONDS) {
                    Thread.sleep(1000)
                    shadowOf(Looper.getMainLooper()).idle()
                }
            }
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(activity.getColor(R.color.surface))
            content.draw(canvas)
            File(folder, "$name-$mode.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }

    private companion object {
        /** A fixed time for the last push, so the screenshots stay the same. */
        const val LAST_PUSH = 1_793_000_000L

        /** A time the hub allows a change until, far enough ahead that the screenshot shows it. */
        const val RELEASED_UNTIL = 4_102_444_800L

        /** How long a map waits for its tiles from OpenStreetMap; without internet it shows its plain background. */
        const val TILE_WAIT_SECONDS = 5
    }
}
