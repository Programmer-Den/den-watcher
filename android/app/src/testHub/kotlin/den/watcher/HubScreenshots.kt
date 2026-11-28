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
 * Draws the hub app's main screen with its hub card, light and dark, into
 * PNGs for a pull request, as Screenshots does for the phone app. Gradle runs
 * it only with -Pscreenshots=<folder>.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xhdpi")
class HubScreenshots {
    private val folder = File(System.getProperty("screenshots") ?: "build/screenshots")

    @Test
    fun running() = shot("hub-1-running") { running = true }

    @Test
    fun recording() = shot("hub-2-recording", recording = true) { running = true }

    @Test
    fun failed() = shot("hub-3-failed") { failure = "listen tcp :9393: bind: address already in use" }

    @Test
    fun off() = shot("hub-4-off") { wanted = false }

    @Test
    fun german() = shot("hub-5-german", "de") { running = true }

    @Test
    fun rooted() {
        Root.granted = true
        try {
            shot("hub-6-rooted") { running = true }
        } finally {
            Root.granted = null
        }
    }

    /** Saves the main screen with the hub as set, as <name>-light.png and <name>-dark.png. */
    private fun shot(name: String, language: String? = null, recording: Boolean = false, set: HubState.() -> Unit) {
        folder.mkdirs()
        LanAddress.lookup = { "192.168.1.20" }
        try {
            for (mode in listOf("light", "dark")) {
                val qualifiers = listOfNotNull(language, if (mode == "dark") "night" else "notnight")
                RuntimeEnvironment.setQualifiers("+" + qualifiers.joinToString("-"))
                val app = RuntimeEnvironment.getApplication()
                app.getSharedPreferences("settings", 0).edit().clear().commit()
                app.getSharedPreferences("hub", 0).edit().clear().commit()
                HubState(app).set()
                if (recording) {
                    Settings(app).apply {
                        this.recording = true
                        lastPush = LAST_PUSH
                    }
                }
                val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
                val activity = controller.get()
                shadowOf(Looper.getMainLooper()).idle()
                val content = activity.findViewById<View>(R.id.content)
                val metrics = activity.resources.displayMetrics
                val width = metrics.widthPixels
                content.measure(
                    View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
                )
                // The top of the screen, where the hub's card is.
                val height = minOf(content.measuredHeight, metrics.heightPixels)
                content.layout(0, 0, width, content.measuredHeight)
                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                canvas.drawColor(activity.getColor(R.color.surface))
                content.draw(canvas)
                File(folder, "$name-$mode.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                controller.pause().stop().destroy()
            }
        } finally {
            LanAddress.lookup = { null }
        }
    }

    private companion object {
        /** A fixed time for the last push, so the screenshots stay the same. */
        const val LAST_PUSH = 1_793_000_000L
    }
}
