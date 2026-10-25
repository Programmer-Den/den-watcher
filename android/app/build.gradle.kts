plugins {
    alias(libs.plugins.android.application)
}

// The release workflow passes the version of the tag and the number of the
// run, which grows with every build, as Android needs for an update.
val appVersion = providers.gradleProperty("appVersion").getOrElse("dev")
val appVersionCode = providers.gradleProperty("appVersionCode").getOrElse("1").toInt()

// A release is signed with the key from the repository's secrets; without
// them, as on a pull request, the build is signed with the debug key.
val keystore = providers.environmentVariable("ANDROID_KEYSTORE_FILE").orNull

android {
    namespace = "den.watcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "den.watcher"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersion
    }

    signingConfigs {
        if (keystore != null) {
            create("release") {
                storeFile = file(keystore)
                storePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD").get()
                keyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS").get()
                keyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD").get()
            }
        }
    }

    // Unit tests run for the tested build type only; the workflow tests the
    // release, as it ships.
    testBuildType = "release"

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        warningsAsErrors = false
        abortOnError = true
    }
}

dependencies {
    testImplementation(libs.junit)
    // Android's own org.json is only a stub in unit tests.
    testImplementation(libs.json)
}
