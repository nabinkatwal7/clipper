<#
.SYNOPSIS  Start Clipper Studio in the background, bound to 127.0.0.1 only.
.PARAMETER Production  Run the built app (npm run build first) instead of the development server.
.DESCRIPTION
  Writes the process id to <storage>\studio.pid and logs to <storage>\logs\studio.log.
  The app only accepts localhost requests; this script never opens the port to the network.
  Scheduled work (creator checks, automation) only runs while this process is running.
#>
[CmdletBinding()]
param([switch] $Production)
. (Join-Path $PSScriptRoot 'common.ps1')
if (Test-PortListening $Port) { Write-Host "Something is already listening on port $Port ($Url)."; exit 0 }
if (-not (Test-Path -LiteralPath (Join-Path $Root 'node_modules\next\package.json'))) { throw 'Dependencies are missing. Run scripts\windows\setup.ps1 first.' }
if ($Production -and -not (Test-Path -LiteralPath (Join-Path $Root '.next\BUILD_ID'))) { throw 'No production build found. Run: npm run build' }
$logs = Join-Path (Get-StorageDir) 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { throw 'npm was not found on PATH.' }
$mode = if ($Production) { 'start' } else { 'dev' }
$log = Join-Path $logs 'studio.log'
$p = Start-Process -FilePath $npm.Source -ArgumentList @('run', $mode) -WorkingDirectory $Root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $log -RedirectStandardError (Join-Path $logs 'studio.err.log')
Set-Content -LiteralPath (Get-PidFile) -Value $p.Id
Write-Host "Starting Clipper Studio (pid $($p.Id)) ..."
for ($i = 0; $i -lt 90; $i++) {
    if ($p.HasExited) { throw "The server exited early. See $log and studio.err.log" }
    if (Test-PortListening $Port) { Write-Host "Ready: $Url"; exit 0 }
    Start-Sleep -Seconds 1
}
throw "Timed out waiting for port $Port. See $log"
