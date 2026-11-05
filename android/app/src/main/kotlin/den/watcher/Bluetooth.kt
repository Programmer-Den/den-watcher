package den.watcher

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.CRC32

/** The kinds of Bluetooth device, as den-watcher's Bluetooth add-on names them, and a car and a watch. */
enum class DeviceKind(val words: Words) {
    OTHER(Words("Device", "Gerät", "Appareil", "Dispositivo")),
    HEADPHONES(Words("Headphones", "Kopfhörer", "Casque", "Auriculares")),
    SPEAKER(Words("Speaker", "Lautsprecher", "Haut-parleur", "Altavoz")),
    KEYBOARD(Words("Keyboard", "Tastatur", "Clavier", "Teclado")),
    MOUSE(Words("Mouse", "Maus", "Souris", "Ratón")),
    GAME_CONTROLLER(Words("Game controller", "Gamecontroller", "Manette de jeu", "Mando de juego")),
    PHONE(Words("Phone", "Telefon", "Téléphone", "Teléfono")),
    COMPUTER(Words("Computer", "Computer", "Ordinateur", "Ordenador")),
    CAR(Words("Car", "Auto", "Voiture", "Coche")),
    WATCH(Words("Watch", "Uhr", "Montre", "Reloj")),
}

/** A Bluetooth device connected to the phone: its address, which is never sent, its name and its kind. */
data class BluetoothDevice(val address: String, val name: String, val kind: DeviceKind) {
    /** The id of its row, as den-watcher's Bluetooth add-on makes it: a checksum of the address. */
    val id: String
        get() = "device-%08x".format(CRC32().apply { update(address.uppercase().toByteArray()) }.value)
}

/**
 * Reads which Bluetooth devices are connected to the phone, such as
 * headphones, a watch or the car, from Android's Bluetooth profiles: the
 * audio ones, hearing aids and Bluetooth Low Energy. Android asks for the
 * Nearby devices permission for it from Android 12 on. Each profile is
 * opened once and kept, so a reading only asks what is connected, which
 * costs no battery.
 */
object Bluetooth {
    /** The profiles connected devices are read from: headset, audio, hearing aid and LE audio. */
    private val PROFILES = listOf(BluetoothProfile.HEADSET, BluetoothProfile.A2DP, HEARING_AID, LE_AUDIO)

    private val proxies = ConcurrentHashMap<Int, BluetoothProfile>()
    private val asked = ConcurrentHashMap.newKeySet<Int>()

