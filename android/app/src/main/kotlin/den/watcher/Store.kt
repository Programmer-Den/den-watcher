package den.watcher

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/**
 * Keeps the values of every reading until the hub has them, one row per
 * value, as a data-only device keeps its minutes for the hub, and the scans
 * of the Wi-Fi networks nearby. Only the newest KEEP readings and scans are
 * kept, so a phone that does not reach the hub for a long time does not fill
 * up. They are counted rather than dated: a clock set far ahead for a moment
 * would make every reading before it look too old to keep.
 */
class Store(context: Context) : SQLiteOpenHelper(context, "readings.db", null, 2) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE readings (
                time   INTEGER NOT NULL, -- Unix seconds on the phone's clock
                metric TEXT    NOT NULL,
                value  REAL    NOT NULL,
                PRIMARY KEY (time, metric)
            ) WITHOUT ROWID
            """.trimIndent(),
        )
        createScans(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            createScans(db)
        }
    }

    private fun createScans(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE scans (
                time  INTEGER PRIMARY KEY, -- Unix seconds on the phone's clock
                scan  TEXT    NOT NULL     -- the scan as the hub takes it, in JSON
            )
            """.trimIndent(),
        )
    }

    /** Keeps a scan of the networks nearby, and deletes the ones too old to keep. */
    fun addScan(scan: Scan) {
        val db = writableDatabase
        val row = ContentValues().apply {
            put("time", scan.time)
            put("scan", scan.json().toString())
        }
        db.insertWithOnConflict("scans", null, row, SQLiteDatabase.CONFLICT_REPLACE)
        db.delete("scans", "time < (SELECT time FROM scans ORDER BY time DESC LIMIT 1 OFFSET ?)", arrayOf((KEEP - 1).toString()))
    }

    /** The oldest scans the hub does not have yet, at most Push.MAX_SCANS, in JSON. */
    fun scans(): List<JSONObject> {
        val scans = mutableListOf<JSONObject>()
        readableDatabase.rawQuery("SELECT scan FROM scans ORDER BY time LIMIT ?", arrayOf(Push.MAX_SCANS.toString())).use { rows ->
            while (rows.moveToNext()) {
                runCatching { JSONObject(rows.getString(0)) }.getOrNull()?.let { scans += it }
            }
        }
        return scans
    }

    /** Deletes the scan at after and the ones before, which the hub has. */
    fun deleteScansUpTo(after: Long) {
        writableDatabase.delete("scans", "time <= ?", arrayOf(after.toString()))
    }

    /** Keeps the values of a reading taken at time, and deletes the ones too old to keep. */
    fun add(time: Long, values: Map<String, Double>) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            for ((metric, value) in values) {
                val row = ContentValues().apply {
                    put("time", time)
                    put("metric", metric)
                    put("value", value)
                }
                db.insertWithOnConflict("readings", null, row, SQLiteDatabase.CONFLICT_REPLACE)
            }
            db.delete(
                "readings",
                "time < (SELECT DISTINCT time FROM readings ORDER BY time DESC LIMIT 1 OFFSET ?)",
                arrayOf((KEEP - 1).toString()),
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    /**
     * The averages of the whole minutes before the minute of now, oldest
     * first, at most Push.MAX_MINUTES of them; the minute that is still going
     * on is sent once it is over.
     */
    fun minutes(now: Long): List<Minute> {
        val minutes = sortedMapOf<Long, MutableMap<String, Double>>()
        readableDatabase.rawQuery(
            """
            SELECT minute, metric, AVG(value) FROM (
                SELECT time / 60 * 60 AS minute, metric, value FROM readings
                WHERE time < ? AND time / 60 * 60 IN (
                    SELECT DISTINCT time / 60 * 60 FROM readings WHERE time < ? ORDER BY 1 LIMIT ?
                )
            ) GROUP BY minute, metric
            """.trimIndent(),
            arrayOf(minuteOf(now).toString(), minuteOf(now).toString(), Push.MAX_MINUTES.toString()),
        ).use { rows ->
            while (rows.moveToNext()) {
                minutes.getOrPut(rows.getLong(0)) { mutableMapOf() }[rows.getString(1)] = rows.getDouble(2)
            }
        }
        return minutes.map { (time, values) -> Minute(time, values) }
    }

    /** Deletes the readings of the minute starting at after and of the ones before, which the hub has. */
    fun deleteUpTo(after: Long) {
        writableDatabase.delete("readings", "time < ?", arrayOf((minuteOf(after) + 60).toString()))
    }

    companion object {
        /** How many readings and scans the hub does not have yet are kept: a week of one every half minute. */
        const val KEEP = 7 * 24 * 60 * 2

        fun minuteOf(time: Long): Long = Math.floorDiv(time, 60L) * 60
    }
}
