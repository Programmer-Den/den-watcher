package den.watcher

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

/**
 * Keeps the values of every reading until the hub has them, one row per
 * value, as a data-only device keeps its minutes for the hub, the scans
 * of the Wi-Fi networks nearby, the Wi-Fi networks the phone was connected
 * to, and the uses of apps and unlocks, which
 * Android keeps in its own log only for a few days. Only the newest KEEP scans and about the
 * newest KEEP readings are kept, so a phone that does not reach the hub for a
 * long time does not fill up. They are counted rather than dated: a clock set far ahead for a moment
 * would make every reading before it look too old to keep.
 */
class Store(context: Context) : SQLiteOpenHelper(context, "readings.db", null, 4) {
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
        createUses(db)
        createConnections(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            createScans(db)
        }
        if (oldVersion < 3) {
            createUses(db)
        }
        if (oldVersion < 4) {
            createConnections(db)
        }
    }

    private fun createConnections(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE connections (
                id    INTEGER PRIMARY KEY AUTOINCREMENT, -- the number the hub answers up to
                ssid  TEXT    NOT NULL, -- the Wi-Fi's name
                start INTEGER NOT NULL, -- Unix milliseconds on the phone's clock
                ended INTEGER NOT NULL, -- the last reading that found the phone on it
                open  INTEGER NOT NULL, -- 1 while it goes on, at most one
                sent  INTEGER NOT NULL DEFAULT 0 -- the end the hub last took of an open one
            )
            """.trimIndent(),
        )
    }

    /** The connection still open and its number, or null when there is none. */
    private fun openConnection(db: SQLiteDatabase): Pair<Long, Connection>? =
        db.rawQuery("SELECT id, ssid, start, ended FROM connections WHERE open = 1 ORDER BY id DESC LIMIT 1", null).use { rows ->
            if (rows.moveToNext()) rows.getLong(0) to Connection(rows.getString(1), rows.getLong(2), rows.getLong(3)) else null
        }

    /**
     * Keeps that a reading at now found the phone on the Wi-Fi ssid, or on
     * none for null, as WifiLog.follow tells, and deletes the oldest
     * connections beyond KEEP_CONNECTIONS.
     */
    fun addConnection(ssid: String?, now: Long) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val open = openConnection(db)
            val followed = WifiLog.follow(open?.second, ssid, now)
            if (open != null) {
                val row = ContentValues().apply {
                    if (followed.closed) put("open", 0) else put("ended", followed.open?.end ?: open.second.end)
                }
                db.update("connections", row, "id = ?", arrayOf(open.first.toString()))
            }
            val started = followed.open
            if (started != null && (open == null || followed.closed)) {
                val row = ContentValues().apply {
                    put("ssid", started.ssid)
                    put("start", started.start)
                    put("ended", started.end)
                    put("open", 1)
                }
                db.insert("connections", null, row)
            }
            db.delete("connections", "id <= (SELECT MAX(id) FROM connections) - ?", arrayOf(KEEP_CONNECTIONS.toString()))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    /**
     * The oldest connections the hub does not have yet, at most
     * Push.MAX_CONNECTIONS, in JSON: every one that is over, and the open one
     * when it was not sent yet or went on for WifiLog.RESEND_MILLIS since,
     * or the clock went back.
     */
    fun connections(): List<JSONObject> {
        val connections = mutableListOf<JSONObject>()
        readableDatabase.rawQuery(
            // A number in the text, as one passed as an argument would be compared as text.
            "SELECT id, ssid, start, ended, open FROM connections " +
                "WHERE open = 0 OR ended - sent >= ${WifiLog.RESEND_MILLIS} OR sent > ended ORDER BY id LIMIT ?",
            arrayOf(Push.MAX_CONNECTIONS.toString()),
        ).use { rows ->
            while (rows.moveToNext()) {
                connections += Connection(rows.getString(1), rows.getLong(2), rows.getLong(3)).json(rows.getLong(0), rows.getInt(4) == 1)
            }
        }
        return connections
    }

    /**
     * Deletes the connections that are over with the number after and the
     * ones before, which the hub has, and keeps the end it has of the open
     * one, so that is sent again only once it went on.
     */
    fun connectionsTaken(after: Long) {
        val db = writableDatabase
        db.delete("connections", "id <= ? AND open = 0", arrayOf(after.toString()))
        db.execSQL("UPDATE connections SET sent = ended WHERE id <= ? AND open = 1", arrayOf<Any?>(after))
    }

    /** Deletes every connection kept, as when they are no longer collected. */
    fun deleteConnections() {
        writableDatabase.delete("connections", null, null)
    }

    private fun createUses(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE uses (
                id     INTEGER PRIMARY KEY AUTOINCREMENT, -- the number the hub answers up to
                app    TEXT    NOT NULL, -- the app's package name; empty for an unlock
                label  TEXT    NOT NULL, -- the app's name as the phone shows it
                start  INTEGER NOT NULL, -- Unix milliseconds on the phone's clock
                millis INTEGER NOT NULL, -- how long it was in use; 0 for an unlock
                UNIQUE (app, start)
            )
            """.trimIndent(),
        )
    }

    /**
     * Keeps the uses of apps and the unlocks read from Android's log, once
     * each, also when one is read again, and deletes the oldest beyond
     * KEEP_USES.
     */
    fun addUses(uses: List<AppUse>) {
        if (uses.isEmpty()) {
            return
        }
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (use in uses) {
                val row = ContentValues().apply {
                    put("app", use.app)
                    put("label", use.label)
                    put("start", use.start)
                    put("millis", use.millis)
                }
                db.insertWithOnConflict("uses", null, row, SQLiteDatabase.CONFLICT_IGNORE)
            }
            db.delete("uses", "id <= (SELECT MAX(id) FROM uses) - ?", arrayOf(KEEP_USES.toString()))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    /** The oldest uses the hub does not have yet, at most Push.MAX_USES, in JSON. */
    fun uses(): List<JSONObject> {
        val uses = mutableListOf<JSONObject>()
        readableDatabase.rawQuery(
            "SELECT id, app, label, start, millis FROM uses ORDER BY id LIMIT ?",
            arrayOf(Push.MAX_USES.toString()),
        ).use { rows ->
            while (rows.moveToNext()) {
                uses += AppUse(rows.getString(1), rows.getLong(3), rows.getLong(4), rows.getString(2)).json(rows.getLong(0))
            }
        }
        return uses
    }

    /** Deletes the use with the number after and the ones before, which the hub has. */
    fun deleteUsesUpTo(after: Long) {
        writableDatabase.delete("uses", "id <= ?", arrayOf(after.toString()))
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
            // Finding the cut-off walks every reading kept, so it is looked
            // for only every PRUNE_EVERY readings, and at the first one after
            // the app started: a phone away from the hub keeps a little more
            // than KEEP for a while.
            if (added++ % PRUNE_EVERY == 0) {
                db.delete(
                    "readings",
                    "time < (SELECT DISTINCT time FROM readings ORDER BY time DESC LIMIT 1 OFFSET ?)",
                    arrayOf((KEEP - 1).toString()),
                )
            }
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

        /**
         * How many uses of apps and unlocks the hub does not have yet are
         * kept: far more than a week of them.
         */
        const val KEEP_USES = 50_000

        /**
         * How many connections to a Wi-Fi the hub does not have yet are
         * kept: far more than a week of them.
         */
        const val KEEP_CONNECTIONS = 10_000

        /** How many readings are added between two looks for the ones too old to keep: an hour's. */
        const val PRUNE_EVERY = 120

        /** How many readings were added since the app started. */
        private var added = 0

        fun minuteOf(time: Long): Long = Math.floorDiv(time, 60L) * 60
    }
}
