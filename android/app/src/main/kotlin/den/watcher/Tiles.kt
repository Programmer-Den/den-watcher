package den.watcher

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Loads the OpenStreetMap tiles of the app's map, two at a time, and keeps
 * them in memory and for a week in the app's cache folder, as OpenStreetMap's
 * tile policy asks: a map looked at again loads nothing. A tile that does not
 * load, as without internet, is left out until the map is opened again, and
 * the map shows its plain background there. Calls loaded on the main thread
 * when a tile came in.
 */
class Tiles(context: Context, private val loaded: () -> Unit) {
    private val folder = File(context.cacheDir, "tiles")
    private val userAgent = "Den-Watcher-Android/${appVersion(context)} (+https://github.com/Programmer-Den/den-watcher)"
    private val memory = LruCache<String, Bitmap>(MEMORY_TILES)
    private val loading = mutableSetOf<String>()
    private val failed = mutableSetOf<String>()
    private val main = Handler(Looper.getMainLooper())
    private val executor: ExecutorService = Executors.newFixedThreadPool(2)

    init {
        // The tiles older than a week are of no use any more.
        executor.execute {
            val old = System.currentTimeMillis() - MAX_AGE_MILLIS
            folder.listFiles()?.filter { it.lastModified() < old }?.forEach { it.delete() }
        }
    }

    /** The tile's image, or null while it loads or when it did not; on the main thread. */
    fun get(tile: MapTile): Bitmap? {
        val key = "${tile.zoom}-${tile.x}-${tile.y}"
        memory.get(key)?.let { return it }
        if (key in loading || key in failed || executor.isShutdown) {
            return null
        }
        loading += key
        executor.execute {
            val bitmap = load(key, tile.url)
            main.post {
                loading -= key
                if (bitmap == null) failed += key else memory.put(key, bitmap)
                loaded()
            }
        }
        return null
    }

    /** Stops loading, as when the map is closed. */
    fun close() {
        executor.shutdownNow()
    }

    private fun load(key: String, url: String): Bitmap? {
        val file = File(folder, "$key.png")
        if (file.exists() && file.lastModified() >= System.currentTimeMillis() - MAX_AGE_MILLIS) {
            BitmapFactory.decodeFile(file.path)?.let { return it }
        }
        val bytes = download(url) ?: return if (file.exists()) BitmapFactory.decodeFile(file.path) else null
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
        runCatching {
            folder.mkdirs()
            file.writeBytes(bytes)
        }
        return bitmap
    }

    private fun download(url: String): ByteArray? {
        val connection = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (_: IOException) {
            return null
        }
        return try {
            connection.connectTimeout = TIMEOUT_MILLIS
            connection.readTimeout = TIMEOUT_MILLIS
            connection.setRequestProperty("User-Agent", userAgent)
            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                return null
            }
            connection.inputStream.use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(16 * 1024)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    if (out.size() + read > MAX_TILE_BYTES) return null
                    out.write(buffer, 0, read)
                }
                out.toByteArray()
            }
        } catch (_: IOException) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        const val TIMEOUT_MILLIS = 10_000

        /** How long a tile is kept in the cache folder. */
        const val MAX_AGE_MILLIS = 7 * 24 * 60 * 60_000L

        /** How many tiles are kept in memory: a few maps' worth. */
        const val MEMORY_TILES = 48

        /** The largest tile read; OpenStreetMap's are a few dozen kilobytes. */
        const val MAX_TILE_BYTES = 512 * 1024
    }
}
