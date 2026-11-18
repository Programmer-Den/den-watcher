package den.watcher

import android.os.Looper
import org.robolectric.Shadows.shadowOf

/**
 * Runs the main thread until done, while another thread, such as the
 * map's, reads what it shows; fails after 5 seconds without.
 */
fun waitFor(done: () -> Boolean) {
    repeat(250) {
        shadowOf(Looper.getMainLooper()).idle()
        if (done()) return
        Thread.sleep(20)
    }
    throw AssertionError("not done after 5 seconds")
}
