package den.watcher

import org.json.JSONArray
import org.json.JSONObject

/**
 * A text in English and in the languages den-watcher's page has, as an
 * extra tells them to the hub: the page shows the one of its own language,
 * whatever language the phone is set to.
 */
data class Words(val en: String, val de: String, val fr: String, val es: String) {
    /** The texts in the other languages, by language code, as den-watcher names them. */
    fun others(): JSONObject = JSONObject().put("de", de).put("fr", fr).put("es", es)
}

/** How a value of an extra is shown, as den-watcher names its units. */
enum class ExtraUnit(val json: String) {
    PERCENT("percent"),
    CELSIUS("celsius"),
    BYTES("bytes"),
    WATTS("watts"),
    NUMBER("number"),
    TEXT("text"),
}

/**
 * One value of an extra: a number, or for the unit TEXT a text. With
 * history, the hub keeps its history and draws it as a chart, from the
 * minutes the app keeps of it.
 */
data class ExtraValue(
    val id: String,
    val label: Words,
    val unit: ExtraUnit,
    val value: Double? = null,
    val text: Words? = null,
    val history: Boolean = false,
) {
    fun json(): JSONObject = JSONObject().apply {
        put("id", id)
        put("label", label.en)
        put("labels", label.others())
        put("unit", unit.json)
        value?.let { put("value", it) }
        text?.let {
            put("text", it.en)
            put("texts", it.others())
        }
        if (history) put("history", true)
    }
}

/**
 * A group of values beyond the fields every device tells, shown on the
 * hub's page as a card of its own: den-watcher's extras, which a hub shows
 * without knowing them, so the app can tell more than an older hub knows of.
 */
data class Extra(val id: String, val title: Words, val description: Words, val values: List<ExtraValue>) {
    fun json(): JSONObject = JSONObject().apply {
        put("id", id)
        put("title", title.en)
        put("titles", title.others())
        put("description", description.en)
        put("descriptions", description.others())
        put("items", JSONArray().apply { values.forEach { put(it.json()) } })
    }

    /** The name the history keeps a value of the group under, as den-watcher names it. */
    fun metric(value: String): String = "extra:$id/$value"

    /** The values with a history, by the name the history keeps them under. */
    fun historyValues(): Map<String, Double> =
        values.filter { it.history && it.value != null }.associate { metric(it.id) to it.value!! }

    /**
     * How each value with a history is described, by the name the history
     * keeps it under, as the hub takes it with the minutes: so it can draw
     * the chart of minutes sent while the phone was away.
     */
    fun descriptions(): Map<String, JSONObject> = values.filter { it.history }.associate {
        metric(it.id) to JSONObject()
            .put("title", title.en)
            .put("titles", title.others())
            .put("label", it.label.en)
            .put("labels", it.label.others())
            .put("unit", it.unit.json)
    }
}
