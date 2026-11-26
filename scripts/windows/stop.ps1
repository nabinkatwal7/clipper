<#
.SYNOPSIS  Stop the Clipper Studio process that start.ps1 launched.
.DESCRIPTION
  Stops only the process tree recorded in studio.pid, and only if that pid is still a node/npm/cmd process.
  Running render or analysis jobs are cancelled; finished analysis chunks are reused on the next run.
#>
[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
$pidFile = Get-PidFile
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'No studio.pid found. Nothing to stop.'; exit 0 }
$id = [int] (Get-Content -LiteralPath $pidFile -Raw).Trim()
$proc = Get-Process -Id $id -ErrorAction SilentlyContinue
if (-not $proc) { Remove-Item -LiteralPath $pidFile -Force; Write-Host 'The recorded process is already gone.'; exit 0 }
if ($proc.ProcessName -notmatch '^(node|npm|cmd)$') { Write-Warning "Pid $id is '$($proc.ProcessName)', not Studio. Not stopping it."; exit 1 }
& taskkill.exe /PID $id /T /F | Out-Null
Remove-Item -LiteralPath $pidFile -Force
Write-Host 'Clipper Studio stopped.'
