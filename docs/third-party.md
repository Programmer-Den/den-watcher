# Open-source projects it is built on

den-watcher is MIT licensed and stands on the open-source projects below. The exact versions are in `backend/go.mod`, `frontend/package-lock.json`, the `Dockerfile` and the workflows in `.github/workflows`.

## License notices

Every build carries the license texts of the code compiled into it, and its website serves them:

- `http://<device>:9393/3rdpartylicenses.txt`: the packages bundled into the website, written by the Angular build.
- `http://<device>:9393/go-licenses.txt`: the Go standard library and every Go module compiled into the programs, written by `backend/cmd/licenses` in the Docker build and the Linux and Windows release workflows. CI runs it on every pull request, so a new module without a license file is caught before a release.

A device started with `DATA_ONLY=true` serves no website, but its program still holds both files.

## In the programs

| Project | License | Used for |
| --- | --- | --- |
| [gopsutil](https://github.com/shirou/gopsutil) | BSD-3-Clause | CPU, memory, disk, network and sensor readings |
| [modernc.org/sqlite](https://gitlab.com/cznic/sqlite) | BSD-3-Clause; SQLite itself is public domain | The history database, without cgo |
| [modernc.org/libc](https://gitlab.com/cznic/libc), [mathutil](https://gitlab.com/cznic/mathutil), [memory](https://gitlab.com/cznic/memory) | BSD-3-Clause | Needed by modernc.org/sqlite |
| [golang.org/x/sys](https://github.com/golang/sys) | BSD-3-Clause | System calls, the Windows service, registry and event log |
| [fyne.io/systray](https://github.com/fyne-io/systray) | Apache-2.0 | The Windows tray icon |
| [go-sysconf](https://github.com/tklauser/go-sysconf) (BSD-3-Clause), [numcpus](https://github.com/tklauser/numcpus) (Apache-2.0), [go-ole](https://github.com/go-ole/go-ole) (MIT), [wmi](https://github.com/yusufpapurcu/wmi) (MIT) | | Needed by gopsutil |
| [go-humanize](https://github.com/dustin/go-humanize) (MIT), [google/uuid](https://github.com/google/uuid) (BSD-3-Clause), [bigfft](https://github.com/remyoudompheng/bigfft) (BSD-3-Clause), [go-isatty](https://github.com/mattn/go-isatty) (MIT), [go-strftime](https://github.com/ncruces/go-strftime) (MIT) | | Needed by modernc.org/sqlite |
| [gosnmp](https://github.com/gosnmp/gosnmp) | BSD-2-Clause | Reading routers over SNMPv2c and SNMPv3 |
| [godbus/dbus](https://github.com/godbus/dbus) | BSD-2-Clause | The Bluetooth add-on on Linux, which asks BlueZ over D-Bus; also needed by systray |
| [Angular](https://github.com/angular/angular) | MIT | The website |
| [Angular Material and CDK](https://github.com/angular/components) | MIT | The website's components and theme |
| [RxJS](https://github.com/reactivex/rxjs) | Apache-2.0 | Needed by Angular |
| [tslib](https://github.com/microsoft/tslib) | 0BSD | TypeScript helpers |
| [distroless](https://github.com/GoogleContainerTools/distroless) `static-debian13` | Apache-2.0, with Debian packages under their own licenses | The Docker image the program runs in |

The website loads no web fonts or icon fonts; it uses the system font. The mascot was drawn for this project, and the flag icons were drawn for it from the national flags, whose designs are public domain.

## Programs it calls when they are installed

| Program | License | Used for |
| --- | --- | --- |
| `nvidia-smi`, from the NVIDIA driver | NVIDIA's own license | The gpu and power add-ons |
| [`vcgencmd`](https://github.com/raspberrypi/utils) | BSD-3-Clause | A Raspberry Pi 5's power |

They are not shipped with den-watcher.

## To build, check and release it

| Project | License |
| --- | --- |
| [Go](https://github.com/golang/go) and [govulncheck](https://github.com/golang/vuln) | BSD-3-Clause |
| [Node.js](https://github.com/nodejs/node) | MIT |
| [Angular CLI](https://github.com/angular/angular-cli) | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
| [ESLint](https://github.com/eslint/eslint), [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint), [angular-eslint](https://github.com/angular-eslint/angular-eslint), [eslint-plugin-import-x](https://github.com/un-ts/eslint-plugin-import-x) | MIT |
| [eslint-import-resolver-typescript](https://github.com/import-js/eslint-import-resolver-typescript) | ISC |
| [Prettier](https://github.com/prettier/prettier), [Vitest](https://github.com/vitest-dev/vitest), [jsdom](https://github.com/jsdom/jsdom) | MIT |
| [golangci-lint](https://github.com/golangci/golangci-lint), with [gofumpt](https://github.com/mvdan/gofumpt) and [goimports](https://github.com/golang/tools) | GPL-3.0; BSD-3-Clause |
| [ShellCheck](https://github.com/koalaman/shellcheck) | GPL-3.0 |
| [WiX Toolset](https://github.com/wixtoolset/wix) 5 | MS-RL |
| The `node` and `golang` Alpine images the Docker build compiles in | MIT and BSD-3-Clause, with Alpine packages under their own licenses |
| GitHub Actions from [actions](https://github.com/actions) | MIT |
| GitHub Actions from [docker](https://github.com/docker) | Apache-2.0 |
| [golangci-lint-action](https://github.com/golangci/golangci-lint-action) | MIT |

These only build and check the code; none of their code ends up in den-watcher, so their licenses, the GPL ones included, do not apply to it.
