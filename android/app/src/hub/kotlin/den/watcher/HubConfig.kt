package den.watcher

/** How the hub app sets up the den-watcher hub it runs, without Android, so it can be tested. */
object HubConfig {
    /** The port the hub listens on, as everywhere else. */
    const val PORT = HubAddress.DEFAULT_PORT

    /** The address the app's own recording sends to: the hub next to it. */
    const val LOCAL_ADDRESS = "127.0.0.1:$PORT"

    /** The longest name the hub takes for a device. */
    private const val MAX_NAME_LENGTH = 64

    /**
     * The IDs a phone must not have: the hub's own device's, which the hub
     * refuses, and that of its name, Host Hub, which would show two devices
     * by one name.
     */
    private val RESERVED = setOf("local", "host-hub")

    /**
     * The hub's settings, one NAME=value per line, as backend/mobile takes
     * them: its database in the app's own folder, the disk usage of the
     * folder's storage, and with ownPhone (name=pairing code) the phone part
     * of this device, which the hub pairs at every start. The daily check for
     * a newer release stays on.
     */
    fun settings(databasePath: String, diskPath: String, ownPhone: String?): String =
        listOfNotNull(
            "LISTEN_ADDR=:$PORT",
            "DATABASE_PATH=$databasePath",
            "DISK_PATHS=$diskPath",
            ownPhone?.let { "HUB_OWN_PHONE=$it" },
        ).joinToString("\n")

    /**
     * The name of this device's phone part on the hub's page: the device's
     * name, or its model when it has none, without the characters the
     * setting cannot hold and not the hub's own name.
     */
    fun phoneName(deviceName: String?, model: String): String {
        val name = (deviceName?.takeIf { it.isNotBlank() } ?: model)
            .filter { it != '=' && it != ',' && !it.isISOControl() }
            .trim()
            .take(MAX_NAME_LENGTH)
            .trim()
        val id = name.lowercase().replace(Regex("[^\\p{L}\\p{N}]+"), "-").trim('-')
        return if (id.isEmpty() || id in RESERVED) "Hub phone" else name
    }

    /** The hub's page at an address of this device, such as 192.168.1.20, or null without one. */
    fun pageUrl(ip: String?): String? = ip?.let { "http://${if (':' in it) "[$it]" else it}:$PORT/" }
}
