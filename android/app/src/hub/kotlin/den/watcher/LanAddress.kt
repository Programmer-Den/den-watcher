package den.watcher

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import java.net.Inet4Address

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
}
