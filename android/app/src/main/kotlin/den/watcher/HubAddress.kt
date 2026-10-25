package den.watcher

import java.net.URI
import java.net.URISyntaxException

/** The hub's address as it was typed in the app. */
object HubAddress {
    /** The port den-watcher listens on unless it was set up otherwise. */
    const val DEFAULT_PORT = 9393

    /** Where a phone sends its usage on the hub. */
    const val PUSH_PATH = "/api/phone/minutes"

    /**
     * Returns the URL the app pushes to for a typed address: a name or IP
     * address with a port, 9393 when left out, and http:// before it or not.
     * Returns null for anything else, such as an https:// address, which
     * den-watcher does not offer, or one with a path.
     */
    fun pushUrl(typed: String): String? {
        var address = typed.trim().trimEnd('/')
        if (address.startsWith("http://", ignoreCase = true)) {
            address = address.substring("http://".length)
        }
        if (address.isEmpty() || address.any { it.isWhitespace() || it in "/?#@" }) {
            return null
        }
        val uri = try {
            URI("http://$address")
        } catch (_: URISyntaxException) {
            return null
        }
        val host = uri.host ?: return null
        val port = if (uri.port == -1) DEFAULT_PORT else uri.port
        if (port !in 1..65535) {
            return null
        }
        return "http://$host:$port$PUSH_PATH"
    }
}
