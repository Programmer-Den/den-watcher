package den.watcher

import android.content.Context

/**
 * The app's version, as the release workflow built it ("1.2.3"), or "dev"
 * for a build that did not set one.
 */
fun appVersion(context: Context): String =
    runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull() ?: "dev"
