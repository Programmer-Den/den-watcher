package den.watcher

import android.os.Looper
import org.robolectric.Shadows.shadowOf

/**
 * Runs the main thread until done, for at most 5 seconds, while another
 * thread, such as the map's, reads what it shows.
 */
fun waitFor(done: () -> Boolean) {
    repeat(250) {
        shadowOf(Looper.getMainLooper()).idle()
        if (done()) return
        Thread.sleep(20)
    }
}
