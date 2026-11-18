# Checks on a Windows machine, as an administrator, that the installer
# updates 4.0.0, the last version with the names from before den-watcher:
# installs OldMsi with the website on another port and the power add-on,
# updates it to Msi without options and checks there is one install, that it
# kept the port and the add-on, that its service and add-on host now run
# under their new names, that the history moved from C:\ProgramData\Usage
# Control\usage-control.db to C:\ProgramData\Den-Watcher\den-watcher.db, and
# that the old folder, services and registry key are gone; then uninstalls it
# with DELETE_HISTORY=1, so windows/check-installer.ps1 starts clean.
#
#   pwsh windows/check-upgrade-from-4.0.0.ps1 -OldMsi den-watcher-4.0.0-x64.msi -Msi den-watcher-255.0.0-x64.msi
param(
    [Parameter(Mandatory)] [string] $OldMsi,
    # An installer with a version above the old one's.
    [Parameter(Mandatory)] [string] $Msi
)

$ErrorActionPreference = 'Stop'
$OldMsi = (Resolve-Path $OldMsi).Path
$Msi = (Resolve-Path $Msi).Path
$oldFolder = "$env:ProgramData\Usage Control"
$folder = "$env:ProgramData\Den-Watcher"

function Invoke-Installer([string] $Arguments) {
    $process = Start-Process msiexec.exe -ArgumentList "$Arguments /qn /l*v msiexec.log" -PassThru
    # An installer waiting on a dialog no one answers would never end.
    if (-not $process.WaitForExit(300000)) {
        $process.Kill($true)
        Get-Content msiexec.log -Tail 80
        throw "msiexec $Arguments did not end within 5 minutes, as if waiting on a dialog"
    }
    if ($process.ExitCode -ne 0) {
        Get-Content msiexec.log -Tail 80
        throw "msiexec $Arguments failed with exit code $($process.ExitCode)"
    }
}

# Waits for the service to answer, as it takes a moment to start.
function Get-Answer([string] $Url, [string] $Service) {
    foreach ($try in 1..30) {
        try { return Invoke-RestMethod $Url } catch { Start-Sleep -Seconds 1 }
    }
    Get-Service $Service | Format-List
    throw "The service did not answer $Url"
}

function Get-Installed([string] $Name) {
    @(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' |
        Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -eq $Name })
}

Write-Host 'Installing 4.0.0'
Invoke-Installer "/i `"$OldMsi`" WEBSITE=1 PORT=8092 POWER=1 UPDATE_CHECK=false"
Get-Answer 'http://127.0.0.1:8092/api/metrics' 'UsageControl' | Out-Null
if (-not (Test-Path "$oldFolder\usage-control.db")) { throw '4.0.0 created no history database' }

Write-Host 'Updating it without options keeps them and moves the history'
Invoke-Installer "/i `"$Msi`""
if ((Get-Installed 'Den-Watcher').Count -ne 1) { throw 'Windows does not list one install named Den-Watcher' }
$metrics = Get-Answer 'http://127.0.0.1:8092/api/metrics' 'DenWatcher'
if (-not $metrics.version) { throw 'The updated service does not report its version' }
if (Get-Service UsageControl -ErrorAction SilentlyContinue) { throw 'The update left the service UsageControl' }
$service = (Get-CimInstance Win32_Service -Filter "Name = 'DenWatcher'").ProcessId
if (-not $service) { throw 'No service named DenWatcher runs' }
foreach ($try in 1..30) {
    # The service starts the add-ons through the add-on host, a den-watcher.exe of its own.
    $hosts = @(Get-CimInstance Win32_Process -Filter "Name = 'den-watcher.exe'" | Where-Object ParentProcessId -eq $service).ProcessId
    $addOn = @(Get-CimInstance Win32_Process -Filter "Name = 'den-watcher-power.exe'" | Where-Object { $_.ParentProcessId -in $hosts })
    if ($addOn.Count -eq 1) { break }
    Start-Sleep -Seconds 1
}
if ($addOn.Count -ne 1) { throw 'The update lost the power add-on, which the service should run through its add-on host' }
foreach ($try in 1..30) {
    if ((Test-Path "$folder\den-watcher.db") -and -not (Test-Path $oldFolder)) { break }
    Start-Sleep -Seconds 1
}
if (-not (Test-Path "$folder\den-watcher.db")) { throw 'The update did not move the history to den-watcher.db' }
if (Test-Path $oldFolder) {
    Get-ChildItem -Recurse $oldFolder | Format-List FullName
    throw 'The old data folder is still there'
}
if (Test-Path 'HKLM:\SOFTWARE\Usage Control') { throw 'The old registry key is still there' }
if ((Get-ItemProperty 'HKLM:\SOFTWARE\Den-Watcher').PORT -ne '8092') { throw 'The new registry key does not remember the port' }
foreach ($try in 1..30) {
    if (Test-Path "$folder\addons\power.json") { break }
    Start-Sleep -Seconds 1
}
if (-not (Test-Path "$folder\addons\power.json")) { throw 'The power add-on writes no report to the new add-on folder' }

Invoke-Installer "/x `"$Msi`" DELETE_HISTORY=1"
if (Test-Path $folder) {
    Get-ChildItem -Recurse -Force $folder | Format-List FullName
    Select-String -Path msiexec.log -Pattern 'DeleteHistory|WixQuietExec|StopServices' | ForEach-Object Line
    icacls "$folder\den-watcher.db"
    Get-Process | Where-Object { $_.Path -like '*Den-Watcher*' } | Format-List Name, Path
    throw 'The data folder is still there'
}
Write-Host 'The update from 4.0.0 keeps the options and the power add-on and moves the history to the new names.'
