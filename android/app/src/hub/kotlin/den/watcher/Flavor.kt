package den.watcher

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.google.zxing.BarcodeFormat
import com.google.zxing.WriterException
import com.journeyapps.barcodescanner.BarcodeEncoder

/**
 * What the hub app adds to the phone app's main screen: a card for its hub
 * at the top, which tells whether it runs and where, shows the page's
 * address as a code for the other phones to scan, switches the hub and opens
 * its page. Everything below is the phone app's, which here sends to this
 * hub unless another hub is scanned.
 */
object Flavor {
    /** Where the card goes in the screen's content: after the title and the intro. */
    private const val CARD_POSITION = 2

    /** The code's size in pixels, which the ImageView scales. */
    private const val CODE_PIXELS = 512

    /** The page address the code shows, so it is drawn again only when it changes. */
    private var shownCode: String? = null

    fun onCreate(activity: Activity) {
        val settings = Settings(activity)
        if (settings.hubAddress.isEmpty()) {
            // The phone part sends to the hub next to it.
            settings.hubAddress = HubConfig.LOCAL_ADDRESS
        }
        val content = activity.findViewById<LinearLayout>(R.id.content)
        val card = activity.layoutInflater.inflate(R.layout.hub_card, content, false)
        content.addView(card, CARD_POSITION)
        shownCode = null

        val state = HubState(activity)
        val run = card.findViewById<Switch>(R.id.hub_run)
        run.isChecked = state.wanted
        run.setOnCheckedChangeListener { _, on ->
            state.wanted = on
            if (on) {
                state.failure = ""
                HubService.start(activity)
            } else {
                HubService.stop(activity)
                state.running = false
            }
            onShow(activity)
        }
        card.findViewById<Button>(R.id.hub_open).setOnClickListener {
            try {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("http://${HubConfig.LOCAL_ADDRESS}/")))
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(activity, R.string.no_browser, Toast.LENGTH_SHORT).show()
            }
        }
        if (state.wanted) {
            HubService.start(activity)
        }
    }

    fun onShow(activity: Activity) {
        val card = activity.findViewById<View>(R.id.hub_card) ?: return
        val state = HubState(activity)
        card.findViewById<TextView>(R.id.hub_status).text = HubService.statusText(activity)
        val page = if (state.wanted && state.running) HubConfig.pageUrl(LanAddress.ipv4(activity)) else null
        val code = card.findViewById<ImageView>(R.id.hub_code)
        if (page != shownCode) {
            code.setImageBitmap(page?.let(::drawCode))
            shownCode = page
        }
        val showCode = page != null && code.drawable != null
        code.visibility = if (showCode) View.VISIBLE else View.GONE
        card.findViewById<View>(R.id.hub_code_hint).visibility = code.visibility
        card.findViewById<View>(R.id.hub_open).isEnabled = state.wanted && state.running
        // Only while this device's recording sends to its own hub.
        card.findViewById<View>(R.id.hub_own_phone).visibility =
            if (Settings(activity).hubAddress == HubConfig.LOCAL_ADDRESS) View.VISIBLE else View.GONE
    }

    /** The code of the page's address, as the phone app scans it from the hub's page, or null. */
    private fun drawCode(page: String): Bitmap? = try {
        BarcodeEncoder().encodeBitmap(page, BarcodeFormat.QR_CODE, CODE_PIXELS, CODE_PIXELS)
    } catch (_: WriterException) {
        null
    }
}
