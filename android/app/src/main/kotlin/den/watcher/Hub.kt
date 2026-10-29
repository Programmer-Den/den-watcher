package den.watcher

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Sends the phone's usage to the hub. */
object Hub {
    private const val TIMEOUT_MILLIS = 10_000

    /** The longest answer read; the hub's is a few hundred bytes. */
    private const val MAX_ANSWER_BYTES = 64 * 1024

    /**
     * The hub's answer to a push: the phone's time of the newest minute it
     * has, for how many more seconds the phone may change its hub or stop
     * recording (0 when it may not) with the hub's proof of that, the
     * phone's key when the push asked for it, and the phone's time of the
     * newest scan of the networks nearby it has (0 for a hub that takes
     * none).
     */
    sealed interface Answer {
        data class Taken(
            val after: Long,
            val releaseSeconds: Long = 0,
            val releaseProof: String = "",
            val key: String = "",
            val wifiAfter: Long = 0,
        ) : Answer
        data class Failed(val problem: Problem) : Answer
    }

    fun push(url: String, code: String, body: JSONObject): Answer {
        val connection = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (_: IOException) {
            return Answer.Failed(Problem.NO_ADDRESS)
        }
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = TIMEOUT_MILLIS
            connection.readTimeout = TIMEOUT_MILLIS
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty(Push.CODE_HEADER, code)
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            when (connection.responseCode) {
                HttpURLConnection.HTTP_OK -> {
                    val answer = connection.inputStream.use { readAtMost(it, MAX_ANSWER_BYTES) }.toString(Charsets.UTF_8)
                    val json = JSONObject(answer)
                    Answer.Taken(
                        json.getLong("after"),
                        if (json.optBoolean("release")) json.optLong("releaseSeconds") else 0,
                        json.optString("releaseProof"),
                        json.optString("key"),
                        json.optLong("wifiAfter"),
                    )
                }
                HttpURLConnection.HTTP_FORBIDDEN -> Answer.Failed(Problem.NOT_ADDED)
                else -> Answer.Failed(Problem.REFUSED)
            }
        } catch (_: IOException) {
            Answer.Failed(Problem.UNREACHABLE)
        } catch (_: org.json.JSONException) {
            Answer.Failed(Problem.REFUSED)
        } finally {
            connection.disconnect()
        }
    }

    /** The bytes of input, or an IOException when it holds more than limit. */
    private fun readAtMost(input: java.io.InputStream, limit: Int): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8 * 1024)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) {
                return out.toByteArray()
            }
            if (out.size() + read > limit) {
                throw IOException("the answer is longer than $limit bytes")
            }
            out.write(buffer, 0, read)
        }
    }
}
