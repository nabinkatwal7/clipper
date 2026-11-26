<#
.SYNOPSIS  Check that Clipper Studio's dependencies and resources are in place. Read-only.
.DESCRIPTION
  Reports measured values only: tool versions, installed Ollama models, RAM, CPU, free disk,
  H.264 encoders FFmpeg lists (listed does not mean working on your hardware), and the port.
  Exit code 1 when a required component is missing.
#>
[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
$script:failed = $false
function Row($name, $status, $detail) { Write-Host ('{0,-18} {1,-8} {2}' -f $name, $status, $detail) }
function Probe($name, $cmd, $argList, [bool] $required) {
    if (-not (Test-Path -LiteralPath $cmd) -and -not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        if ($required) { $script:failed = $true }
        Row $name $(if ($required) { 'MISSING' } else { 'absent' }) "not found: $cmd"
        return $null
    }
    try {
        $out = (& $cmd @argList 2>&1 | Select-Object -First 1) | Out-String
        Row $name 'ok' $out.Trim()
        return $cmd
    } catch {
        if ($required) { $script:failed = $true }
        Row $name 'ERROR' $_.Exception.Message
        return $null
    }
}
Write-Host "Clipper Studio doctor - $Root"
Write-Host ''
[void](Probe 'Node.js' 'node' @('--version') $true)
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) { [void](Probe 'npm' $npmCmd.Source @('--version') $true) }
else { $script:failed = $true; Row 'npm' 'MISSING' 'npm was not found on PATH' }
$ff = Probe 'FFmpeg' (Get-ClipperSetting 'FFMPEG_BIN' 'ffmpeg') @('-version') $true
[void](Probe 'FFprobe' (Get-ClipperSetting 'FFPROBE_BIN' 'ffprobe') @('-version') $true)
[void](Probe 'yt-dlp' (Get-ClipperSetting 'YTDLP_BIN' 'yt-dlp') @('--version') $false)
if ($ff) {
    $enc = (& $ff -hide_banner -encoders 2>$null | Out-String)
    $found = @('libx264', 'h264_qsv', 'h264_nvenc', 'h264_amf') | Where-Object { $enc -match $_ }
    Row 'H.264 encoders' $(if ($found -contains 'libx264') { 'ok' } else { 'WARN' }) ('listed: ' + ($found -join ', ') + ' (hardware encoders are listed, not tested)')
}
$ollamaUrl = Get-ClipperSetting 'OLLAMA_URL' 'http://127.0.0.1:11434'
try {
    $tags = Invoke-RestMethod -Uri "$ollamaUrl/api/tags" -TimeoutSec 4
    $names = @($tags.models | ForEach-Object { $_.name })
    Row 'Ollama' 'ok' "$ollamaUrl - $($names.Count) model(s): $($names -join ', ')"
} catch { Row 'Ollama' 'absent' "not reachable at $ollamaUrl (optional: Instant mode works without it)" }
$os = Get-CimInstance Win32_OperatingSystem
$ramGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
Row 'Memory' $(if ($ramGb -ge 8) { 'ok' } else { 'WARN' }) "$ramGb GB total, $freeGb GB free"
Row 'CPU' 'info' "$($cpu.Name.Trim()), $($cpu.NumberOfLogicalProcessors) logical cores"
$suggest = if ($ramGb -lt 12) { 'Eco or Balanced (Performance is not recommended below 12 GB)' } else { 'Balanced or Performance' }
Row 'Suggested profile' 'info' $suggest
$qualifier = Split-Path -Qualifier (Get-StorageDir) -ErrorAction SilentlyContinue
if ($qualifier) {
    $drive = Get-PSDrive -Name $qualifier.TrimEnd(':') -ErrorAction SilentlyContinue
    if ($drive) { Row 'Disk' $(if ($drive.Free -gt 5GB) { 'ok' } else { 'WARN' }) ('{0:N1} GB free on {1}:' -f ($drive.Free / 1GB), $drive.Name) }
}
Row 'Config' $(if (Test-Path (Join-Path $Root '.env.local')) { 'ok' } else { 'WARN' }) '.env.local'
Row 'Dependencies' $(if (Test-Path (Join-Path $Root 'node_modules\next\package.json')) { 'ok' } else { 'MISSING' }) 'node_modules'
Row 'Port 4000' 'info' $(if (Test-PortListening $Port) { 'in use (Studio may be running)' } else { 'free' })
Write-Host ''
if ($script:failed) { Write-Host 'Required components are missing. Run scripts\windows\setup.ps1.'; exit 1 }
Write-Host 'All required components found.'
