package den.watcher

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
import android.text.format.DateFormat
import android.view.View
import android.widget.Button
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.google.zxing.integration.android.IntentIntegrator

/**
 * The app's only screen, in cards as on the website: how recording goes,
 * with a dot as on the hub's page, the pairing code to enter on the hub,
 * the hub's address, scanned from the hub's page, which data to collect and
 * what is sent. Once the hub took a push, the hub's address, stopping and
 * which data to collect are locked until the hub allows a change.
 */
class MainActivity : Activity() {
    private lateinit var settings: Settings
    private lateinit var address: TextView
    private lateinit var addressHint: TextView
    private lateinit var scan: Button
    private lateinit var toggle: Button
    private lateinit var state: TextView
    private lateinit var status: TextView
    private lateinit var problemLine: TextView
    private lateinit var dot: View
    private lateinit var openHub: Button
    private val handler = Handler(Looper.getMainLooper())
    private var showingDataChoice = false

    private val refresh = object : Runnable {
        override fun run() {
            showStatus()
            handler.postDelayed(this, REFRESH_MILLIS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        settings = Settings(this)

        findViewById<TextView>(R.id.code).text = PairingCode.format(settings.code)

        address = findViewById(R.id.address)
        addressHint = findViewById(R.id.address_hint)
        scan = findViewById(R.id.scan)
        scan.setOnClickListener { scanCode() }

        toggle = findViewById(R.id.toggle)
        toggle.setOnClickListener { setRecording(!settings.recording) }

        state = findViewById(R.id.state)
        status = findViewById(R.id.status)
        problemLine = findViewById(R.id.problem)
        dot = findViewById(R.id.dot)
        openHub = findViewById(R.id.open_hub)
        openHub.setOnClickListener { openHubPage() }

        findViewById<Button>(R.id.network_usual).setOnClickListener {
            settings.otherNetwork?.let { settings.usualNetworks += it }
            settings.otherNetwork = null
            OtherNetworkNotice.hide(this)
            showStatus()
        }

        findViewById<Button>(R.id.battery).setOnClickListener {
            runCatching { startActivity(Intent(ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
        }

        findViewById<Button>(R.id.nearby).setOnClickListener { allowNearby() }

        for ((id, change) in dataSwitches) {
            findViewById<Switch>(id).setOnCheckedChangeListener { _, on ->
                // Only the user changes it, not showDataChoice setting the switches.
                // The hub may have locked the phone since the switches were shown.
                if (!showingDataChoice) {
                    if (!settings.locked()) {
                        settings.dataChoice = settings.dataChoice.change(on)
                    }
                    showDataChoice()
                }
            }
        }
    }

    /** Each switch under Which data do you want to collect, with how it changes the choice. */
    private val dataSwitches: List<Pair<Int, DataChoice.(Boolean) -> DataChoice>> = listOf(
        R.id.collect_system to { on -> copy(system = on) },
        R.id.collect_battery to { on -> copy(battery = on) },
        R.id.collect_memory to { on -> copy(memory = on) },
        R.id.collect_storage to { on -> copy(storage = on) },
        R.id.collect_network to { on -> copy(network = on) },
        R.id.collect_traffic to { on -> copy(traffic = on) },
        R.id.collect_nearby to { on -> copy(nearby = on) },
    )

    /**
     * Which data is collected: a group's switches below it are greyed out while it
     * is off, and all of them while the hub locks the phone, as switching
     * everything off would stop recording.
     */
    private fun showDataChoice() {
        val choice = settings.dataChoice
        val locked = settings.locked()
        val switches = mapOf(
            R.id.collect_system to (choice.system to true),
            R.id.collect_battery to (choice.battery to choice.system),
            R.id.collect_memory to (choice.memory to choice.system),
            R.id.collect_storage to (choice.storage to choice.system),
            R.id.collect_network to (choice.network to true),
            R.id.collect_traffic to (choice.traffic to choice.network),
            R.id.collect_nearby to (choice.nearby to choice.network),
        )
        showingDataChoice = true
        for ((id, state) in switches) {
            val (on, groupOn) = state
            findViewById<Switch>(id).apply {
                isChecked = on
                isEnabled = groupOn && !locked
                alpha = if (isEnabled) 1f else DISABLED_ALPHA
            }
        }
        showingDataChoice = false
        findViewById<TextView>(R.id.collect_hint).setText(if (locked) R.string.collect_locked else R.string.collect_hint)
    }

    /**
     * Asks for the location permission the networks nearby need: first while
     * the app is open, then all the time, which Android asks for on its own
     * and, from Android 11 on, only in its settings.
     */
    private fun allowNearby() {
        when {
            !Nearby.allowed(this) -> requestPermissions(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                NEARBY_REQUEST,
            )
            !Nearby.allowedAlways(this) ->
                requestPermissions(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), NEARBY_REQUEST)
            else -> runCatching {
                startActivity(Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        showStatus()
    }

    /** Whether the networks nearby are read: not, only while the app is open, or all the time. */
    private fun showNearby() {
        val always = Nearby.allowedAlways(this)
        findViewById<TextView>(R.id.nearby_state).setText(
            when {
                always -> R.string.nearby_always
                Nearby.allowed(this) -> R.string.nearby_open
                else -> R.string.nearby_off
            },
        )
        findViewById<Button>(R.id.nearby).setText(
            when {
                always -> R.string.nearby_settings
                Nearby.allowed(this) -> R.string.nearby_allow_always
                else -> R.string.nearby_allow
            },
        )
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresh)
    }

    override fun onPause() {
        handler.removeCallbacks(refresh)
        super.onPause()
    }

    /** Opens the scanner for the code on the hub's page, unless the hub's address is locked. */
    private fun scanCode() {
        if (settings.locked()) {
            showStatus()
            return
        }
        IntentIntegrator(this)
            .setDesiredBarcodeFormats(IntentIntegrator.QR_CODE)
            .setPrompt(getString(R.string.scan_prompt))
            .setBeepEnabled(false)
            .setOrientationLocked(false)
            .initiateScan()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result == null) {
            super.onActivityResult(requestCode, resultCode, data)
            return
        }
        // Null when the scan was cancelled.
        val code = result.contents ?: return
        val scanned = HubAddress.fromCode(code)
        if (scanned == null) {
            Toast.makeText(this, R.string.scan_invalid, Toast.LENGTH_LONG).show()
            return
        }
        // A push that is taking the old hub's answer finishes first, so it is not kept for the new one.
        synchronized(Recorder.hubLock) {
            // The hub may have locked it while the scanner was open.
            if (settings.locked()) {
                showStatus()
                return
            }
            if (scanned != settings.hubAddress) {
                // Another hub is locked once it takes a push; until then the
                // address can be scanned again, as when the phone was not added.
                settings.paired = false
                settings.releasedUntil = 0
                settings.releasedAt = 0
                settings.hubKey = ""
                // The network the new hub is first reached on is the usual one.
                settings.usualNetworks = emptySet()
                settings.otherNetwork = null
            }
            settings.hubAddress = scanned
        }
        Toast.makeText(this, R.string.address_saved, Toast.LENGTH_SHORT).show()
        if (settings.recording) {
            // Tries the new address right away.
            RecorderService.start(this)
        } else {
            setRecording(true)
        }
    }

    private fun setRecording(on: Boolean) {
        if (!on && settings.locked()) {
            showStatus()
            return
        }
        settings.recording = on
        if (on) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
            }
            SyncJob.schedule(this)
            RecorderService.start(this)
        } else {
            RecorderService.stop(this)
            SyncJob.cancel(this)
        }
        showStatus()
    }

    private fun showStatus() {
        val recording = settings.recording
        val problem = settings.problem
        toggle.setText(if (recording) R.string.stop else R.string.start)
        state.setText(if (recording) R.string.state_recording else R.string.state_stopped)
        val color = getColor(dotColor(recording, problem))
        dot.backgroundTintList = ColorStateList.valueOf(color)
        val lines = mutableListOf(getString(if (recording) R.string.status_recording else R.string.status_stopped))
        val lastPush = settings.lastPush
        if (lastPush > 0) {
            val time = DateFormat.getTimeFormat(this).format(java.util.Date(lastPush * 1000))
            val day = DateFormat.getMediumDateFormat(this).format(java.util.Date(lastPush * 1000))
            lines += getString(R.string.status_last_push, "$day $time")
        }
        status.text = lines.joinToString("\n")
        problemLine.text = problem?.let { getString(problemText(it)) }
        problemLine.setTextColor(if (recording) color else getColor(R.color.on_surface_variant))
        problemLine.visibility = if (problem == null) View.GONE else View.VISIBLE
        findViewById<View>(R.id.battery_group).visibility = if (recording) View.VISIBLE else View.GONE
        showAddress(recording)
        val other = settings.otherNetwork
        findViewById<View>(R.id.network_group).visibility = if (other == null) View.GONE else View.VISIBLE
        other?.let { findViewById<TextView>(R.id.network).text = getString(R.string.network_notice, it) }
        openHub.visibility = if (HubAddress.pageUrl(settings.hubAddress) == null) View.GONE else View.VISIBLE
        showNearby()
        showDataChoice()
    }

    /** The hub's address, and whether it and stopping are locked or the hub allows a change. */
    private fun showAddress(recording: Boolean) {
        val locked = settings.locked()
        address.text = settings.hubAddress.ifEmpty { getString(R.string.address_none) }
        val releasedUntil = settings.releasedUntil
        val released = !locked && settings.paired && releasedUntil > 0
        addressHint.text = when {
            locked -> getString(R.string.address_locked)
            released -> {
                val time = DateFormat.getTimeFormat(this).format(java.util.Date(releasedUntil * 1000))
                getString(R.string.address_released, time)
            }
            else -> getString(R.string.address_hint)
        }
        address.setCompoundDrawablesRelativeWithIntrinsicBounds(
            when {
                locked -> R.drawable.ic_lock
                released -> R.drawable.ic_lock_open
                else -> 0
            },
            0,
            0,
            0,
        )
        addressHint.setTextColor(getColor(if (released) R.color.waiting else R.color.on_surface_variant))
        // Scanning is the first thing to do without a hub, and of no use while the hub locks it.
        scan.visibility = if (locked) View.GONE else View.VISIBLE
        if (settings.hubAddress.isEmpty()) {
            scan.setBackgroundResource(R.drawable.button_filled)
            scan.setTextColor(getColorStateList(R.color.button_filled_text))
        } else {
            scan.setBackgroundResource(R.drawable.button_outlined)
            scan.setTextColor(getColorStateList(R.color.button_outlined_text))
        }
        toggle.isEnabled = !(recording && locked)
    }

    /** Opens the hub's page in the browser, at the address that was saved. */
    private fun openHubPage() {
        val url = HubAddress.pageUrl(settings.hubAddress) ?: return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: android.content.ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Green while the hub takes the usage, amber while the app waits for the
     * home Wi-Fi or an address, red when the hub does not take it.
     */
    private fun dotColor(recording: Boolean, problem: Problem?): Int = when {
        !recording -> R.color.off
        problem == null -> R.color.ok
        problem == Problem.NOT_HOME || problem == Problem.NO_ADDRESS -> R.color.waiting
        else -> R.color.error
    }

    private fun problemText(problem: Problem): Int = when (problem) {
        Problem.NO_ADDRESS -> R.string.problem_no_address
        Problem.NOT_HOME -> R.string.problem_not_home
        Problem.UNREACHABLE -> R.string.problem_unreachable
        Problem.NOT_ADDED -> R.string.problem_not_added
        Problem.REFUSED -> R.string.problem_refused
    }

    private companion object {
        const val REFRESH_MILLIS = 5_000L
        const val NEARBY_REQUEST = 1
        const val DISABLED_ALPHA = 0.5f
    }
}
