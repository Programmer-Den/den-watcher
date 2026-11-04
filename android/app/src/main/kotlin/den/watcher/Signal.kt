package den.watcher

import android.content.Context
import android.net.wifi.SupplicantState
import android.net.wifi.WifiManager
import android.os.Build
import android.telephony.CellSignalStrengthCdma
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.CellSignalStrengthTdscdma
import android.telephony.CellSignalStrengthWcdma
import android.telephony.TelephonyManager

/** The Wi-Fi the phone is connected to, as it is now: null is a value the phone does not tell. */
data class WifiLink(val dBm: Int?, val mbps: Int?, val mhz: Int?) {
    /**
     * The link quality in percent, from the signal, as den-watcher's Wi-Fi
     * add-on tells it on Linux: -110 dBm and below is 0, -40 dBm and above 100.
     */
    val qualityPercent: Double?
        get() = dBm?.let { ((it + 110) / 70.0 * 100).coerceIn(0.0, 100.0) }
}

/** The kinds of mobile network, by the newest the phone has a signal of. */
enum class Cellular { NONE, G2, G3, G4, G5 }

/**
 * The mobile network's signal, as it is now: the kind of network, Android's
 * signal level from 0 to 4 bars and the strength in dBm; null is a value the
 * phone does not tell.
 */
data class MobileSignal(val kind: Cellular, val level: Int?, val dBm: Int?)

/**
 * Reads how good the phone's Wi-Fi and mobile signal are, which Android
 * tells every app without a permission (the Wi-Fi's name needs one, the
 * signal does not), and tells them as den-watcher's extras.
 */
object Signal {
    /** The Wi-Fi the phone is connected to, or null when it is on none. */
    fun wifi(context: Context): WifiLink? {
        val wifi = context.getSystemService(WifiManager::class.java) ?: return null
        @Suppress("DEPRECATION")
        val info = runCatching { wifi.connectionInfo }.getOrNull() ?: return null
        if (info.supplicantState != SupplicantState.COMPLETED) {
            return null
        }
        return WifiLink(
            // -127 is no signal, as Android tells it while it does not know.
            dBm = info.rssi.takeIf { it in -126..0 },
            mbps = info.linkSpeed.takeIf { it > 0 },
            mhz = info.frequency.takeIf { it > 0 },
        )
    }

