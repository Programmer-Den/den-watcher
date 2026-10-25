package den.watcher

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
import android.text.format.DateFormat
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast

/**
 * The app's only screen: the pairing code to enter on the hub, the hub's
 * address, switching recording on or off, and how the last push went.
 */
class MainActivity : Activity() {
    private lateinit var settings: Settings
    private lateinit var address: EditText
    private lateinit var toggle: Button
    private lateinit var status: TextView
    private val handler = Handler(Looper.getMainLooper())

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
        address.setText(settings.hubAddress)
        findViewById<Button>(R.id.save).setOnClickListener { saveAddress() }

        toggle = findViewById(R.id.toggle)
        toggle.setOnClickListener { setRecording(!settings.recording) }

        status = findViewById(R.id.status)

        findViewById<Button>(R.id.battery).setOnClickListener {
            runCatching { startActivity(Intent(ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
        }
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresh)
    }

    override fun onPause() {
        handler.removeCallbacks(refresh)
        super.onPause()
    }

    private fun saveAddress() {
        val typed = address.text.toString()
        if (HubAddress.pushUrl(typed) == null) {
            address.error = getString(R.string.address_invalid)
            return
        }
        settings.hubAddress = typed
        Toast.makeText(this, R.string.address_saved, Toast.LENGTH_SHORT).show()
        if (settings.recording) {
            // Tries the new address right away.
            RecorderService.start(this)
        } else {
            setRecording(true)
        }
    }

    private fun setRecording(on: Boolean) {
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
        toggle.setText(if (recording) R.string.stop else R.string.start)
        val lines = mutableListOf(getString(if (recording) R.string.status_recording else R.string.status_stopped))
        val lastPush = settings.lastPush
        if (lastPush > 0) {
            val time = DateFormat.getTimeFormat(this).format(java.util.Date(lastPush * 1000))
            val day = DateFormat.getMediumDateFormat(this).format(java.util.Date(lastPush * 1000))
            lines += getString(R.string.status_last_push, "$day $time")
        }
        settings.problem?.let { lines += getString(problemText(it)) }
        status.text = lines.joinToString("\n")
        findViewById<View>(R.id.battery_group).visibility = if (recording) View.VISIBLE else View.GONE
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
    }
}
