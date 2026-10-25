package den.watcher

import java.security.SecureRandom

/**
 * The pairing code the app shows, which the hub is given when the phone is
 * added and which the app sends with every push. It is made once at random,
 * as a device makes its own: 8 characters of digits and capital letters
 * without 0, 1, I and O.
 */
object PairingCode {
    const val ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    const val LENGTH = 8

    fun generate(random: SecureRandom = SecureRandom()): String =
        String(CharArray(LENGTH) { ALPHABET[random.nextInt(ALPHABET.length)] })

    /** Whether a code kept from before has the form of one. */
    fun isValid(code: String): Boolean = code.length == LENGTH && code.all { it in ALPHABET }

    /** The code as the app and the hub's page show it: two groups of four, such as 7KQM-X2RP. */
    fun format(code: String): String = code.take(LENGTH / 2) + "-" + code.drop(LENGTH / 2)
}
