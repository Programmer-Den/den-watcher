package den.watcher

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Checks that the hub the phone was set up with allows a change: it proves
 * it with the phone's key, which only it and the app know, for the very
 * push it answers, so neither another server at the hub's address nor an
 * answer to an earlier push unlocks the app.
 */
object Release {
    /** The longest a change is allowed for, as long as the hub allows it after its owner's click. */
    const val MAX_SECONDS = 10 * 60L

    /** Whether key is a key as the hub gives it: 32 bytes in hex. */
    fun isKey(key: String): Boolean = key.length == 64 && key.all { it in '0'..'9' || it in 'a'..'f' }

    /**
     * Whether proof is the hub's proof, with the phone's key in hex, that
     * the push sent at now, on the phone's clock, may change its hub for
     * the seconds. Without a key nothing is proven.
     */
    fun proves(key: String, now: Long, seconds: Long, proof: String): Boolean {
        if (!isKey(key)) {
            return false
        }
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(hex(key), "HmacSHA256"))
        val expected = mac.doFinal("den-watcher release $now $seconds".toByteArray(Charsets.UTF_8))
        return java.security.MessageDigest.isEqual(expected, runCatching { hex(proof) }.getOrNull() ?: return false)
    }

    private fun hex(text: String): ByteArray {
        require(text.length % 2 == 0)
        return ByteArray(text.length / 2) { text.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }
}
