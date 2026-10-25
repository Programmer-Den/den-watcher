package den.watcher

import android.content.Context
import android.net.ConnectivityManager
import java.net.Inet4Address

/**
 * Tells networks apart without the location permission, which Android asks
 * for the Wi-Fi's name: by the IPv4 range the phone has on it and the router
 * it goes out through, such as "192.168.1.0/24 via 192.168.1.1". A hub
 * reached on a network with another one may be a stranger's device at the
 * same address, as in a café or at work.
 */
object Networks {
    /** The network the phone is on now, or null when it has no IPv4 address. */
    fun current(context: Context): String? {
        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val link = connectivity.getLinkProperties(connectivity.activeNetwork) ?: return null
        val addresses = link.linkAddresses
            .filter { it.address is Inet4Address }
            .map { "${it.address.hostAddress}/${it.prefixLength}" }
        val gateways = link.routes
            .filter { it.isDefaultRoute && it.gateway is Inet4Address }
            .mapNotNull { it.gateway?.hostAddress }
        return id(addresses, gateways)
    }

    /**
     * The network's name from the phone's IPv4 addresses with their prefix
     * length, such as 192.168.1.20/24, and its gateways: the range of the
     * first address and the first gateway. Null without an address.
     */
    fun id(addresses: List<String>, gateways: List<String>): String? {
        val range = addresses.firstNotNullOfOrNull { range(it) } ?: return null
        val gateway = gateways.firstOrNull() ?: return range
        return "$range via $gateway"
    }

    /** 192.168.1.0/24 for 192.168.1.20/24, or null for anything else. */
    private fun range(address: String): String? {
        val (ip, length) = address.split('/').takeIf { it.size == 2 } ?: return null
        val bits = length.toIntOrNull()?.takeIf { it in 0..32 } ?: return null
        val parts = ip.split('.').map { it.toIntOrNull() ?: return null }
        if (parts.size != 4 || parts.any { it !in 0..255 }) {
            return null
        }
        val value = parts.fold(0L) { acc, part -> acc shl 8 or part.toLong() }
        val mask = if (bits == 0) 0L else (0xFFFFFFFFL shl (32 - bits)) and 0xFFFFFFFFL
        val network = value and mask
        return (3 downTo 0).joinToString(".") { ((network shr (it * 8)) and 0xFF).toString() } + "/$bits"
    }
}
