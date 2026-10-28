# Checks the Windows installer on a Windows machine, as an administrator:
# checks it refuses an UPDATE_CHECK the service cannot read and a WIFI_SCAN
# other than 0 or 1, installs it with WIFI_SCAN=0 and the website and the power, gpu, kernel, pressure, Wi-Fi, memory,
# ports, smart and processes add-ons on, checks the service runs all but
# the smart add-on as child processes of its add-on host, checks the tray icon pauses,
# resumes and stops the service, updates it to a newer bugfix without
# options and checks the options and the add-ons were kept, except
# RESET_PASSWORD, and the tray icon was closed for the update, checks the
# older bugfix then refuses to install over it, repairs it with
# RESET_PASSWORD=true and again without, as the docs say to, which restarts
# the service and leaves the tray icon running, checks a repair refuses an
# UPDATE_CHECK the service cannot read and takes one it can, switches the
# website off and on again with repairs, checks a repair refuses an add-on
# option other than 0 or 1, removes the power add-on and adds it again with
# repairs, the first with the reduced user interface, and checks a repair
# without options keeps the add-ons, that repairs with RESET_PASSWORD and the
# reduced user interface leave the tray icon running, and that a full repair
# keeps the add-ons and closes the tray icon, checks a bad remembered
# UPDATE_CHECK is refused with the repair that fixes it, which does, but does
# not hold up the uninstall, uninstalls it with DELETE_HISTORY=1 and checks it
# leaves no data folder, then installs it with the defaults
# and checks it only serves the usage data, and last installs it with a
# router and its password, checks the service encrypted the password and
# deleted it from the registry, and checks that an update with WEBSITE=0
# turns the website and the router off but keeps the password, that one with
# a space clears DISK_PATHS, UPDATE_CHECK and PORT, and that uninstalling
# deletes the password and keeps the history.
#
#   pwsh windows/check-installer.ps1 -Msi den-watcher-1.2.3-x64.msi -NewerMsi den-watcher-1.2.3a-x64.msi
param(
    [Parameter(Mandatory)] [string] $Msi,
    # The same installer with the next bugfix version, to check an update.
    [Parameter(Mandatory)] [string] $NewerMsi
)

$ErrorActionPreference = 'Stop'
$Msi = (Resolve-Path $Msi).Path
$NewerMsi = (Resolve-Path $NewerMsi).Path

# Runs the installer silently, or with the user interface Ui, such as /qr,
# the reduced one, which runs the wizard's actions without its pages.
function Invoke-Installer([string] $Arguments, [string] $Ui = '/qn') {
    $process = Start-Process msiexec.exe -ArgumentList "$Arguments $Ui /l*v msiexec.log" -PassThru
    # An installer waiting on a dialog no one answers would never end.
    if (-not $process.WaitForExit(300000)) {
        $process.Kill($true)
        Get-Content msiexec.log -Tail 80
        throw "msiexec $Arguments $Ui did not end within 5 minutes, as if waiting on a dialog"
    }
    if ($process.ExitCode -ne 0) {
        Get-Content msiexec.log -Tail 80
        throw "msiexec $Arguments failed with exit code $($process.ExitCode)"
    }
}

# The versions of Den-Watcher that Windows lists as installed.
function Get-InstalledVersions {
    @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' |
        Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -eq 'Den-Watcher' } |
        ForEach-Object { $_.DisplayVersion }) -join ', '
}

# The lines of the last installer log that match Pattern, to tell why a
# check after an install failed. Without the zeros the log reads the same
# whether it was written as ANSI or as UTF-16.
function Show-InstallerLog([string] $Pattern) {
    ((Get-Content msiexec.log -Raw) -replace "`0", '') -split "`r?`n" | Where-Object { $_ -match $Pattern }
}

