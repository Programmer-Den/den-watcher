package den.watcher

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Sends the phone's usage to the hub. */
object Hub {
    private const val TIMEOUT_MILLIS = 10_000

    /** The hub's answer to a push: the phone's time of the newest minute it has. */
    sealed interface Answer {
        data class Taken(val after: Long) : Answer
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
                    val answer = connection.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
                    Answer.Taken(JSONObject(answer).getLong("after"))
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
}
