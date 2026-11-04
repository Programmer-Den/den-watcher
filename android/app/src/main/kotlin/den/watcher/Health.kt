package den.watcher

import android.content.Intent
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import kotlin.math.abs

/**
 * What the battery tells beyond its charge and temperature, as Android gives
 * it every app without a permission; null is a value the phone does not tell.
 */
data class BatteryDetails(
    /** BatteryManager's BATTERY_STATUS_*: charging, discharging, not charging or full. */
    val status: Int,
    /** BatteryManager's BATTERY_PLUGGED_*, or 0 when it is not plugged in. */
    val plugged: Int,
    /** BatteryManager's BATTERY_HEALTH_*. */
    val health: Int,
    val volts: Double?,
    /**
     * The current into the battery in milliamperes, negative while it is
     * discharging, as Android defines it; some phone makers turn the sign
     * around.
     */
    val milliamps: Double?,
    /** How often the battery was charged in full, from Android 14 on. */
    val cycles: Int?,
) {
    /** What the battery takes in or gives out, in watts, without the sign phone makers disagree on. */
    val watts: Double?
        get() = if (volts != null && milliamps != null) abs(volts * milliamps) / 1000 else null
}

/** How hot the phone runs, as Android tells it: null is a value the phone does not tell. */
data class Thermal(
    /** PowerManager's THERMAL_STATUS_*: none, light, moderate, severe, critical, emergency or shutdown. */
    val status: Int?,
    /**
     * How close the phone is to slowing itself down for the heat, in
     * percent: 100 is where it throttles hard, from Android 11 on.
     */
    val headroomPercent: Double?,
)