# Runs the installer and checks it refuses with a message that holds each of
# Messages, as a launch condition that is not met does, and changes nothing.
function Assert-InstallerRefuses([string] $Arguments, [string[]] $Messages) {
    $before = Get-InstalledVersions
    $process = Start-Process msiexec.exe -ArgumentList "$Arguments /qn /l*v msiexec.log" -Wait -PassThru
    # 1603 is a failed install. Without the zeros the log reads the same
    # whether it was written as ANSI or as UTF-16.
    $log = (Get-Content msiexec.log -Raw) -replace "`0", ''
    $missing = @($Messages | Where-Object { -not $log.Contains($_) })
    if ($process.ExitCode -ne 1603 -or $missing.Count -gt 0) {
        Get-Content msiexec.log -Tail 80
        throw "msiexec $Arguments exited with $($process.ExitCode); it should refuse with '$($Messages -join "' and '")' and 1603"
    }
    $after = Get-InstalledVersions
    if ($after -ne $before) { throw "msiexec $Arguments changed the installed version from '$before' to '$after'" }
}

# Waits for the service to answer, as it takes a moment to start.
function Get-Answer([string] $Url) {
    foreach ($try in 1..30) {
        try { return Invoke-RestMethod $Url } catch { Start-Sleep -Seconds 1 }
    }
    Get-Service UsageControl | Format-List
    Get-EventLog -LogName Application -Source UsageControl -Newest 5 -ErrorAction SilentlyContinue | Format-List
    throw "The service did not answer $Url"
}

# Checks a setting the installer gave the service, such as DATA_ONLY=true.
function Assert-ServiceSetting([string] $Name, [string] $Value) {
    $environment = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\UsageControl').Environment
    $lines = @($environment | Where-Object { $_.StartsWith("$Name=") })
    if ($lines.Count -ne 1) { throw "The service has $($lines.Count) settings $Name, not 1: $($environment -join '; ')" }
    $got = $lines[0].Substring($Name.Length + 1)
    if ($got -ne $Value) { throw "The service's $Name is '$got', not '$Value'" }
}

function Get-ServiceProcessId {
    (Get-CimInstance Win32_Service -Filter "Name = 'UsageControl'").ProcessId
}

# The add-on host: the den-watcher.exe the service starts the add-ons through.
function Get-AddOnHostProcessId {
    $service = Get-ServiceProcessId
    @(Get-CimInstance Win32_Process -Filter "Name = 'den-watcher.exe'" | Where-Object ParentProcessId -eq $service).ProcessId
}

function Get-StatusCode([string] $Url) {
    (Invoke-WebRequest $Url -UseBasicParsing -SkipHttpErrorCheck).StatusCode
}

function Assert-FirewallPort([string] $Port) {
    $rule = Get-NetFirewallRule -DisplayName 'Den-Watcher'
    $opened = ($rule | Get-NetFirewallPortFilter).LocalPort
    if ($opened -ne $Port) { throw "The firewall rule opens port $opened, not $Port" }
    if ($rule.Profile -ne 'Private') { throw "The firewall rule applies to $($rule.Profile) networks, not only private ones" }
}

function Assert-Website([string] $Port, [string] $Devices = 'Runner, Pi') {
    $answer = Get-Answer "http://127.0.0.1:$Port/api/devices"
    $names = ($answer.devices | ForEach-Object { $_.name }) -join ', '
    if ($names -ne $Devices) { throw "The website shows the devices '$names', not '$Devices'" }
    $status = Get-StatusCode "http://127.0.0.1:$Port/"
    if ($status -ne 200) { throw "The website answered $status" }
    if (-not (Test-Path "$env:ProgramData\Usage Control\usage-control.db")) { throw 'The history database was not created' }
    Assert-FirewallPort $Port
}

# The tray icon's hidden window, which its menu commands are sent to.
Add-Type -Namespace Win32 -Name Tray -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string className, string windowName);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
'@
$trayExe = "$env:ProgramFiles\Den-Watcher\den-watcher-tray.exe"

