# Development

How the code is laid out, how to run it while working on it, and the checks a pull request has to pass. The rules for contributions are in [AGENTS.md](../AGENTS.md).

## Layout

| Part | Folder | Toolchain |
| --- | --- | --- |
| Backend and API | `backend/` | Go (version in `backend/go.mod`) |
| Website | `frontend/` | Angular, Node.js LTS (version in `frontend/.nvmrc`) |
| Docker image | `Dockerfile`, `compose.yaml` | Docker Buildx, multi-arch |
| Linux archive | `linux/` | `install.sh`, systemd unit, settings example |
| Windows installer | `windows/` | WiX 5 |
| Android app | `android/` | Gradle (wrapper in `android/`), Kotlin, Android SDK, Java 17; no libraries beyond Android's own |
| CI | `.github/workflows/`, `ci/` | GitHub Actions |

Backend packages, in `backend/internal/`:

| Package | Does |
| --- | --- |
| `metrics` | reads the machine's usage (`Collector`) and shares one reading every 2 s (`Sampler`) |
| `history` | the SQLite store, recorder, in-memory recent readings, pruner, migrations |
| `hub` | collects from other devices: agents, recorders, device list, availability |
| `server` | the HTTP handlers, the local-network and Host checks, the website files |
| `lan` | decides which addresses belong to the local network |
| `password` | the password for changing devices |
| `update` | the daily check for a newer release |
| `version` | the version, set at build time |
| `web` | the built website, embedded into the binary |
| `sysfile` | reads the small one-value files under `/sys` and `/proc`, for `metrics` and the add-ons |

`backend/cmd/den-watcher/main.go` reads the settings and wires these together; on Windows `service_windows.go` runs it as a service. `backend/cmd/den-watcher-tray` is the Windows tray icon, and `backend/cmd/tray-icons` draws its icons. `backend/cmd/licenses` writes the license notices of the Go modules into the built website (see [Open-source projects](third-party.md)). How the parts work together is in [How it works](architecture.md).

## Run it while developing

```bash
# Terminal 1: the backend, serving the API on http://localhost:9393
cd backend && go run ./cmd/den-watcher

# Terminal 2: the website with live reload on http://localhost:4200, forwarding /api to the backend
cd frontend && npm ci && npm start
```

`npm run build` in `frontend/` writes the website into `backend/internal/web/files/build/`, and `go build` embeds it, so one binary serves both. The website is never built on the Raspberry Pi: CI and the Docker build do it, and the Dockerfile cross-compiles the binary for arm64.

## Demo page

`npm run build:demo` in `frontend/` builds the demo into `frontend/dist/demo/`. The Demo page workflow publishes two to the `gh-pages` branch, which GitHub Pages serves: the latest release at https://programmer-den.github.io/den-watcher/ and main at https://programmer-den.github.io/den-watcher/main/. A release tag replaces only the root and a change to main only `main/`. For GitHub Pages to serve that branch, the repository's *Settings › Pages* must have *Source* set to *Deploy from a branch*, with `gh-pages` and `/ (root)`; with *GitHub Actions* as the source, pushes to `gh-pages` are never published and the site keeps the last demo deployed before. It passes `--base-href` and, through `--define`, the release's version (`DEMO_RELEASE`) or main's commit (`DEMO_COMMIT`) for the notice above the page, which links to the other one, and for the version the sample devices report (`src/demo/demo-build.ts`). It is the real page, started from `src/demo/main.ts`, which answers the page's requests with made-up devices from `src/demo/fleet.ts` instead of a backend; devices cannot be added or removed there, nor a backup downloaded. The normal build does not contain any of it. When a new value is added to the API, give the sample devices that report it a value in `fleet.ts` too, so the demo shows it. A new add-on needs a function named after its folder in `fleet.ts`, such as `bluetoothAddOn()` for `backend/internal/addons/bluetooth`, used by at least one sample device; `ci/check-demo-covers-addons.sh` checks that in CI. The page groups the cards and the history charts in categories (system, storage, network, temperature and power, programs and containers, device); a card or chart of extras goes under *More* until its group id is listed in `EXTRA_CATEGORIES` in `frontend/src/app/dashboard/categories.ts`, so give a new add-on's group its category there.

