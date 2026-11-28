package den.watcher

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.SocketException

/** This device's place on the network it is connected to, from Android. */
object LanAddress {
    private fun link(context: Context): LinkProperties? {
        val manager = context.getSystemService(ConnectivityManager::class.java) ?: return null
        return manager.getLinkProperties(manager.activeNetwork)
    }

    /** The device's IPv4 address on that network, such as 192.168.1.20, or null. */
    fun ipv4(context: Context): String? = lookup(context)

    /** Reads ipv4; the screenshots put a made-up address in its place. */
    internal var lookup: (Context) -> String? = { context ->
        link(context)?.linkAddresses
            ?.map { it.address }
            ?.firstOrNull { it is Inet4Address && !it.isLoopbackAddress }
            ?.hostAddress
    }

    /** The network's DNS servers, comma-separated, as backend/mobile takes them, or empty. */
    fun dnsServers(context: Context): String =
        link(context)?.dnsServers.orEmpty()
            .mapNotNull { it.hostAddress?.substringBefore('%') }
            .joinToString(",")

    /**
     * Every address of this device with the length of its subnet, such as
     * 192.168.1.20/24, comma-separated, as backend/mobile takes them, or
     * empty. Android 11 and later do not let the hub list them itself, so it
     * could not tell its own addresses from a device's. They are those of
     * all its network interfaces, or, where Java is not told them, those
     * of the network it is connected to.
     */
    fun addresses(context: Context): String {
        val interfaces = try {
            NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
                .flatMap { it.interfaceAddresses }
                .mapNotNull { withSubnet(it.address, it.networkPrefixLength.toInt()) }
        } catch (_: SocketException) {
            emptyList()
        }
        return interfaces
            .ifEmpty { link(context)?.linkAddresses.orEmpty().mapNotNull { withSubnet(it.address, it.prefixLength) } }
            .joinToString(",")
    }

    /** An address as addresses lists it, without the interface an IPv6 address names; null for a subnet it cannot have. */
    internal fun withSubnet(address: InetAddress?, length: Int): String? {
        val host = address?.hostAddress?.substringBefore('%') ?: return null
        val bits = if (address is Inet4Address) 32 else 128
        return if (length in 0..bits) "$host/$length" else null
    }
}