/** Reads the battery's details and the phone's heat, and tells them as den-watcher's extras. */
object Health {
    /** The details of the battery broadcast battery, and the current Android measures. */
    fun battery(battery: Intent?, manager: BatteryManager?): BatteryDetails? {
        battery ?: return null
        val millivolts = battery.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1)
        val microamps = manager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) ?: Int.MIN_VALUE
        val cycles = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            battery.getIntExtra(BatteryManager.EXTRA_CYCLE_COUNT, -1)
        } else {
            -1
        }
        return BatteryDetails(
            status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN),
            plugged = battery.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0),
            health = battery.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN),
            volts = millivolts.takeIf { it > 0 }?.let { it / 1000.0 },
            // Phones without a current sensor tell Int.MIN_VALUE, some 0.
            milliamps = microamps.takeIf { it != Int.MIN_VALUE && it != 0 }?.let { it / 1000.0 },
            cycles = cycles.takeIf { it >= 0 },
        )
    }

    /** The phone's heat, as far as its Android version tells it. */
    fun thermal(power: PowerManager?): Thermal? {
        power ?: return null
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return null
        }
        val headroom = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android asks to be asked at most once a second; a reading is every half minute.
            power.getThermalHeadroom(0).takeIf { !it.isNaN() && it >= 0 }
        } else {
            null
        }
        return Thermal(power.currentThermalStatus, headroom?.let { it * 100.0 })
    }

    /** The battery's details as the extra Battery health. */
    fun batteryExtra(details: BatteryDetails?): Extra = Extra(
        id = BATTERY,
        title = Words("Battery health", "Akkuzustand", "État de la batterie", "Estado de la batería"),
        description = Words(
            "What the phone's battery tells: whether it charges and from what, its health, how often it was charged in full, and the power it takes in or gives out.",
            "Was der Akku des Handys meldet: ob und woran er lädt, sein Zustand, wie oft er voll geladen wurde, und die Leistung, die er aufnimmt oder abgibt.",
            "Ce que la batterie du téléphone indique : si elle charge et sur quoi, son état, combien de fois elle a été chargée à fond, et la puissance qu'elle reçoit ou fournit.",
            "Lo que indica la batería del teléfono: si se carga y con qué, su estado, cuántas veces se cargó por completo y la potencia que recibe o entrega.",
        ),
        values = buildList {
            add(
                ExtraValue(
                    "power",
                    Words("Power", "Leistung", "Puissance", "Potencia"),
                    ExtraUnit.WATTS,
                    value = details?.watts,
                    history = true,
                ),
            )
            details ?: return@buildList
            add(ExtraValue("state", Words("State", "Status", "État", "Estado"), ExtraUnit.TEXT, text = status(details.status)))
            add(ExtraValue("charger", Words("Charger", "Ladegerät", "Chargeur", "Cargador"), ExtraUnit.TEXT, text = charger(details.plugged)))
            add(ExtraValue("health", Words("Health", "Zustand", "Santé", "Salud"), ExtraUnit.TEXT, text = health(details.health)))
            details.cycles?.let {
                add(ExtraValue("cycles", Words("Charge cycles", "Ladezyklen", "Cycles de charge", "Ciclos de carga"), ExtraUnit.NUMBER, value = it.toDouble()))
            }
            details.volts?.let {
                add(ExtraValue("voltage", Words("Voltage (V)", "Spannung (V)", "Tension (V)", "Tensión (V)"), ExtraUnit.NUMBER, value = it))
            }
            details.milliamps?.let {
                add(ExtraValue("current", Words("Current (mA)", "Strom (mA)", "Courant (mA)", "Corriente (mA)"), ExtraUnit.NUMBER, value = it))
            }
        },
    )

    /** The phone's heat as the extra Heat. */
    fun thermalExtra(thermal: Thermal?): Extra = Extra(
        id = THERMAL,
        title = Words("Heat", "Wärme", "Chaleur", "Calor"),
        description = Words(
            "How hot the phone runs as Android judges it, and how close it is to slowing itself down for the heat: at 100 % it throttles hard.",
            "Wie heiß das Handy läuft, wie Android es einschätzt, und wie nah es daran ist, sich wegen der Wärme zu drosseln: bei 100 % drosselt es stark.",
            "À quel point le téléphone chauffe selon Android, et à quel point il est proche de ralentir à cause de la chaleur : à 100 %, il ralentit fortement.",
            "Lo caliente que va el teléfono según Android, y lo cerca que está de frenarse por el calor: al 100 % se frena mucho.",
        ),
        values = buildList {
            add(
                ExtraValue(
                    "headroom",
                    Words("Toward throttling", "Bis zur Drosselung", "Vers le ralentissement", "Hacia la limitación"),
                    ExtraUnit.PERCENT,
                    value = thermal?.headroomPercent,
                    history = true,
                ),
            )
            thermal?.status?.let {
                add(ExtraValue("status", Words("Throttling", "Drosselung", "Ralentissement", "Limitación"), ExtraUnit.TEXT, text = thermalStatus(it)))
            }
        },
    )

    /** How the values with a history are described, by the name the history keeps them under. */
    fun descriptions(): Map<String, org.json.JSONObject> =
        batteryExtra(null).descriptions() + thermalExtra(null).descriptions()

    private fun status(status: Int): Words = when (status) {
        BatteryManager.BATTERY_STATUS_CHARGING -> Words("Charging", "Lädt", "En charge", "Cargando")
        BatteryManager.BATTERY_STATUS_DISCHARGING -> Words("Discharging", "Entlädt", "En décharge", "Descargando")
        BatteryManager.BATTERY_STATUS_NOT_CHARGING -> Words("Not charging", "Lädt nicht", "Ne charge pas", "No se carga")
        BatteryManager.BATTERY_STATUS_FULL -> Words("Full", "Voll", "Pleine", "Llena")
        else -> UNKNOWN
    }

    private fun charger(plugged: Int): Words = when (plugged) {
        0 -> Words("Not plugged in", "Nicht angesteckt", "Non branché", "No conectado")
        BatteryManager.BATTERY_PLUGGED_AC -> Words("Power adapter", "Netzteil", "Adaptateur secteur", "Adaptador de corriente")
        BatteryManager.BATTERY_PLUGGED_USB -> Words("USB", "USB", "USB", "USB")
        BatteryManager.BATTERY_PLUGGED_WIRELESS -> Words("Wireless", "Kabellos", "Sans fil", "Inalámbrico")
        BatteryManager.BATTERY_PLUGGED_DOCK -> Words("Dock", "Dock", "Station d'accueil", "Base")
        else -> UNKNOWN
    }

    private fun health(health: Int): Words = when (health) {
        BatteryManager.BATTERY_HEALTH_GOOD -> Words("Good", "Gut", "Bonne", "Buena")
        BatteryManager.BATTERY_HEALTH_OVERHEAT -> Words("Overheating", "Überhitzt", "Surchauffe", "Sobrecalentada")
        BatteryManager.BATTERY_HEALTH_DEAD -> Words("Worn out", "Verbraucht", "Usée", "Agotada")
        BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> Words("Overvoltage", "Überspannung", "Surtension", "Sobretensión")
        BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> Words("Failure", "Defekt", "Défaillance", "Avería")
        BatteryManager.BATTERY_HEALTH_COLD -> Words("Too cold", "Zu kalt", "Trop froide", "Demasiado fría")
        else -> UNKNOWN
    }

    private fun thermalStatus(status: Int): Words = when (status) {
        PowerManager.THERMAL_STATUS_NONE -> Words("None", "Keine", "Aucun", "Ninguna")
        PowerManager.THERMAL_STATUS_LIGHT -> Words("Light", "Leicht", "Léger", "Leve")
        PowerManager.THERMAL_STATUS_MODERATE -> Words("Moderate", "Mittel", "Modéré", "Moderada")
        PowerManager.THERMAL_STATUS_SEVERE -> Words("Severe", "Stark", "Fort", "Fuerte")
        PowerManager.THERMAL_STATUS_CRITICAL -> Words("Critical", "Kritisch", "Critique", "Crítica")
        PowerManager.THERMAL_STATUS_EMERGENCY -> Words("Emergency", "Notfall", "Urgence", "Emergencia")
        PowerManager.THERMAL_STATUS_SHUTDOWN -> Words("Shutting down", "Schaltet ab", "Arrêt", "Apagándose")
        else -> UNKNOWN
    }

    /** The group of the battery's details. */
    const val BATTERY = "battery-health"

    /** The group of the phone's heat. */
    const val THERMAL = "thermal"

    private val UNKNOWN = Words("Unknown", "Unbekannt", "Inconnu", "Desconocido")
}