## Tray icon and theme colors

The Windows tray icon is the website's mascot (`frontend/src/app/mascot/mascot.html` and `mascot.css`) in the colors of the website's theme: the `--mascot-*` tones that `frontend/src/styles.scss` takes from its `$palette`. To recolor the website, the bear and the tray icon together, change `$palette` there; the next build follows. The icons are drawn at build time, after the website:

```bash
cd frontend && npm ci && npm run build
cd ../backend && go run ./cmd/tray-icons
GOOS=windows go build -ldflags=-H=windowsgui ./cmd/den-watcher-tray
```

`tray-icons` writes `den-watcher.ico` (the installer's icon) and `running.ico`, `stopped.ico` and `paused.ico`, the bear with a green, red or grey status dot, into `backend/cmd/den-watcher-tray/icons/`. They are not committed. It understands the circles, ellipses and paths (`M`, `L`, `H`, `V`, `A`) the mascot uses and stops with an error on anything else. The menu's words are in `backend/cmd/den-watcher-tray/tray.go`, in the same four languages as the website.

The icons for a phone's home screen (`frontend/public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` with room around the bear for round and squircle masks, and `apple-touch-icon.png` for iOS) are drawn from `frontend/public/mascot.svg` and committed; draw them again when the bear or `$palette` changes. Their background, the bars' `theme-color` in `frontend/src/index.html`, the colors in `manifest.webmanifest` and `THEME_COLORS` in `frontend/src/app/theme/theme.ts` are the page's background (`--mat-sys-surface`) in light and dark mode.

## Translations

The website's text lives in `frontend/src/app/i18n/messages/`: `en.ts` (British English) is the source, and `de.ts`, `fr.ts` and `es.ts` must have the same keys, which the TypeScript compiler checks, so the build fails when a translation is missing. `en-us.ts` (American English) takes the British text and replaces only what is written differently in the US, such as the `format.*` date patterns with the 12-hour clock, so a new key needs no American copy. Dates are formatted with these patterns, never with a pattern written into a component. The `I18n` service holds the page's language as a signal, so switching it updates the page in place. The page starts in the language picked last time (kept in the browser's localStorage), else the browser's language (American English for `en-US`, British English for any other English), else British English.

- Add a text to `en.ts` and the same key to the other three files. A `{name}` in a text is a placeholder; every translation must use the placeholders of the English text, which a test checks
- Show it with `i18n.t('area.name')` (or `i18n.t('area.name', { name: value })`) in a template or a `computed`, after `protected readonly i18n = inject(I18n)`
- Format numbers and dates in the page's language by passing it to the pipe: `value | number: '1.0-1' : i18n.language()`, `time | date: format : undefined : i18n.language()`, `bytes | bytes: i18n.language()`

## Database changes

To change a table, append a migration to `migrations` in `backend/internal/history/migrate.go`; never change one a release already has. See [Updates to the layout](database.md#updates-to-the-layout).

## Checks

Run before opening a pull request:

```bash
gitleaks git
bash ci/check-no-ai-links.sh
bash ci/check-demo-covers-addons.sh
(cd backend && gofmt -l . && golangci-lint run && go test ./... && go mod tidy -diff && go tool govulncheck ./...)
(cd frontend && npm run format:check && npm run lint && npm audit --audit-level=high && npm test && npm run build)
```

- Formatting: `gofumpt` and `goimports` for Go (`golangci-lint fmt` fixes it), Prettier for the frontend (`npm run format` fixes it)
- Linting: `golangci-lint` with the settings in `backend/.golangci.yml`; ESLint in the frontend, which also fails on circular imports
- Dependencies: `govulncheck` and `npm audit` fail on known vulnerabilities; `go mod tidy -diff` fails when `go.mod` or `go.sum` is out of date
- Shell scripts: `bash -n` and `shellcheck`
- Android app: `(cd android && ./gradlew testReleaseUnitTest lintRelease assembleRelease)`, with the Android SDK in `ANDROID_HOME`

## Releases and builds

| Workflow | Builds |
| --- | --- |
| `ci.yml` | every check above, plus a build-only multi-arch Docker image on pull requests, whose amd64 image is then started with the `power` and `processes` add-on containers from `compose.yaml` until the page shows the processes add-on |
| `docker.yml` | publishes `ghcr.io/programmer-den/den-watcher:main` on every merge to main, and `X.Y.Z`, `X.Y` and `latest` on release tags (only `X.Y.Z-alpha` on a pre-release tag) |
| `windows.yml` | the x64 and arm64 MSIs, installs and uninstalls them on Windows; attaches them to releases |
| `linux.yml` | the Linux archives, tests install, update and uninstall under systemd; attaches them to releases |
| `android.yml` | the Android app's APK, after its unit tests and Android's lint, on pull requests that change `android/`; attaches it to releases, signed with the release key |
| `vulnerabilities.yml` | every night, the updates that fix known vulnerabilities on main (`ci/fix-vulnerabilities.sh`), as one pull request; fails when a vulnerability has no fix yet |
| `demo.yml` | publishes the demo of a release to the root of GitHub Pages on its release tag (not for a release marked as a pre-release, nor for a tag older than the newest release, such as a bugfix 1.0.5 after 1.1.0), and the demo of main to `main/` on every merge to main that changes the frontend; when a pre-release is later made a full release, run it by hand (*Run workflow*) on the tag |

A release is published on GitHub with a tag such as `1.0.4`; the workflows build and attach everything on their own. A pre-release adds a word, and maybe a number, after a dash, such as `2.0.0-alpha`, `2.0.0-beta.2` or `2.0.0-rc1`. The workflows mark its GitHub release as a pre-release, publish only the image `:2.0.0-alpha` (not `:2.0` or `:latest`), keep the demo at the root as it is, and build installers of version 2.0.0, so the release `2.0.0` installs over them. The update check counts a pre-release as older than the release of the same version and only ever offers full releases.

The version counts the pull requests merged since the last release, in order:

- Each feature raises the last number: `1.0.3` becomes `1.0.4`. The tenth feature raises the middle one instead: `1.0.9` becomes `1.1.0`.
- Each bugfix adds a letter or moves it on: `1.0.4` becomes `1.0.4a`, then `1.0.4b`; after `z` comes `aa`. The next feature drops the letters again.

The Android app is signed with one key for every release, so each APK installs over the one before; a release without it fails. Make it once and keep a copy somewhere safe, as an app signed with another key cannot update it:

```bash
keytool -genkeypair -keystore release.jks -alias den-watcher -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Den-Watcher"
base64 -w0 release.jks
```

Add the base64 text as the Actions secret `ANDROID_KEYSTORE`, and `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`den-watcher`) and `ANDROID_KEY_PASSWORD` (the same password, unless `keytool` was given another) in the repository's *Settings › Secrets and variables › Actions*. Pull requests and main are signed with the runner's debug key instead, so their APK installs only on a phone without the release. Android counts versions by a number that must grow, which the workflow makes from the tag: `1.2.3c` is `102030030` (the letters count on, `a` as 1 and `aa` as 27), and a pre-release such as `1.2.3-rc1` is one less than `1.2.3`, so every release installs over the ones before, also after the workflow or the repository is renamed. Pull requests and main take the run number. The version name is the tag's.

Docker images and the update check use the version as it is. A Windows installer's version may only hold numbers, so its letters become a fourth number: `1.0.4h` is `1.0.4.8` in Windows' list of apps, and still installs over `1.0.4`. Windows Installer compares only the first three numbers, so the installer also remembers the fourth and refuses to install an older bugfix of the same version, such as `1.0.4g`, over a newer one.

## Repository

- [AGENTS.md](../AGENTS.md): code style, security, testing and pull request rules
- [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md): every pull request fills it in; the "PR Template Validation" workflow checks it
- `ci/`: checks that CI runs and that you can run locally
- [SECURITY.md](../SECURITY.md): how to report a vulnerability and who can change the code
