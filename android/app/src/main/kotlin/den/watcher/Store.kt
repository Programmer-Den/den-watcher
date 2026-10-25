package den.watcher

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Keeps the values of every reading until the hub has them, one row per
 * value, as a data-only device keeps its minutes for the hub. Readings older
 * than KEEP_SECONDS are deleted, so a phone that does not reach the hub for a
 * long time does not fill up.
 */
class Store(context: Context) : SQLiteOpenHelper(context, "readings.db", null, 1) {
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
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

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
            db.delete("readings", "time < ?", arrayOf((time - KEEP_SECONDS).toString()))
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
        /** How long readings the hub does not have yet are kept: a week. */
        const val KEEP_SECONDS = 7 * 24 * 60 * 60L

        fun minuteOf(time: Long): Long = Math.floorDiv(time, 60L) * 60
    }
}
