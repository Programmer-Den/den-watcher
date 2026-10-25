package den.watcher

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Looper
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
    fun german() = shot("5-german", "de") {
        hubAddress = "192.168.1.20:9393"
        recording = true
        lastPush = LAST_PUSH
    }

    /** Saves the screen with settings as set, as <name>-light.png and <name>-dark.png. */
    private fun shot(name: String, language: String? = null, set: Settings.() -> Unit) {
        folder.mkdirs()
        for (mode in listOf("light", "dark")) {
            val qualifiers = listOfNotNull(language, if (mode == "dark") "night" else "notnight")
            RuntimeEnvironment.setQualifiers("+" + qualifiers.joinToString("-"))
            val app = RuntimeEnvironment.getApplication()
            app.getSharedPreferences("settings", 0).edit().clear().commit()
            Settings(app).set()
            val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
            // Runs the status refresh that onResume posts.
            shadowOf(Looper.getMainLooper()).idle()
            val content = activity.findViewById<View>(R.id.content)
            val metrics = activity.resources.displayMetrics
            val width = metrics.widthPixels
            content.measure(
                View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
            )
            val height = maxOf(content.measuredHeight, metrics.heightPixels)
            content.layout(0, 0, width, content.measuredHeight)
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
    }
}