function Wait-Until([scriptblock] $Condition, [string] $What) {
    foreach ($try in 1..30) {
        if (& $Condition) { return }
        Start-Sleep -Seconds 1
    }
    throw "Waited in vain until $What"
}

# Checks the add-on Name is installed and runs as a child process of the
# service's add-on host, a den-watcher.exe that starts the add-ons it finds
# next to it, and not as the service of its own OldService it was before.
function Assert-ChildAddOn([string] $Name, [string] $OldService) {
    if (-not (Test-Path "$env:ProgramFiles\Den-Watcher\den-watcher-$Name.exe")) { throw "The $Name add-on is not installed" }
    if (Get-Service $OldService -ErrorAction SilentlyContinue) { throw "The $Name add-on is still the service $OldService" }
    Wait-Until {
        $hosts = @(Get-AddOnHostProcessId)
        $hosts.Count -eq 1 -and @(Get-CimInstance Win32_Process -Filter "Name = 'den-watcher-$Name.exe'" | Where-Object ParentProcessId -eq $hosts[0]).Count -eq 1
    } "the $Name add-on runs as a child process of the service's add-on host"
}

# Checks no add-on the service starts runs, as after the service stopped.
function Assert-NoChildAddOns {
    Wait-Until {
        @(Get-Process den-watcher-* -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin 'den-watcher-tray', 'den-watcher-smart' }).Count -eq 0
    } 'the add-ons stopped with the service'
}

function Start-Tray {
    Start-Process $trayExe
    Wait-Until { [Win32.Tray]::FindWindow('SystrayClass', '') -ne [IntPtr]::Zero } 'the tray icon started'
}

# Clicks a menu entry of the tray icon. The entries are numbered in the order
# the tray program adds them: 8 is Pause, Resume or Start, 9 is Stop and exit.
function Invoke-TrayMenu([int] $Entry) {
    $window = [Win32.Tray]::FindWindow('SystrayClass', '')
    $null = [Win32.Tray]::PostMessage($window, 0x0111, [IntPtr]$Entry, [IntPtr]::Zero)
}

function Assert-Tray {
    if (-not (Test-Path $trayExe)) { throw 'The tray program is missing' }
    $run = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name 'Den-Watcher').'Den-Watcher'
    if ($run -ne "`"$trayExe`"") { throw "The tray icon starts at login as '$run', not '`"$trayExe`"'" }
    $rights = (sc.exe sdshow UsageControl) -join ''
    if ($rights -notlike '*(A;;CCLCSWRPWPLOCRRC;;;IU)*') { throw "Logged-in users may not start and stop the service: $rights" }

    Start-Tray
    # The tray checks the service every 5 seconds; each wait gives it time to
    # notice the change before the next click.
    Invoke-TrayMenu 8
    Wait-Until { (Get-Service UsageControl).Status -eq 'Stopped' } 'Pause stopped the service'
    Assert-NoChildAddOns
    Start-Sleep -Seconds 6
    Invoke-TrayMenu 8
    Wait-Until { (Get-Service UsageControl).Status -eq 'Running' } 'Resume started the service'
    Start-Sleep -Seconds 6
    Invoke-TrayMenu 9
    Wait-Until { (Get-Service UsageControl).Status -eq 'Stopped' -and -not (Get-Process den-watcher-tray -ErrorAction SilentlyContinue) } 'Stop and exit stopped the service and closed the icon'
    Start-Service UsageControl
}

function Assert-PowerAddOn {
    Assert-ChildAddOn power UsageControlPower
    Wait-Until { Test-Path "$env:ProgramData\Usage Control\addons\power.json" } 'the power add-on wrote its report'
}

function Assert-GpuAddOn {
    Assert-ChildAddOn gpu UsageControlGPU
    Wait-Until { Test-Path "$env:ProgramData\Usage Control\addons\gpu.json" } 'the gpu add-on wrote its report'
}