    /** The mobile signal, from Android 10 on, or null on a phone without one, such as a tablet with Wi-Fi only. */
    fun mobile(context: Context): MobileSignal? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return null
        }
        if (!context.packageManager.hasSystemFeature("android.hardware.telephony")) {
            return null
        }
        val telephony = context.getSystemService(TelephonyManager::class.java) ?: return null
        // A phone without a SIM card has no mobile network to tell of.
        if (telephony.simState == TelephonyManager.SIM_STATE_ABSENT) {
            return null
        }
        val strength = runCatching { telephony.signalStrength }.getOrNull()
        val cells = strength?.cellSignalStrengths.orEmpty()
        val kinds = cells.map {
            when (it) {
                is CellSignalStrengthNr -> Cellular.G5
                is CellSignalStrengthLte -> Cellular.G4
                is CellSignalStrengthWcdma, is CellSignalStrengthTdscdma -> Cellular.G3
                is CellSignalStrengthGsm, is CellSignalStrengthCdma -> Cellular.G2
                else -> Cellular.NONE
            }
        }
        val kind = kinds.maxOrNull() ?: Cellular.NONE
        if (kind == Cellular.NONE) {
            return MobileSignal(Cellular.NONE, 0, null)
        }
        val best = cells[kinds.indexOf(kind)]
        return MobileSignal(
            kind = kind,
            level = strength?.level,
            // Android tells Int.MAX_VALUE when it does not know.
            dBm = best.dbm.takeIf { it in -150..0 },
        )
    }

    /** The Wi-Fi as the extra Wi-Fi, with the ids den-watcher's Wi-Fi add-on uses for an interface named wifi. */
    fun wifiExtra(link: WifiLink?): Extra = Extra(
        id = WIFI,
        title = Words("Wi-Fi", "WLAN", "Wi-Fi", "Wi-Fi"),
        description = Words(
            "How good the phone's Wi-Fi connection is: its link quality from the signal, the signal level, the speed of the link and the band.",
            "Wie gut die WLAN-Verbindung des Handys ist: die Verbindungsqualität aus dem Signal, der Signalpegel, die Geschwindigkeit der Verbindung und das Band.",
            "La qualité de la connexion Wi-Fi du téléphone : la qualité du lien d'après le signal, le niveau du signal, le débit du lien et la bande.",
            "La calidad de la conexión Wi-Fi del teléfono: la calidad del enlace según la señal, el nivel de señal, la velocidad del enlace y la banda.",
        ),
        values = buildList {
            add(
                ExtraValue(
                    "wifi-quality",
                    Words("Link quality", "Verbindungsqualität", "Qualité du lien", "Calidad del enlace"),
                    ExtraUnit.PERCENT,
                    value = link?.qualityPercent,
                    history = true,
                ),
            )
            link ?: return@buildList
            // Without history, as the add-on: its chart would start at 0, with no room below.
            link.dBm?.let {
                add(ExtraValue("wifi-signal", Words("Signal (dBm)", "Signal (dBm)", "Signal (dBm)", "Señal (dBm)"), ExtraUnit.NUMBER, value = it.toDouble()))
            }
            link.mbps?.let {
                add(
                    ExtraValue(
                        "wifi-speed",
                        Words("Link speed (Mbit/s)", "Verbindungsgeschwindigkeit (Mbit/s)", "Débit du lien (Mbit/s)", "Velocidad del enlace (Mbit/s)"),
                        ExtraUnit.NUMBER,
                        value = it.toDouble(),
                    ),
                )
            }
            band(link.mhz)?.let {
                add(ExtraValue("wifi-band", Words("Band", "Band", "Bande", "Banda"), ExtraUnit.TEXT, text = Words(it, it.replace('.', ','), it.replace('.', ','), it.replace('.', ','))))
            }
        },
    )

    /** The mobile signal as the extra Mobile signal. */
    fun mobileExtra(signal: MobileSignal?): Extra = Extra(
        id = MOBILE,
        title = Words("Mobile signal", "Mobilfunksignal", "Signal mobile", "Señal móvil"),
        description = Words(
            "How good the phone's mobile signal is: Android's signal bars from 0 to 4 as a percentage, the strength in dBm and the kind of network. At 0 % the phone has no service.",
            "Wie gut das Mobilfunksignal des Handys ist: Androids Signalbalken von 0 bis 4 in Prozent, die Stärke in dBm und die Art des Netzes. Bei 0 % hat das Handy keinen Empfang.",
            "La qualité du signal mobile du téléphone : les barres de signal d'Android de 0 à 4 en pourcentage, la puissance en dBm et le type de réseau. À 0 %, le téléphone n'a pas de réseau.",
            "La calidad de la señal móvil del teléfono: las barras de señal de Android de 0 a 4 en porcentaje, la intensidad en dBm y el tipo de red. Al 0 % el teléfono no tiene cobertura.",
        ),
        values = buildList {
            add(
                ExtraValue(
                    "level",
                    Words("Signal bars", "Signalbalken", "Barres de signal", "Barras de señal"),
                    ExtraUnit.PERCENT,
                    value = signal?.level?.let { it.coerceIn(0, 4) * 25.0 },
                    history = true,
                ),
            )
            signal ?: return@buildList
            add(ExtraValue("network", Words("Network", "Netz", "Réseau", "Red"), ExtraUnit.TEXT, text = kind(signal.kind)))
            signal.dBm?.let {
                add(ExtraValue("signal", Words("Signal (dBm)", "Signal (dBm)", "Signal (dBm)", "Señal (dBm)"), ExtraUnit.NUMBER, value = it.toDouble()))
            }
        },
    )

    /** How the values with a history are described, by the name the history keeps them under. */
    fun descriptions(): Map<String, org.json.JSONObject> =
        wifiExtra(null).descriptions() + mobileExtra(null).descriptions()

    /** The band of a channel at mhz, as people name it, or null when it is not known. */
    fun band(mhz: Int?): String? = when (mhz) {
        null -> null
        in 2400..2500 -> "2.4 GHz"
        in 4900..5895 -> "5 GHz"
        in 5925..7125 -> "6 GHz"
        in 57000..71000 -> "60 GHz"
        else -> null
    }

    private fun kind(kind: Cellular): Words = when (kind) {
        Cellular.G5 -> Words("5G", "5G", "5G", "5G")
        Cellular.G4 -> Words("4G (LTE)", "4G (LTE)", "4G (LTE)", "4G (LTE)")
        Cellular.G3 -> Words("3G", "3G", "3G", "3G")
        Cellular.G2 -> Words("2G", "2G", "2G", "2G")
        Cellular.NONE -> Words("No service", "Kein Empfang", "Pas de réseau", "Sin cobertura")
    }

    /** The group of the Wi-Fi, the one den-watcher's Wi-Fi add-on uses. */
    const val WIFI = "wifi"

    /** The group of the mobile signal. */
    const val MOBILE = "mobile-signal"
}
