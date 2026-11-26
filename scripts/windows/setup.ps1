<#
.SYNOPSIS  Install or repair Clipper Studio dependencies (this script itself needs no administrator rights).
.DESCRIPTION
  Delegates to Install-Clipper.ps1 in the repository root, which you can read before running. It
  checks Node.js, FFmpeg, FFprobe, yt-dlp and Ollama, installs missing tools through winget,
  installs npm packages from package-lock.json, and writes .env.local.
  No remote script is piped into a shell. Ollama models are never pulled without a prompt.
.PARAMETER Launch  Start the studio when setup finishes (default: do not launch).
#>
[CmdletBinding()]
param([switch] $Launch)
. (Join-Path $PSScriptRoot 'common.ps1')
$installer = Join-Path $Root 'Install-Clipper.ps1'
if (-not (Test-Path -LiteralPath $installer)) { throw "Install-Clipper.ps1 not found in $Root" }
$forward = @()
if (-not $Launch) { $forward += '-NoLaunch' }
& $installer @forward
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host ''
Write-Host 'Next: run scripts\windows\doctor.ps1 to verify, then scripts\windows\start.ps1.'