function Assert-KernelAddOn {
    Assert-ChildAddOn kernel UsageControlKernel
    $report = "$env:ProgramData\Usage Control\addons\kernel.json"
    Wait-Until { (Test-Path $report) -and (Get-Content $report -Raw) -match '"context-switches"' } 'the kernel add-on wrote its report'
}

function Assert-PressureAddOn {
    Assert-ChildAddOn pressure UsageControlPressure
    Wait-Until { Test-Path "$env:ProgramData\Usage Control\addons\pressure.json" } 'the pressure add-on wrote its report'
    Wait-Until { (Get-Content -Raw "$env:ProgramData\Usage Control\addons\pressure.json") -match '"cpu-queue"' } 'the pressure add-on read the processor queue'
}

# The runner has no Wi-Fi, and Windows Server may lack the WLAN API; the
# add-on then still runs and writes a report without values.
function Assert-WifiAddOn {
    Assert-ChildAddOn wifi UsageControlWifi
    Wait-Until { Test-Path "$env:ProgramData\Usage Control\addons\wifi.json" } 'the Wi-Fi add-on wrote its report'
}

# The memory add-on reads the Memory performance counters as LocalService;
# its report holds the committed memory once it could read them.
function Assert-MemoryAddOn {
    Assert-ChildAddOn memory UsageControlMemory
    $report = "$env:ProgramData\Usage Control\addons\memory.json"
    Wait-Until {
        try {
            $items = (Get-Content $report -Raw -ErrorAction Stop | ConvertFrom-Json).extras.items
            @($items | Where-Object { $_.id -eq 'committed' -and $_.value -gt 0 }).Count -eq 1
        } catch { $false }
    } 'the memory add-on wrote the committed memory'
}

function Assert-PortsAddOn {
    Assert-ChildAddOn ports UsageControlPorts
    $report = "$env:ProgramData\Usage Control\addons\ports.json"
    Wait-Until { (Test-Path $report) -and (Get-Content $report -Raw) -match '"id":"ports"' } 'the ports add-on wrote its ports'
}

# The smart add-on runs as LocalSystem, as SMART commands need an
# administrator. Its report may hold no disks on a virtual machine.
function Assert-SmartAddOn {
    $addOn = Get-CimInstance Win32_Service -Filter "Name = 'UsageControlSmart'"
    if (-not $addOn) { throw 'The smart add-on is not installed' }
    if ($addOn.StartName -ne 'LocalSystem') { throw "The smart add-on runs as $($addOn.StartName), not LocalSystem" }
    Wait-Until { (Get-Service UsageControlSmart).Status -eq 'Running' } 'the smart add-on runs'
    Wait-Until { Test-Path "$env:ProgramData\Usage Control\addons\smart.json" } 'the smart add-on wrote its report'
}

# The processes add-on lists twenty processes by memory at once, and by CPU from
# its second read on, as the Local Service account sees them.
function Assert-ProcessesAddOn {
    Assert-ChildAddOn processes UsageControlProcesses
    $report = "$env:ProgramData\Usage Control\addons\processes.json"
    Wait-Until { (Test-Path $report) -and (Get-Content $report -Raw) -like '*"processes-cpu"*' } 'the processes add-on reported the busiest processes'
    $groups = (Get-Content $report -Raw | ConvertFrom-Json).extras
    $memory = @($groups | Where-Object id -eq 'processes-memory')
    if ($memory.Count -ne 1 -or $memory[0].items.Count -ne 20) { throw "The processes add-on did not list twenty processes by memory: $($groups | ConvertTo-Json -Depth 4)" }
}

# The runner has no Bluetooth; the add-on then still runs and writes a report
# without values.
function Assert-BluetoothAddOn {
    Assert-ChildAddOn bluetooth UsageControlBluetooth
    Wait-Until { Test-Path "$env:ProgramData\Usage Control\addons\bluetooth.json" } 'the Bluetooth add-on wrote its report'
}

