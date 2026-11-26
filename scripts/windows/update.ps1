<#
.SYNOPSIS  Update Clipper Studio from its git remote, safely.
.DESCRIPTION
  Refuses to run with uncommitted changes or while the studio is running. Takes a data backup first,
  fast-forwards only (never rewrites local history), reinstalls locked dependencies, then runs the
  type check. If anything fails, your data is untouched and the backup path is printed.
#>
[CmdletBinding()]
param([switch] $SkipBackup)
. (Join-Path $PSScriptRoot 'common.ps1')
Push-Location -LiteralPath $Root
try {
    if (Test-PortListening $Port) { throw 'Stop Studio first (scripts\windows\stop.ps1).' }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git was not found on PATH.' }
    if (git status --porcelain) { throw 'Uncommitted changes found. Commit or stash them before updating.' }
    if (-not $SkipBackup) { & (Join-Path $PSScriptRoot 'backup.ps1') }
    git fetch --prune
    if ($LASTEXITCODE -ne 0) { throw 'git fetch failed (no internet?).' }
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw 'Cannot fast-forward. Resolve manually; nothing was changed.' }
    npm ci --include=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Type check failed after update.' }
    Write-Host 'Updated. Run npm run build if you use start.ps1 -Production.'
} finally { Pop-Location }
