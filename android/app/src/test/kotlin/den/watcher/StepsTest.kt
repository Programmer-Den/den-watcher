package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StepsTest {
    @Test
    fun addsTheStepsSinceTheReadingBefore() {
        val count = StepCount(day = 20_000, today = 1_200, counter = 50_000)
        assertEquals(StepCount(20_000, 1_450, 50_250), count.next(50_250, 20_000))
    }

    @Test
    fun startsANewDayWithTheStepsSinceTheReadingBefore() {
        val count = StepCount(day = 20_000, today = 9_800, counter = 50_000)
        assertEquals(StepCount(20_001, 30, 50_030), count.next(50_030, 20_001))
    }

    @Test
    fun startsAtZeroAfterADayOrMoreWithoutAReading() {
        val count = StepCount(day = 20_000, today = 9_800, counter = 50_000)
        assertEquals(StepCount(20_003, 0, 80_000), count.next(80_000, 20_003))
    }

    @Test
    fun startsAtZeroWhenTheClockWentBackADay() {
        val count = StepCount(day = 20_001, today = 300, counter = 50_000)
        assertEquals(StepCount(20_000, 0, 50_100), count.next(50_100, 20_000))
    }

    @Test
    fun countsTheStepsSinceARestart() {
        val count = StepCount(day = 20_000, today = 4_000, counter = 50_000)
        assertEquals(StepCount(20_000, 4_120, 120), count.next(120, 20_000))
    }

    @Test
    fun tellsTheStepsWithTheirHistoryWhileCollected() {
        val reading = Reading(1_000, 500, 0, null, false, null, 0, 0, 0, 0, emptyMap(), steps = 4_321)
        assertEquals(4_321.0, reading.values(emptyMap())["extra:steps/today"]!!, 0.0)
        assertEquals("Schritte", reading.extras().single().title.de)
        assertTrue(reading.limitedTo(DataChoice(steps = false)).extras().isEmpty())
        assertFalse(DataChoice(steps = false).keeps("extra:steps/today"))
        val info = Push.body(2_000, null, listOf(Minute(60, mapOf("extra:steps/today" to 10.0)))).getJSONObject("extras")
        assertEquals("Steps today", info.getJSONObject("extra:steps/today").getString("label"))
    }
}
