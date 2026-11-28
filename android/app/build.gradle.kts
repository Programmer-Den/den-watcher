plugins {
    alias(libs.plugins.android.application)
}

// The release workflow passes the version of the tag and a version code made
// from it, which grows with every release, as Android needs for an update.
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

    // Two apps from the same code: the phone app, and the hub app, which is
    // the phone app plus a den-watcher hub running in its own process (src/hub).
    flavorDimensions += "app"
    productFlavors {
        create("phone") {
            dimension = "app"
        }
        create("hub") {
            dimension = "app"
            applicationIdSuffix = ".hub"
            // The hub library is built for arm64 only.
            ndk {
                abiFilters += "arm64-v8a"
            }
        }
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

    // The screenshot test draws the app's own layouts and strings.
    testOptions {
        unitTests.isIncludeAndroidResources = true
    }

    lint {
        warningsAsErrors = false
        abortOnError = true
    }
}

dependencies {
    // Scans the code on the hub's page that holds its address, with the
    // camera, without Google Play services.
    implementation(libs.zxing.embedded)
    // The den-watcher hub, built from backend/mobile with gomobile bind into
    // libs/ before Gradle runs, as the Android app workflow does.
    "hubImplementation"(files("libs/den-watcher-hub.aar"))
    testImplementation(libs.junit)
    // Android's own org.json is only a stub in unit tests.
    testImplementation(libs.json)
    // Draws the screen for the screenshots of a pull request.
    testImplementation(libs.robolectric)
}

// Screenshots are taken only when asked for, with -Pscreenshots=<folder>, as
// Robolectric first downloads a whole Android for them.
val screenshots = providers.gradleProperty("screenshots").orNull
// The hub app's own screenshots are HubScreenshots (src/testHub).
tasks.withType<Test>().configureEach {
    if (screenshots == null) {
        filter.excludeTestsMatching("den.watcher.Screenshots")
        filter.excludeTestsMatching("den.watcher.HubScreenshots")
    } else {
        filter.includeTestsMatching(if (name.contains("Hub")) "den.watcher.HubScreenshots" else "den.watcher.Screenshots")
        systemProperty("screenshots", file(screenshots).absolutePath)
    }
}
