# What is collected

den-watcher reads only what the operating system offers to programs without extra rights. It never changes the machine, runs no helper with privileges and starts no other programs, except `nvidia-smi` where it is installed. Values a system does not report are left out of the page instead of showing an error.

- [Where the values come from](#where-the-values-come-from)
- [The snapshot](#the-snapshot)
- [What each system reports](#what-each-system-reports)
- [GPUs](#gpus)
- [What is kept in the history](#what-is-kept-in-the-history)
- [Alerts](#alerts)

## Where the values come from

| System | Source |
| --- | --- |
| Linux | `/proc` (CPU times, memory, load, disk and network counters, mounts) and `/sys` (temperatures, CPU clock, fans, batteries, GPUs, link speed, the Raspberry Pi's throttling flags), read with [gopsutil](https://github.com/shirou/gopsutil) and small file reads of its own |
| Linux in Docker | the same, from the host's `/proc` and `/sys`, mounted read-only at `/host/proc` and `/host/sys` (`HOST_PROC` and `HOST_SYS` point there), so the values describe the host, not the container |
| Windows | the Windows APIs gopsutil uses, and the performance counters Task Manager shows for GPUs |
| macOS | what gopsutil reports; not tested, low priority |

Readings are cheap: single file reads rather than scanning every process. Values that change rarely, such as a network card's link speed and addresses, are read once a minute. The machine is read only when asked, and at most once every 2 seconds however many pages are open: every 5 seconds for the history or a hub, every 2 seconds while a page is open (see [Inside one device](architecture.md#inside-one-device)).

CPU usage and disk and network speeds are measured between two readings, so they are averages over the last 2 seconds.

When the network counters cannot be read, as when Windows loses an adapter during the reading or Linux hides the host's first process (`/proc/1`, with `hidepid`), the reading goes on without network cards, and this is logged once; outside a container, Linux then reads the program's own `/proc/net/dev`, which is the same network. A container is told by `HOST_PROC` being set, as the shipped setups do; a container started without it would read its own network there. On Windows, where reading the temperature sensors is a costly WMI query that usually finds none for the Local Service account, a reading that finds none is tried again only after 10 minutes.

## The snapshot

`GET /api/metrics` answers with one snapshot. A hub receives the same JSON from each device.

| Field | Meaning |
| --- | --- |
| `name` | what the device calls itself: its `DEVICE_NAME`, or else its hostname; left out in Docker without `DEVICE_NAME`, where the hostname is the container's. A hub fills it in as the name when the device is added from its own browser |
| `version` | den-watcher version that read it |
| `time`, `timeZone` | when it was read, and the device's time zone name and offset |
| `uptimeSeconds` | time since the machine started |
| `cpu` | `usagePercent`, `cores`, `coreUsagePercent` per core, `clockMHz`, `loadAverage` (1, 5, 15 min), `ioWaitPercent`, `stealPercent`, `processes` (total, running) |
| `memory` | `totalBytes`, `usedBytes`, `usedPercent`, `availableBytes`, `cachedBytes`, `swap` (total, used, percent) |
| `temperatures` | per sensor: `sensor`, `celsius` |
| `disks` | per path in `DISK_PATHS`: size, used, percent, read and write bytes per second, operations per second, busy percent, time per operation |
| `network` | per network card, without loopback and virtual interfaces such as Docker bridges, VPNs and Hyper-V adapters: bytes received and sent in total and per second, errors, dropped packets, link speed, IPv4 addresses |
| `gpus` | per GPU: `name`, `usagePercent`, memory total and used, `celsius` |
| `throttling` | Raspberry Pi only: undervoltage, frequency capping and throttling, now and since boot |
| `battery` | `percent`, `pluggedIn`, `watts`, `healthPercent` |
| `fans` | per fan: `name`, `rpm` |
| `extras` | values beyond the fields above, which the device describes itself; see [Extras](#extras) |
| `system` | what the machine is, read once at start: `os` (name and version), `kernel`, `architecture`, `cpu` (model), `maker` and `model` of the board or PC; each left out where unknown, and the whole field by devices from before it was reported. Never serial numbers or network card addresses |
| `responseMilliseconds` | set by a hub on the snapshots it serves of the other devices: how long the device took to answer its last `GET /api/metrics`; a device leaves it out of its own, and the hub replaces whatever a device sends |

Sensors and GPUs that share a name are numbered (`coretemp 1`, `coretemp 2`), so every name stands for one sensor in the history.

## What each system reports

| Value | Linux | Windows | Kept in the history |
| --- | --- | --- | --- |
| CPU usage | yes | yes | yes |
| Usage per core | yes | yes | no, only the total |
| CPU clock | where the kernel scales it (not in most virtual machines) | no | no |
| Load average | yes | no, Windows has none | no |
| Processes (total and running) | yes | no | no |
| I/O wait and steal | yes | no | no |
| Memory used | yes | yes | yes |
| Available memory and cache | both | available only | no |
| Swap | when a swap file or partition exists | page files | yes |
| Disk usage | each path in `DISK_PATHS` | each drive in `DISK_PATHS` (default the system drive) | yes |
| Disk read/write speed | disks and partitions; for `/` inside Docker, the host's root disk | per drive letter | yes |
| Disk operations per second | yes | yes | no |
| Disk busy % and time per operation | yes | no | no |
| Network speed per card | yes | yes | yes |
| Network errors and dropped packets | since start | since start | no |
| Network link speed and IPv4 address | yes, read once a minute; most Wi-Fi cards report no speed | yes, read once a minute | no |
| Temperatures | where `/sys` has sensors (a Raspberry Pi has one for its CPU) | rarely, except NVIDIA GPUs through `nvidia-smi`; otherwise shown as unavailable | yes |
| GPU usage and memory | see [GPUs](#gpus) | see [GPUs](#gpus) | yes |
| Fan speed | where the kernel knows the fan, such as the Raspberry Pi 5 | no | no |
| Undervoltage and throttling | Raspberry Pi only | no | no |
| Battery charge and plugged in | laptops and tablets | laptops and tablets | yes, the charge |
| Battery power (W) and health | where the battery reports them | no | no |
| Time and time zone | yes; in Docker, the host's zone when `/etc/localtime` is mounted (as in `compose.yaml`), else UTC | yes | no |
| Uptime | yes | yes | no |
| System: OS, kernel, architecture, CPU model | yes; the OS from `/etc/os-release`, in Docker the host's when it is mounted at `HOST_ETC` (as in `compose.yaml`), else left out | yes | no |
| System: board or PC maker and model | the device tree's model, as on a Raspberry Pi, else the PC's firmware (`/sys/class/dmi/id`: `sys_vendor`, `product_name`), without placeholders such as "To Be Filled By O.E.M." | the firmware's, from the registry (`HARDWARE\DESCRIPTION\System\BIOS`) | no |

## Routers

A router read over UPnP reports one network card, *WAN*, with its traffic and the speed of the line, and the extras *Internet connection*: its state, the download and upload speed of the line and how long it is connected. It reports no CPU, memory, disks, temperatures or uptime, and the page leaves those cards out. An ASUS router read with its login reports the CPU per core, memory, uptime, a network card each for *WAN*, *LAN* and each Wi-Fi band, the temperatures of the CPU and the radios where the model has them, and the extras *Clients*: online, on a cable and on Wi-Fi, with the history of those online. A FRITZ!Box reports *WAN*, its uptime, *Internet connection* with the noise margins of a DSL line (with their history) and *Clients*. A router read over SNMP reports a network card for every port that is up, by its name, with errors and dropped packets, its uptime, and where the router tells them the CPU per core and memory. See [Show the router](setup.md#5-show-the-router).

## Checks

A thing in `HUB_CHECKS`, such as a printer, reports only the extras *Reachability*: the response time in milliseconds, with its history (`extra:reachability/response-time`), and how it is checked, a TCP port or a ping. A check by ping also reports, each with its history, the packet loss in percent (`extra:reachability/packet-loss`), the share of the 5 pings of a check that got no answer, and the jitter in milliseconds (`extra:reachability/jitter`), the mean difference between the response times of answers one after the other; the jitter is left out when only one ping was answered. The response time of a check by ping is the mean of its answers. It reports no CPU, memory, disks, network cards, temperatures, time or uptime, and the page leaves those cards out. See [Check other things on the network](setup.md#6-check-other-things-on-the-network).

## GPUs

The GPU card appears when den-watcher finds a GPU whose usage the system reports to programs without extra rights:

- **Windows:** every GPU, through the counters Task Manager shows, with its own memory. Windows has no GPU temperature for programs; the temperature of NVIDIA GPUs comes from `nvidia-smi`, which the NVIDIA driver installs, and is shown in the Temperature card under the GPU's name. `nvidia-smi` runs at most every 10 seconds, and a reading waits for it at most 1 second, as on Linux (below).
- **Linux:** AMD GPUs with usage, memory and temperature, and the Raspberry Pi's VideoCore GPU with usage, read from `/sys`. The Pi's GPU shares the main memory and its temperature is the Pi's CPU temperature, so only usage is shown. Older Raspberry Pi kernels do not report it; then the card stays hidden. NVIDIA GPUs show up when `nvidia-smi` is installed, which is not the case in the Docker image; its answer is reused for 10 seconds. nvidia-smi may take up to 5 seconds, as it can on headless servers without the driver's persistence mode; a reading waits for it at most 1 second and otherwise shows the last answer, while nvidia-smi finishes in the background for the next reading. A GPU the kernel has put to sleep through runtime power management, as the second GPU of many laptops, is not asked, since asking would wake it and keep it awake: an AMD GPU then shows as idle, and its temperatures and fan, which the kernel lists with the other sensors, are left out of the Temperature and Fans cards (the power add-on shows its power as 0 W), and NVIDIA GPUs, once each of them sleeps (`power/runtime_status` is `suspended`), show their last answer as idle without temperature or memory in use; the power and gpu add-ons likewise show 0 W for them and 0 for the fan, clocks, encoder and decoder then. An NVIDIA GPU that sleeps from the start shows up once it first wakes; the power and gpu add-ons ask `nvidia-smi` at their next read after the GPUs wake, not only once their 30 seconds are over. The NVIDIA GPUs are looked up again every minute, so one plugged in later, such as an external GPU, is found. An awake GPU that may sleep (`power/control` is `auto`) stays awake for its `power/autosuspend_delay_ms` after each time it is asked, which for AMD GPUs is 5 seconds, longer than the 2 seconds between readings, so it would never fall asleep; so such a GPU, or any other device whose sensors may sleep, is asked at most every twice that delay, and its last values are shown in between. A GPU that drives a display, such as a desktop's AMD card that drives the monitor, is read at every reading, as it usually stays awake for the display anyway, although its `power/control` is `auto` too: the GPU the display started on (its `boot_vga` is 1), or one with a connector in use (a `drm/card*/card*-*/enabled` of `enabled` and a `dpms` of `On`), such as a second card driving a second monitor. These files are kept by the kernel, so reading them does not wake the GPU. A connected monitor keeps an AMD card awake, blanked or not (Linux 5.18 and later, read from `/proc/sys/kernel/osrelease`), so there such a card is read at every reading while a monitor is connected (its connector's `status` is `connected`), unless the driver is loaded with `amdgpu.runpm=-2` (Linux 6.6 and later); only then, or on an older kernel, does a blanked monitor, or one switched off in the display settings, let the second card sleep (Linux 5.17.6 and later 5.17 releases have the check too; there such a card is only read every twice its delay). With `amdgpu.dc=0`, the driver's older display code for old cards, any connector whose `dpms` is `On`, used or not, keeps the card awake (Linux 5.7 and later), so such a card is read at every reading too; when the driver picks that code on its own for an old card, den-watcher cannot tell, and reads the card only every twice its delay, which never wakes it. The driver's `runpm` and `dc` settings are read again every minute, so a driver loaded again with other settings is followed. The card the display started on is always read at every reading. Each program keeps to that on its own: den-watcher, the power add-on and the gpu add-on together can still ask an NVIDIA GPU often enough to keep it awake when its delay is long; leave the add-ons out where that matters. A sensor of a sleeping device counts in the numbering of same-named sensors only if it reported a temperature when last read awake, so the others keep their names. Intel GPUs report their usage only to programs with extra rights, so they are not shown.
- **macOS:** not shown.

## Extras

`extras` lets a device report values the hub does not know yet: a hub shows and stores them as the device describes them, so a device running a newer version can add metrics without the hub being updated first. A hub running a version from before extras ignores the field.

Each extra is a group shown as one card:

| Field | Meaning |
| --- | --- |
| `id` | the group's name, such as `pressure`: lowercase letters, digits, `-` and `_`, up to 40 characters |
| `title`, `titles` | the card's title in English, and in other languages by language code (`de`, `fr`, `es`, `en-US`) |
| `description`, `descriptions` | optional: a sentence or two on what the card shows, in English and in other languages (like `title` and `titles`), shown at the (i) next to the title; cut to 300 characters |
| `items` | the values: `id` (as above), `label` and `labels` (like `title` and `titles`), `unit`, then `value`, or `text` for the unit `text` with `texts` for its translations (like `titles`), `history: true` to keep its history, and `section` when the group holds the values of several things, such as disks: the page shows the values of one section under it, each label without the section and `: ` before it |

Units: `percent`, `celsius`, `bytes`, `bytesPerSecond`, `watts`, `milliseconds`, `perSecond`, `number` and `text`. A unit the hub does not know is shown as a plain number.

Example:

```json
"extras": [{
  "id": "pressure", "title": "Pressure", "titles": { "de": "Auslastungsdruck" },
  "items": [
    { "id": "cpu", "label": "CPU", "unit": "percent", "value": 1.5, "history": true },
    { "id": "kernel", "label": "Kernel", "unit": "text", "text": "6.12.48" }
  ]
}]
```

Before showing or storing another device's extras, the hub keeps at most `HISTORY_MAX_ENTRIES` groups and as many values per group (where there are more, the ones with `history: true` first, by `id`, then the others in the order the device lists them, such as the busiest processes first; all shown in the order the device lists them), cuts titles, labels, sections and texts to 80 characters, and leaves out groups and values with an invalid or repeated `id` and values without a value. The page draws one chart per group and unit of the values with `history: true`, each in a card of its own: a group whose values with `history: true` have several units shows as one card per unit, and the values without a chart in a card of the group's own.

### What den-watcher itself uses

Every device reports what den-watcher itself uses of it as the extras group `den-watcher`, shown as the card *Den-Watcher itself* among the programs: `cpu` (percent of the whole machine, like `cpu`, with its history), `memory` (resident memory, or the working set on Windows, in bytes, with its history), `read` and `written` (bytes per second), `database` (the history database with its write-ahead log, in bytes) and `programs` (how many of den-watcher's programs are counted). It adds up den-watcher and every add-on that writes a report: each add-on puts what it uses itself in its report as `own` (`cpuPercent`, `memoryBytes`, `readBytesPerSecond`, `writeBytesPerSecond`), measured since its previous report, so an add-on from before this is left out. On Windows the add-on host writes a report of its own (`host.json`) with only its `own`, and the smart add-on, a service of its own, is counted like the others; the tray is not, as it runs in each user's session and writes no report. On Linux, `read` and `written` are what reached the disks (`/proc/self/io`); on Windows they are all of a program's reads and writes, also over the network and pipes, as Windows does not count disk I/O per program; macOS counts neither. Network traffic per program is left out, as neither Linux nor Windows counts it without tracing every connection, and so is what Docker itself needs to run the containers. CPU and the speeds are measured since the previous reading, so the first reading after a program starts shows only its memory.

## What is kept in the history

The charts and the database keep a subset of the snapshot: the values that make sense as a line over time. Everything else is only shown live.

| Metric name | Unit | Per |
| --- | --- | --- |
| `cpu` | % | device |
| `memory` | % used | device |
| `swap` | % used | device, when it has swap |
| `battery` | % charge | device, when it has a battery |
| `temperature:<sensor>` | °C | sensor |
| `disk:<path>` | % used | disk |
| `disk.read:<path>`, `disk.write:<path>` | bytes per second | disk |
| `network.receive:<card>`, `network.send:<card>` | bytes per second | network card |
| `gpu:<name>` | % | GPU |
| `gpu.memory:<name>` | % used | GPU with its own memory |
| `response` | milliseconds | other device a hub collects from: how long its answer to the hub's `GET /api/metrics` took, measured by the hub every 5 seconds; not for the hub itself, routers or checks |
| `extra:<group>/<value>` | the extra's own unit | extra value with `history: true` |

Examples: `disk:/`, `network.receive:eth0`, `temperature:cpu_thermal`. Adding a metric needs no change to the database: every value is a row with its name.

Per device, the first 64 sensors, disks, network cards and GPUs each by name are kept (`HISTORY_MAX_ENTRIES`), and the first 512 values of extras with `history: true` by metric name (8 × `HISTORY_MAX_ENTRIES`), as a hub also keeps of the minutes it fetches; a device that reports more is logged once, and the dashboard still shows them all. A sensor, disk, network card or GPU whose name would make a metric name longer than 256 bytes is left out of the history, which is logged once.

*Download CSV*, next to the range above the charts, saves the history of the device shown over the range shown as a CSV file for a spreadsheet, with a column for each metric and a row for each time in UTC, in the steps the charts show; on the timeline, zoomed in, a second one saves the stretch zoomed into. See [`GET /api/history.csv`](architecture.md#http-api).

How these values are stored, averaged and deleted is described in [Database and history](database.md).

## Alerts

A device with the website (every hub) checks its own values and those of every device it collects from every 15 seconds. A value that needs attention is an alert: the page shows it as a red sign (amber for a warning) in the header with the number of alerts, at the device's name, above its cards and on the card it is about, and keeps it in the alert log, which the header's button opens. The browser's tab tells about them too, also while it is in the background: its title starts with their number, such as `(2) Den-Watcher`, and its icon gets a red dot (amber when all of them are warnings). Nothing is sent anywhere: there are no e-mails.

The alert log can switch on notifications from the browser, in each browser on its own (kept in its `localStorage`): while the page is open in a tab that is not in front, a new alert, a warning that became an alert and, when asked for too, the end of an alert each show one, in the page's language. The browser asks for leave the first time. Browsers offer notifications only to a page opened over https or on `localhost`; a page opened at the device's address on the local network over plain http has none, and the alert log says so. Some browsers, such as Chrome on Android, show them only from a service worker, which the page has only where it is opened over https ([details](setup.md#install-the-page-as-an-app)).

| Kind | Warning | Alert | Must last |
| --- | --- | --- | --- |
| Server, IoT device or check does not answer (not a PC or laptop) | | 2 minutes without an answer | |
| Disk usage, per disk | 90 % | 95 % | |
| Memory used | 90 % | 95 % | 2 minutes |
| CPU usage | 95 % | | 5 minutes |
| Temperature, per sensor | 85 °C | 95 °C | 1 minute |
| Raspberry Pi throttling now | frequency capped, throttled or soft temperature limit | undervoltage | |
| SMART check of a disk (smart add-on) | | failed, or the disk cannot be read | |
| A network nearby named like the one the device is connected to but secured otherwise (wifi add-on) | a router of its own sends it, with no kind of security in common, such as an open *Den* next to *Den* with WPA2/WPA3: it may be a copy set up to catch passwords | | |

A value must stay at or above the threshold for the time in *Must last* before it is an alert, so a short peak is none. An alert ends once the value is below the warning threshold by a margin (2 points for disks, 5 for memory and temperatures, 10 for the CPU), so a value hovering around a threshold does not start and end alerts all the time. A warning that rises past the alert threshold becomes an alert; the log keeps the highest level and value each one reached. Names are compared without case, spaces, hyphens and underscores, and a mesh router that offers less, such as WPA2 next to WPA2/WPA3, or an access point whose security is unknown is no copy. While a device's values cannot be read for a moment, its alerts last on. The alerts that last are taken up again after a restart, and end at the first check that finds their value back to normal. The log keeps alerts for `RETENTION_DAYS` after they ended, except those of a device removed on the hub without its history, or taken out of `HUB_DEVICES`, `HUB_ROUTERS` or `HUB_CHECKS`, which go with it.

## The usage for Prometheus

With `PROMETHEUS=true`, `GET /metrics` answers with the current usage of every device in the Prometheus text format (see [Show the usage in Grafana](setup.md#7-show-the-usage-in-grafana)). Every value has the labels `device`, the device's name, and `id`, its id. Values a device does not report, such as a battery or the swap space, or the uptime, CPU and memory of a router read over UPnP or a check, are left out, as in [the snapshot](#the-snapshot).

| Metric | Type | Labels | Value |
| --- | --- | --- | --- |
| `denwatcher_device_up` | gauge | | 1 when the device answered, 0 when it did not: not in time, or not recently for a device the hub collects from |
| `denwatcher_alerts` | gauge | `level` (`warning` or `alert`) | the [alerts](#alerts) of the device that last now |
| `denwatcher_uptime_seconds` | gauge | | time since the device started |
| `denwatcher_response_seconds` | gauge | | how long another device took to answer the hub's last reading of it; not for the hub itself, routers or checks |
| `denwatcher_cpu_usage_percent`, `denwatcher_cpu_cores`, `denwatcher_cpu_clock_mhz`, `denwatcher_cpu_iowait_percent`, `denwatcher_cpu_steal_percent` | gauge | | the processor |
| `denwatcher_cpu_core_usage_percent` | gauge | `core` | usage of each core, counted from 0 |
| `denwatcher_load1`, `denwatcher_load5`, `denwatcher_load15`, `denwatcher_processes`, `denwatcher_processes_running` | gauge | | load average and processes |
| `denwatcher_memory_total_bytes`, `_used_bytes`, `_used_percent`, `_available_bytes`, `_cached_bytes` | gauge | | the main memory |
| `denwatcher_swap_total_bytes`, `_used_bytes`, `_used_percent` | gauge | | the swap space |
| `denwatcher_temperature_celsius` | gauge | `sensor` | each temperature sensor |
| `denwatcher_disk_total_bytes`, `_used_bytes`, `_used_percent`, `_read_bytes_per_second`, `_write_bytes_per_second`, `_operations_per_second`, `_busy_percent`, `_latency_seconds` | gauge | `path` | each disk |
| `denwatcher_network_received_bytes_total`, `_sent_bytes_total`, `_errors_total`, `_dropped_total` | counter | `interface` | each network card, since the device started |
| `denwatcher_network_receive_bytes_per_second`, `_send_bytes_per_second`, `_link_mbps` | gauge | `interface` | each network card now |
| `denwatcher_gpu_usage_percent`, `_memory_total_bytes`, `_memory_used_bytes`, `_temperature_celsius` | gauge | `gpu` | each GPU |
| `denwatcher_battery_percent`, `_plugged_in`, `_watts`, `_health_percent` | gauge | | the batteries |
| `denwatcher_fan_rpm` | gauge | `fan` | each fan |
| `denwatcher_extra` | gauge | `group`, `item`, `unit`, `label`, `section` | each value of the [extras](#extras) that is a number, by the ids of its group and item, with its unit (such as `percent` or `bytesPerSecond`), its English label and, where it has one, its section; texts are left out |

The values are read as for `GET /api/devices/metrics`: a device that does not answer within 3 seconds has `denwatcher_device_up` 0 for that scrape. The rates are measured by the device between its own readings; Prometheus' `rate()` over the counters gives the same over the scrape interval.

## When a disk is full

Under each disk on the *Disks* card, the page tells in about how many days the disk is full when it has filled up steadily: it fits a straight line through the disk's usage (`disk:<path>`) over the last 7 days of the history, and at that line's pace from the usage now, says *Full in about 10 days*. Less than two weeks shows in amber with a warning sign. Nothing is shown when the history covers less than a day, the usage is flat or falls, it rose unsteadily (such as one large copy on an otherwise even disk, R² below 0.5), the disk would take more than a year to fill, or the device is not answering. The page computes this itself from `GET /api/history`, read at most once an hour for each device while a *Disks* card shows; it is no alert and is not kept anywhere.

## Events on the charts

The charts and the timeline mark what happened to the device shown, so a spike lines up with its cause:

| Mark | What | From |
| --- | --- | --- |
| red line (amber for a warning), with a dot | an [alert](#alerts) started; a dashed line with a ring where it ended. An alert that a device does not answer is left out, as its band shows that | the alert log |
| faint band | a time another device did not answer the hub; for a PC or laptop, a time it was switched off | its [availability](architecture.md#http-api) |
| line in the theme's color | the device started (a reboot): its uptime was lower than at the reading before, at the time it started | kept by the hub |
| line in a second color | den-watcher on the device was updated: its version changed, at the time the new one was first seen | kept by the hub |

Pointing at a chart tells what happened in the step under the pointer, below the values; the timeline shows the marks in a row *Events* above the values. A device with the website (every hub) looks at the uptime and version of itself and every device it collects from every 15 seconds and keeps the reboots and updates in the `events` table, for `RETENTION_DAYS` ([Tables](database.md#tables)). A reboot while the hub was stopped is noticed at its next start, as long as the device's uptime is still lower than the hub last saw; a device that tells no uptime, such as a thing in `HUB_CHECKS`, has no reboots, and one that runs no den-watcher, such as a router, no updates. The page reads them with `GET /api/events`.
