plugins {
    alias(libs.plugins.android.application) apply false
    // Android's plugin builds the Kotlin itself; this only picks the
    // version of Kotlin it uses, so Dependabot can keep it current.
    alias(libs.plugins.kotlin.android) apply false
}