# Every add-on, by the name of its Assert- function.
$addOns = 'Power', 'Gpu', 'Kernel', 'Pressure', 'Wifi', 'Memory', 'Ports', 'Smart', 'Processes', 'Bluetooth'

Write-Host 'An UPDATE_CHECK other than true or false is refused, naming the option'
Assert-InstallerRefuses "/i `"$Msi`" UPDATE_CHECK=no" 'UPDATE_CHECK must be true or false.', ".msi`" UPDATE_CHECK=true"
Write-Host 'A WIFI_SCAN other than 0 or 1 is refused, naming the option'
Assert-InstallerRefuses "/i `"$Msi`" WIFI_SCAN=off" 'WIFI_SCAN must be 0 or 1.', ".msi`" WIFI_SCAN=1"
if (Get-Service UsageControl -ErrorAction SilentlyContinue) { throw 'The refused install installed the service' }

Write-Host 'Installing with the website and the power, gpu, kernel, pressure, Wi-Fi, memory, ports, smart, processes and Bluetooth add-ons on'
Invoke-Installer "/i `"$Msi`" PORT=8091 WEBSITE=1 DEVICE_NAME=Runner HUB_DEVICES=Pi=192.168.1.20:9393 RETENTION_DAYS=7 DISK_PATHS=$env:SystemDrive\ UPDATE_CHECK=false RESET_PASSWORD=true POWER=1 GPU=1 KERNEL=1 PRESSURE=1 WIFI=1 WIFI_SCAN=0 MEMORY=1 PORTS=1 SMART=1 PROCESSES=1 BLUETOOTH=1"
$service = Get-Service UsageControl
if ($service.StartType -ne 'Automatic') { throw "The service starts $($service.StartType), not automatically" }
Assert-Website 8091
Assert-ServiceSetting DATA_ONLY 'false'
Assert-ServiceSetting HUB_DEVICES 'Pi=192.168.1.20:9393'
Assert-ServiceSetting DISK_PATHS "$env:SystemDrive\"
Assert-ServiceSetting UPDATE_CHECK 'false'
Assert-ServiceSetting WIFI_SCAN '0'
Assert-ServiceSetting RESET_PASSWORD 'true'
foreach ($addOn in $addOns) { & "Assert-$($addOn)AddOn" }

Write-Host 'The tray icon pauses, resumes and stops the service'
Assert-Tray
Assert-Website 8091

Write-Host 'Updating without options keeps them and closes the tray icon'
Start-Tray
Invoke-Installer "/i `"$NewerMsi`""
if (Get-Process den-watcher-tray -ErrorAction SilentlyContinue) { throw 'The update left the old tray icon running' }
$installed = @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' |
    Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -eq 'Den-Watcher' })
if ($installed.Count -ne 1) { throw "The update left $($installed.Count) installs of Den-Watcher, not 1" }
Assert-Website 8091
if (-not (Test-Path "$env:ProgramData\Usage Control\usage-control.db")) { throw 'The update deleted the history' }
Assert-ServiceSetting DISK_PATHS "$env:SystemDrive\"
Assert-ServiceSetting UPDATE_CHECK 'false'
Assert-ServiceSetting WIFI_SCAN '0'
Assert-ServiceSetting RESET_PASSWORD ''
foreach ($addOn in $addOns) { & "Assert-$($addOn)AddOn" }