    /** Whether the app may read the connected devices. */
    fun allowed(context: Context): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    /**
     * The connected devices, none while Bluetooth is off, or null when the
     * phone has no Bluetooth or the app may not read it. The profiles are
     * opened at the first reading, so it may tell fewer devices than are
     * connected.
     */
    @SuppressLint("MissingPermission")
    fun read(context: Context): List<BluetoothDevice>? {
        if (!allowed(context)) {
            return null
        }
        val manager = context.getSystemService(BluetoothManager::class.java) ?: return null
        val adapter = manager.adapter ?: return null
        if (!adapter.isEnabled) {
            return emptyList()
        }
        for (profile in PROFILES) {
            if (asked.add(profile)) {
                val listener = object : BluetoothProfile.ServiceListener {
                    override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                        proxies[profile] = proxy
                    }

                    override fun onServiceDisconnected(profile: Int) {
                        proxies.remove(profile)
                        asked.remove(profile)
                    }
                }
                if (runCatching { adapter.getProfileProxy(context.applicationContext, listener, profile) }.getOrDefault(false) != true) {
                    asked.remove(profile)
                }
            }
        }
        val devices = proxies.values.flatMap { proxy -> runCatching { proxy.connectedDevices }.getOrDefault(emptyList()) } +
            runCatching { manager.getConnectedDevices(BluetoothProfile.GATT) }.getOrDefault(emptyList())
        return devices.distinctBy { it.address }.map { device ->
            BluetoothDevice(
                address = device.address,
                name = runCatching { device.name }.getOrNull()?.trim().orEmpty(),
                kind = kind(runCatching { device.bluetoothClass?.deviceClass }.getOrNull()),
            )
        }
    }

    /** The kind of a device from its class of device, as Android tells it. */
    fun kind(deviceClass: Int?): DeviceKind {
        deviceClass ?: return DeviceKind.OTHER
        return when (deviceClass) {
            BluetoothClass.Device.AUDIO_VIDEO_CAR_AUDIO -> DeviceKind.CAR
            BluetoothClass.Device.AUDIO_VIDEO_HEADPHONES, BluetoothClass.Device.AUDIO_VIDEO_WEARABLE_HEADSET,
            BluetoothClass.Device.AUDIO_VIDEO_HANDSFREE,
            -> DeviceKind.HEADPHONES
            BluetoothClass.Device.AUDIO_VIDEO_LOUDSPEAKER, BluetoothClass.Device.AUDIO_VIDEO_PORTABLE_AUDIO -> DeviceKind.SPEAKER
            BluetoothClass.Device.WEARABLE_WRIST_WATCH -> DeviceKind.WATCH
            else -> when (deviceClass and MAJOR_MASK) {
                BluetoothClass.Device.Major.COMPUTER -> DeviceKind.COMPUTER
                BluetoothClass.Device.Major.PHONE -> DeviceKind.PHONE
                BluetoothClass.Device.Major.WEARABLE -> DeviceKind.WATCH
                BluetoothClass.Device.Major.PERIPHERAL -> peripheral(deviceClass)
                else -> DeviceKind.OTHER
            }
        }
    }

    /** A keyboard, mouse or game controller, from the minor class of a peripheral, as the Bluetooth add-on reads it. */
    private fun peripheral(deviceClass: Int): DeviceKind {
        val minor = deviceClass shr 2 and 0x3f
        return when {
            minor shr 4 == 1 || minor shr 4 == 3 -> DeviceKind.KEYBOARD
            minor shr 4 == 2 -> DeviceKind.MOUSE
            minor and 0xf == 1 || minor and 0xf == 2 -> DeviceKind.GAME_CONTROLLER
            else -> DeviceKind.OTHER
        }
    }

    /**
     * The devices as the extra Bluetooth, as den-watcher's Bluetooth add-on
     * tells it: how many are connected, with its history, and a row per
     * device with its kind, ordered by its name.
     */
    fun extra(devices: List<BluetoothDevice>?): Extra = Extra(
        id = GROUP,
        title = Words("Bluetooth", "Bluetooth", "Bluetooth", "Bluetooth"),
        description = Words(
            "The Bluetooth devices connected to the phone, such as headphones, a watch or the car, each with its kind.",
            "Die mit dem Handy verbundenen Bluetooth-Geräte, etwa Kopfhörer, eine Uhr oder das Auto, jeweils mit Geräteart.",
            "Les appareils Bluetooth connectés au téléphone, comme un casque, une montre ou la voiture, chacun avec son type.",
            "Los dispositivos Bluetooth conectados al teléfono, como auriculares, un reloj o el coche, cada uno con su tipo.",
        ),
        values = listOf(
            ExtraValue(
                "connected",
                Words("Connected devices", "Verbundene Geräte", "Appareils connectés", "Dispositivos conectados"),
                ExtraUnit.NUMBER,
                value = devices?.size?.toDouble(),
                history = true,
            ),
        ) + devices.orEmpty().map { device ->
            if (device.name.isEmpty()) {
                // Without a name, the kind names the device, and the row says only that it is connected.
                ExtraValue(device.id, device.kind.words, ExtraUnit.TEXT, text = Words("connected", "verbunden", "connecté", "conectado"))
            } else {
                ExtraValue(device.id, Words(device.name, device.name, device.name, device.name), ExtraUnit.TEXT, text = device.kind.words)
            }
        }.sortedWith(compareBy<ExtraValue> { it.label.en.lowercase() }.thenBy { it.id }),
    )

    /** How the values with a history are described, by the name the history keeps them under. */
    fun descriptions(): Map<String, org.json.JSONObject> = extra(null).descriptions()

    /** The group of the connected devices, the one den-watcher's Bluetooth add-on uses. */
    const val GROUP = "bluetooth"

    /** BluetoothProfile.HEARING_AID, from Android 10 on. */
    private const val HEARING_AID = 21

    /** BluetoothProfile.LE_AUDIO, from Android 13 on. */
    private const val LE_AUDIO = 22

    /** The bits of the major class in a class of device. */
    private const val MAJOR_MASK = 0x1F00
}
