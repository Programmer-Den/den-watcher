package den.watcher

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingCodeTest {
    @Test
    fun generatesCodesOfTheHubsForm() {
        repeat(100) {
            val code = PairingCode.generate()
            assertTrue(code, PairingCode.isValid(code))
            assertTrue(code, code.none { it in "01IO" })
        }
    }

    @Test
    fun refusesCodesOfAnotherForm() {
        assertFalse(PairingCode.isValid("7KQM-X2R"))
        assertFalse(PairingCode.isValid("7KQMX2R0"))
        assertFalse(PairingCode.isValid("7kqmx2rp"))
        assertFalse(PairingCode.isValid(""))
    }

    @Test
    fun formatsInTwoGroups() {
        assertEquals("7KQM-X2RP", PairingCode.format("7KQMX2RP"))
    }
}
