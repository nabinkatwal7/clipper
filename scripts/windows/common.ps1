# Shared helpers for the Clipper Studio management scripts. Dot-sourced; not run directly.
$ErrorActionPreference = 'Stop'
$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:Port = 4000
$script:Url = "http://127.0.0.1:$Port"

function Get-ClipperSetting([string] $Name, [string] $Default = '') {
    $file = Join-Path $script:Root '.env.local'
    if (Test-Path -LiteralPath $file) {
        $line = Get-Content -LiteralPath $file | Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } | Select-Object -Last 1
        if ($line) { return ($line -replace '^[^=]+=', '').Trim().Trim('"') }
    }
    return $Default
}
function Get-StorageDir {
    $dir = Get-ClipperSetting 'CLIPPER_STORAGE_DIR' ''
    if ($dir) { return $dir }
    return Join-Path $script:Root 'storage'
}
function Test-PortListening([int] $Port) {
    return [bool] ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $Port })
}
function Get-PidFile { Join-Path (Get-StorageDir) 'studio.pid' }
