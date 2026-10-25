package den.watcher

import java.net.URI
import java.net.URISyntaxException

/** The hub's address, as scanned from the code on the hub's page. */
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

    /**
     * Returns the address in a code scanned from the hub's page, which holds
     * the page's address, such as http://192.168.1.20:9393/, as the app keeps
     * it: 192.168.1.20:9393. Returns null for a code that holds no such
     * address, such as one of a shop's web page.
     */
    fun fromCode(code: String): String? {
        val text = code.trim()
        if (!text.startsWith("http://", ignoreCase = true)) {
            return null
        }
        return pushUrl(text)?.removePrefix("http://")?.removeSuffix(PUSH_PATH)
    }
}
