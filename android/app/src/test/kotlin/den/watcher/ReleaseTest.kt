package den.watcher

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReleaseTest {
    // The same key and proof as in the hub's TestReleaseProofMatchesTheApp.
    private val key = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
    private val proof = "8631e5128a994884b4c4b87819685519a205cbe96828ac878a5662eb799b1660"

    @Test
    fun takesTheHubsProof() {
        assertTrue(Release.proves(key, 1_700_000_000, 600, proof))
    }

    @Test
    fun refusesAProofOfAnotherPushTimeOrKey() {
        assertFalse(Release.proves(key, 1_700_000_001, 600, proof))
        assertFalse(Release.proves(key, 1_700_000_000, 601, proof))
        assertFalse(Release.proves(key.replaceFirst('0', '1'), 1_700_000_000, 600, proof))
        assertFalse(Release.proves(key, 1_700_000_000, 600, "zz" + proof.drop(2)))
        assertFalse(Release.proves(key, 1_700_000_000, 600, ""))
    }

    @Test
    fun provesNothingWithoutAKey() {
        assertFalse(Release.proves("", 1_700_000_000, 600, proof))
        assertFalse(Release.isKey(key.uppercase()))
        assertTrue(Release.isKey(key))
    }
}