Write-Host 'The older bugfix refuses to install over the newer one'
Assert-InstallerRefuses "/i `"$Msi`"" 'A newer bugfix of this version of Den-Watcher is already installed.'
Assert-Website 8091

Write-Host 'A repair with RESET_PASSWORD=true restarts the service with it, and one without it turns it off'
Start-Tray
$before = Get-ServiceProcessId
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m RESET_PASSWORD=true"
Assert-ServiceSetting RESET_PASSWORD 'true'
Assert-Website 8091
if ((Get-ServiceProcessId) -eq $before) { throw 'The repair did not restart the service' }
if (-not (Get-Process den-watcher-tray -ErrorAction SilentlyContinue)) { throw 'The repair closed the tray icon' }
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m"
Assert-ServiceSetting RESET_PASSWORD ''
Assert-ServiceSetting UPDATE_CHECK 'false'
Assert-Website 8091

Write-Host 'A repair refuses an UPDATE_CHECK the service cannot read and takes one it can'
Assert-InstallerRefuses "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m UPDATE_CHECK=no" 'UPDATE_CHECK must be true or false.'
Assert-ServiceSetting UPDATE_CHECK 'false'
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m UPDATE_CHECK=F"
Assert-ServiceSetting UPDATE_CHECK 'F'
Assert-Website 8091

Write-Host 'A repair with WEBSITE=0 turns the website off, and one with WEBSITE=1 on again'
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m WEBSITE=0"
Assert-ServiceSetting DATA_ONLY 'true'
$null = Get-Answer 'http://127.0.0.1:8091/api/metrics'
$status = Get-StatusCode 'http://127.0.0.1:8091/'
if ($status -ne 404) { throw "The website answered $status after the repair with WEBSITE=0; it should be off" }
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m WEBSITE=1"
Assert-ServiceSetting DATA_ONLY 'false'
Assert-Website 8091

Write-Host 'A repair refuses an add-on option other than 0 or 1, naming the repair that gives it'
Assert-InstallerRefuses "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m POWER=true" 'POWER must be 0 or 1.', ".msi`" REINSTALL=ALL REINSTALLMODE=m POWER=1"
if ((Get-ItemPropertyValue 'HKLM:\SOFTWARE\Usage Control' POWER) -ne '1') { throw 'The refused repair changed the remembered POWER' }
Assert-PowerAddOn

Write-Host 'A repair with POWER=0 removes the power add-on and keeps the others, and one with POWER=1 adds it again'
# The reports the add-ons left behind, so the checks below see new ones.
Remove-Item "$env:ProgramData\Usage Control\addons\*.json" -ErrorAction SilentlyContinue
# With the reduced user interface, as the wizard's actions bring the
# remembered options along as if they were given.
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m POWER=0" '/qr'
Wait-Until { -not (Get-Process den-watcher-power -ErrorAction SilentlyContinue) } 'the repair with POWER=0 stopped the power add-on'
if (Test-Path "$env:ProgramFiles\Den-Watcher\den-watcher-power.exe") {
    Show-InstallerLog 'den-watcher-power|UsageControlPower|Component: |Transitive|RemoveFiles|FileRemove|POWER|in use|reboot|REINSTALLMODE'
    throw 'The repair with POWER=0 left den-watcher-power.exe'
}
if ((Get-ItemPropertyValue 'HKLM:\SOFTWARE\Usage Control' POWER) -ne '0') { throw 'The repair did not remember POWER=0' }
foreach ($addOn in $addOns -ne 'Power') { & "Assert-$($addOn)AddOn" }
Assert-Website 8091
# The report the add-on left behind, so the check below sees a new one.
Remove-Item "$env:ProgramData\Usage Control\addons\power.json" -ErrorAction SilentlyContinue
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m POWER=1"
if (-not (Test-Path "$env:ProgramFiles\Den-Watcher\den-watcher-power.exe")) {
    Show-InstallerLog 'den-watcher-power|UsageControlPower|Component: |Transitive|InstallFiles|FileCopy|POWER|in use|reboot|REINSTALLMODE'
    throw 'The repair with POWER=1 did not install den-watcher-power.exe'
}
Assert-PowerAddOn
if ((Get-ItemPropertyValue 'HKLM:\SOFTWARE\Usage Control' POWER) -ne '1') { throw 'The repair did not remember POWER=1' }
Write-Host 'A repair without add-on options keeps the add-ons'
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m"
Assert-PowerAddOn
Assert-GpuAddOn
Assert-Website 8091

