<#
.SYNOPSIS  Create a ZIP backup of Clipper Studio data.
.PARAMETER Destination  Output folder (default: <repo>\backups).
.PARAMETER IncludeSources  Also include original source videos (large).
.DESCRIPTION
  Includes accounts (password HASHES, never plaintext), workspaces, projects, clips, assets, transcripts and saved data.
  Excludes rebuildable caches (temp\), logs, proxies, partial files and login sessions.
  The ZIP holds personal data: store it somewhere private.
#>
[CmdletBinding()]
param([string] $Destination, [switch] $IncludeSources)
. (Join-Path $PSScriptRoot 'common.ps1')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$storage = (Resolve-Path (Get-StorageDir)).Path
if (-not $Destination) { $Destination = Join-Path $Root 'backups' }
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
if (Test-PortListening $Port) { Write-Warning 'Studio is running. Writes are atomic, but stop it for a fully consistent backup.' }
$out = Join-Path $Destination ("clipper-backup-{0:yyyyMMdd-HHmmss}.zip" -f (Get-Date))
$excluded = [regex] '\\(temp|logs)\\|\\auth\\sessions\\|\.proxy\.mp4$|\.tmp$|studio\.pid$'
$zip = [IO.Compression.ZipFile]::Open($out, 'Create')
$count = 0
$bytes = 0
try {
    Get-ChildItem -LiteralPath $storage -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($storage.Length).TrimStart('\')
        if ($excluded.IsMatch('\' + $rel)) { return }
        if (-not $IncludeSources -and $rel -match '(^|\\)uploads\\') { return }
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel.Replace('\', '/'), 'Optimal')
        $count++
        $bytes += $_.Length
    }
} finally { $zip.Dispose() }
Write-Host ("Backup written: {0} ({1} files, {2:N1} MB before compression)" -f $out, $count, ($bytes / 1MB))
if (-not $IncludeSources) { Write-Host 'Original source videos were not included (use -IncludeSources).' }
