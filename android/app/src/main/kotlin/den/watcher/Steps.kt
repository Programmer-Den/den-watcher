package den.watcher

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build

/**
 * The steps counted today, as kept between readings: the day they belong
 * to, as days since 1970 on the phone's clock in its time zone, the steps
 * of that day so far, and the step counter's value at the reading before.
 */
data class StepCount(val day: Long, val today: Long, val counter: Long) {
    /**
     * The count after the step counter told counter on day: the steps since
     * the reading before are added to today, or start a new day. The
     * counter starts at 0 again when the phone restarts, so a smaller value
     * than before counts as the steps since then.
     */
    fun next(counter: Long, day: Long): StepCount {
        val steps = if (counter >= this.counter) counter - this.counter else counter
        return StepCount(day, if (day == this.day) today + steps else steps, counter)
    }
}

/**
 * Counts the steps from the phone's step counter, a chip that counts them
 * itself and tells the app in batches, so it costs almost no battery.
 * Android asks for the Physical activity permission for it from Android 10
 * on. The app listens once per process start and keeps the newest count.
 */
object Steps {
    /** How long the chip may keep the steps before it tells them, in microseconds. */
    private const val BATCH_MICROS = 5 * 60 * 1_000_000

    @Volatile
    private var latest: Long? = null

    @Volatile
    private var listening = false

    private val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            latest = event.values.firstOrNull()?.toLong()
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }

    /** Whether the app may count the steps. */
    fun allowed(context: Context): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

    /** Whether the phone has a step counter. */
    fun available(context: Context): Boolean =
        context.getSystemService(SensorManager::class.java)?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null

    /**
     * The step counter's newest value, the steps since the phone started,
     * or null when it may not be read, the phone has none, or it has not
     * told one yet since the app started listening.
     */
    @Synchronized
    fun read(context: Context): Long? {
        if (!allowed(context)) {
            return null
        }
        if (!listening) {
            val sensors = context.getSystemService(SensorManager::class.java) ?: return null
            val counter = sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return null
            listening = sensors.registerListener(listener, counter, SensorManager.SENSOR_DELAY_NORMAL, BATCH_MICROS)
        }
        return latest
    }

    /** The steps of today as the extra Steps, with its history. */
    fun extra(today: Long?): Extra = Extra(
        id = GROUP,
        title = Words("Steps", "Schritte", "Pas", "Pasos"),
        description = Words(
            "The steps the phone counted today, from its step counter, which starts again at midnight.",
            "Die Schritte, die das Handy heute gezählt hat, von seinem Schrittzähler, der um Mitternacht neu beginnt.",
            "Les pas que le téléphone a comptés aujourd'hui, par son podomètre, qui repart de zéro à minuit.",
            "Los pasos que el teléfono contó hoy, con su podómetro, que vuelve a empezar a medianoche.",
        ),
        values = listOf(
            ExtraValue(
                "today",
                Words("Steps today", "Schritte heute", "Pas aujourd'hui", "Pasos hoy"),
                ExtraUnit.NUMBER,
                value = today?.toDouble(),
                history = true,
            ),
        ),
    )

    /** How the values with a history are described, by the name the history keeps them under. */
    fun descriptions(): Map<String, org.json.JSONObject> = extra(null).descriptions()

    /** The group of the steps. */
    const val GROUP = "steps"
}