Write-Host 'A repair with RESET_PASSWORD=true and the reduced user interface leaves the tray icon running'
if (-not (Get-Process den-watcher-tray -ErrorAction SilentlyContinue)) { Start-Tray }
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m RESET_PASSWORD=true" '/qr'
Assert-ServiceSetting RESET_PASSWORD 'true'
if (-not (Get-Process den-watcher-tray -ErrorAction SilentlyContinue)) { throw 'The repair with the reduced user interface closed the tray icon' }
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m" '/qr'
Assert-ServiceSetting RESET_PASSWORD ''
if (-not (Get-Process den-watcher-tray -ErrorAction SilentlyContinue)) { throw 'The repair with the reduced user interface closed the tray icon' }
Assert-PowerAddOn
Assert-Website 8091

Write-Host 'A full repair, which replaces every file, keeps the add-ons and closes the tray icon'
Start-Tray
Remove-Item "$env:ProgramData\Usage Control\addons\*.json" -ErrorAction SilentlyContinue
Invoke-Installer "/fa `"$NewerMsi`""
if (Get-Process den-watcher-tray -ErrorAction SilentlyContinue) { throw 'The full repair left the tray icon running' }
foreach ($addOn in $addOns) { & "Assert-$($addOn)AddOn" }
Assert-Website 8091

Write-Host 'A bad remembered UPDATE_CHECK names the repair that fixes it, which does, and does not hold up an uninstall'
Set-ItemProperty 'HKLM:\SOFTWARE\Usage Control' -Name UPDATE_CHECK -Value 'no'
Assert-InstallerRefuses "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m" ".msi`" REINSTALL=ALL REINSTALLMODE=m UPDATE_CHECK=true"
Invoke-Installer "/i `"$NewerMsi`" REINSTALL=ALL REINSTALLMODE=m UPDATE_CHECK=true"
Assert-ServiceSetting UPDATE_CHECK 'true'
if ((Get-ItemPropertyValue 'HKLM:\SOFTWARE\Usage Control' UPDATE_CHECK) -ne 'true') { throw 'The repair did not rewrite the remembered UPDATE_CHECK' }
Set-ItemProperty 'HKLM:\SOFTWARE\Usage Control' -Name UPDATE_CHECK -Value 'no'

Write-Host 'Uninstalling with DELETE_HISTORY=1'
Invoke-Installer "/x `"$NewerMsi`" DELETE_HISTORY=1"
if (Get-Service UsageControl -ErrorAction SilentlyContinue) { throw 'The service is still installed' }
foreach ($addOn in $addOns -ne 'Smart') {
    if (Test-Path "$env:ProgramFiles\Den-Watcher\den-watcher-$($addOn.ToLower()).exe") { throw "The $($addOn.ToLower()) add-on is still installed" }
}
if (Get-Service UsageControlSmart -ErrorAction SilentlyContinue) { throw 'The smart add-on is still installed' }
if (Get-NetFirewallRule -DisplayName 'Den-Watcher' -ErrorAction SilentlyContinue) { throw 'The firewall rule is still there' }
if (Get-ItemProperty 'HKLM:\SOFTWARE\Usage Control' -Name PORT -ErrorAction SilentlyContinue) { throw 'The remembered options are still there' }
if (Test-Path $trayExe) { throw 'The tray program is still there' }
if (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' -Name 'Den-Watcher' -ErrorAction SilentlyContinue) { throw 'The tray icon still starts at login' }
if (Test-Path "$env:ProgramData\Usage Control") { throw 'The data folder is still there' }

Write-Host 'Installing with the defaults serves only the usage data'
Invoke-Installer "/i `"$Msi`""
$metrics = Get-Answer 'http://127.0.0.1:9393/api/metrics'
$metrics | ConvertTo-Json -Depth 4
if ($metrics.disks.Count -lt 1) { throw 'The system disk is missing from the metrics' }
$status = Get-StatusCode 'http://127.0.0.1:9393/'
if ($status -ne 404) { throw "The website answered $status; without WEBSITE=1 it should be off" }
Assert-FirewallPort 9393
Assert-ServiceSetting DATA_ONLY 'true'
foreach ($addOn in $addOns -ne 'Smart') {
    if (Test-Path "$env:ProgramFiles\Den-Watcher\den-watcher-$($addOn.ToLower()).exe") { throw "The $($addOn.ToLower()) add-on was installed without $($addOn.ToUpper())=1" }
}
if (Get-Service UsageControlSmart -ErrorAction SilentlyContinue) { throw 'The smart add-on was installed without SMART=1' }
Invoke-Installer "/x `"$Msi`""

Write-Host 'A router password is encrypted by the service and deleted from the registry'
Invoke-Installer "/i `"$Msi`" PORT=8092 WEBSITE=1 DEVICE_NAME=Runner HUB_DEVICES=Pi=192.168.1.20:9393 HUB_ROUTERS=Box=fritzbox:monitor@192.168.178.1 ROUTER_PASSWORDS=Box=not-in-the-clear DISK_PATHS=$env:SystemDrive\ UPDATE_CHECK=false"
Assert-Website 8092 'Runner, Pi, Box'
Assert-ServiceSetting HUB_ROUTERS 'Box=fritzbox:monitor@192.168.178.1'
$protected = "$env:ProgramData\Usage Control\router-passwords.dpapi"
Wait-Until { -not (Get-ItemProperty 'HKLM:\SOFTWARE\Usage Control\Router' -Name Passwords -ErrorAction SilentlyContinue) } 'the service deleted the router password from the registry'
if (-not (Test-Path $protected)) { throw 'The service did not store the router password' }
$bytes = [IO.File]::ReadAllBytes($protected)
if ([Text.Encoding]::ASCII.GetString($bytes).Contains('not-in-the-clear') -or [Text.Encoding]::Unicode.GetString($bytes).Contains('not-in-the-clear')) { throw 'The router password is stored in the clear' }
$shown = @(Show-InstallerLog 'not-in-the-clear')
if ($shown.Count -gt 0) {
    $shown -replace 'not-in-the-clear', '<password>'
    throw 'The installer log shows the router password, in the lines above'
}
# DATA_ONLY=false is what the setup wizard used to pass on after the
# remembered WEBSITE=1, which kept the website on. An empty option such as
# DISK_PATHS="" would count as not given, so a space clears it; PORT then
# goes back to 9393.
Invoke-Installer "/i `"$NewerMsi`" WEBSITE=0 DATA_ONLY=false DISK_PATHS=`" `" UPDATE_CHECK=`" `" PORT=`" `""
Assert-ServiceSetting DATA_ONLY 'true'
Assert-ServiceSetting HUB_DEVICES ''
Assert-ServiceSetting HUB_ROUTERS ''
Assert-ServiceSetting DISK_PATHS ' '
Assert-ServiceSetting UPDATE_CHECK ' '
Assert-ServiceSetting LISTEN_ADDR ':9393'
Assert-FirewallPort 9393
$null = Get-Answer 'http://127.0.0.1:9393/api/metrics'
$status = Get-StatusCode 'http://127.0.0.1:9393/'
if ($status -ne 404) { throw "The website answered $status after the update with WEBSITE=0; it should be off" }
if (-not (Test-Path $protected)) { throw 'The update deleted the stored router password' }
Invoke-Installer "/x `"$NewerMsi`""
if (Test-Path $protected) { throw 'Uninstalling left the router password behind' }
if (-not (Test-Path "$env:ProgramData\Usage Control\usage-control.db")) { throw 'Uninstalling without DELETE_HISTORY=1 deleted the history' }

Write-Host 'The installer works'
