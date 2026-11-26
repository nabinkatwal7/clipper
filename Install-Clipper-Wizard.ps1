# The setup engine stays usable from a terminal for unattended installs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing, System.Net.Http
[Windows.Forms.Application]::EnableVisualStyles()

$studioUrl = 'http://127.0.0.1:4000'
$worker = Join-Path $PSScriptRoot 'Install-Clipper.ps1'
$shell = Join-Path $PSHOME 'powershell.exe'
$storeUrl = 'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'
$stageNames = @(
    'Check this PC'
    'Set up video tools'
    'Set up automatic subtitles'
    'Install Clipper Studio'
    'Prepare local AI'
    'Open Studio'
)
$stageNotes = @(
    'Checking Windows and Node.js. If Windows asks to allow an installer, choose Yes to continue.'
    'Installing the tools that import, preview, and export videos.'
    'Downloading the speech model that creates subtitles on your PC.'
    'Installing the files Clipper Studio needs to run.'
    'Downloading the models for clip suggestions and search. This is usually the longest step.'
    'Waiting for Studio to load. The first start can take a few minutes.'
)

$form = New-Object Windows.Forms.Form
$form.Text = 'Clipper Studio Setup'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = [Drawing.Size]::new(650, 520)
$form.AutoScaleMode = 'Dpi'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = [Drawing.Color]::White
$form.ForeColor = [Drawing.ColorTranslator]::FromHtml('#171717')
$form.Font = [Drawing.Font]::new('Segoe UI', 10)

function Add-Label($text, $x, $y, $width, $height) {
    $label = New-Object Windows.Forms.Label
    $label.Text = $text
    $label.SetBounds($x, $y, $width, $height)
    $form.Controls.Add($label)
    return $label
}

function Add-Button($text, $x, $y, $width) {
    $button = New-Object Windows.Forms.Button
    $button.Text = $text
    $button.SetBounds($x, $y, $width, 38)
    $form.Controls.Add($button)
    return $button
}

$name = Add-Label 'CLIPPER STUDIO' 27 23 585 24
$name.ForeColor = [Drawing.ColorTranslator]::FromHtml('#B80016')
$name.Font = [Drawing.Font]::new('Segoe UI', 10, [Drawing.FontStyle]::Bold)
$title = Add-Label 'Set up Clipper Studio' 25 51 595 44
$title.Font = [Drawing.Font]::new('Segoe UI', 23, [Drawing.FontStyle]::Bold)
$description = Add-Label 'Choose Install and open Studio to set up video editing, local AI, and subtitles. Keep this window open during setup. The first install needs internet and downloads several gigabytes.' 27 106 595 63

$progress = New-Object Windows.Forms.ProgressBar
$progress.Maximum = $stageNames.Count
$progress.SetBounds(28, 178, 594, 12)
$progress.AccessibleName = 'Completed setup steps'
$form.Controls.Add($progress)

$steps = @()
for ($index = 0; $index -lt $stageNames.Count; $index++) {
    $steps += (Add-Label "$($index + 1).  $($stageNames[$index])" 28 (205 + 28 * $index) 594 26)
}
$status = Add-Label 'Already installed? Use Open existing Studio.' 28 382 594 53
$status.AccessibleName = 'Setup status'
$details = New-Object Windows.Forms.TextBox
$details.Multiline = $true
$details.ReadOnly = $true
$details.WordWrap = $false
$details.ScrollBars = 'Both'
$details.Font = [Drawing.Font]::new('Consolas', 9)
$details.SetBounds(28, 205, 594, 168)
$details.Visible = $false
$details.AccessibleName = 'Technical setup details'
$form.Controls.Add($details)

$showDetails = Add-Button 'Show details' 28 458 122
$showDetails.Enabled = $false
$store = Add-Button 'Get App Installer' 169 458 170
$store.Visible = $false
$secondary = Add-Button 'Open existing Studio' 169 458 186
$primary = Add-Button 'Install and open Studio' 374 458 248
$primary.BackColor = [Drawing.ColorTranslator]::FromHtml('#C81024')
$primary.ForeColor = [Drawing.Color]::White
$primary.FlatStyle = 'Flat'
$primary.FlatAppearance.BorderSize = 0
$form.AcceptButton = $primary
$installed = Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\.clipper-setup-complete')
if ($installed) {
    $title.Text = 'Welcome back'
    $description.Text = 'Clipper Studio is installed. Choose Open Studio to launch it in your browser.'
    $status.Text = 'Use Repair setup if you need to reinstall the tools.'
    $primary.Text = 'Open Studio'
    $secondary.Text = 'Repair setup'
}

$state = @{
    Phase = 'Welcome'
    Stage = 0
    LaunchOnly = $false
    Run = $null
    Request = $null
    Started = [DateTime]::UtcNow
    Log = ''
}
$handler = New-Object Net.Http.HttpClientHandler
$handler.UseProxy = $false
$http = [Net.Http.HttpClient]::new($handler)
$http.Timeout = [TimeSpan]::FromSeconds(4)
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 500

function Show-Step([int] $number) {
    $state.Stage = $number
    $progress.Value = [Math]::Max(0, $number - 1)
    for ($i = 0; $i -lt $steps.Count; $i++) {
        $suffix = ''
        if ($state.LaunchOnly -and $i -lt 5) { $suffix = '  (skipped)' }
        elseif ($i -lt ($number - 1)) { $suffix = '  (done)' }
        elseif ($i -eq ($number - 1)) { $suffix = '  (in progress)' }
        $steps[$i].Text = "$($i + 1).  $($stageNames[$i])$suffix"
    }
    if ($number -le $stageNotes.Count) { $description.Text = $stageNotes[$number - 1] }
    if ($state.LaunchOnly -and $number -le $stageNames.Count) { $progress.Value = 0 }
}

function Read-WorkerLog {
    $lines = foreach ($path in @($state.Log, "$($state.Log).errors")) {
        if (Test-Path -LiteralPath $path) {
            Get-Content -LiteralPath $path -Tail 70 -ErrorAction SilentlyContinue
        }
    }
    return ($lines -join "`r`n")
}

function Start-Worker([string] $mode, [string] $windowStyle) {
    $state.Log = Join-Path ([IO.Path]::GetTempPath()) "clipper-setup-$([guid]::NewGuid().ToString('N')).log"
    $state.Started = [DateTime]::UtcNow
    $state.Run = Start-Process -FilePath $shell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$worker`" $mode -ReportStages" `
        -WorkingDirectory $PSScriptRoot -WindowStyle $windowStyle -PassThru `
        -RedirectStandardOutput $state.Log -RedirectStandardError "$($state.Log).errors"
}

function Open-Studio {
    try { Start-Process $studioUrl }
    catch { $status.Text = "Open your browser and paste $studioUrl into the address bar." }
}

function Show-Failure([string] $message, [string] $log) {
    $timer.Stop()
    $state.Phase = 'Failed'
    $title.Text = 'Setup needs your help'
    $description.Text = $message
    $status.Text = 'Your existing projects are safe. After fixing the issue, choose Try again.'
    $details.Text = $log
    $showDetails.Enabled = $true
    $primary.Text = 'Try again'
    $primary.Enabled = $true
    $store.Visible = $log -match 'Microsoft Store to enable WinGet'
    $secondary.Visible = !$store.Visible
    $secondary.Enabled = $true
    $secondary.Text = if ($state.LaunchOnly) { 'Install Studio' } else { 'Open existing Studio' }
}

function Start-StudioStep {
    $state.Phase = 'Opening'
    $state.Request = $null
    $title.Text = 'Opening Clipper Studio'
    Show-Step 6
    Start-Worker '-LaunchOnly' 'Minimized'
}

function Start-Setup([bool] $launchOnly) {
    $state.LaunchOnly = $launchOnly
    $state.Run = $null
    $primary.Enabled = $false
    $secondary.Enabled = $false
    $store.Visible = $false
    $secondary.Visible = $true
    $showDetails.Enabled = $true
    $details.Clear()
    try {
        if ($launchOnly) {
            Start-StudioStep
        } else {
            $state.Phase = 'Installing'
            $title.Text = 'Installing Clipper Studio'
            Show-Step 1
            Start-Worker '-NoLaunch' 'Hidden'
        }
        $timer.Start()
    } catch {
        Show-Failure 'Windows could not start setup. Extract the full project to a folder you can write to, then try again.' $_.Exception.Message
    }
}

$primary.Add_Click({
    if ($state.Phase -eq 'Ready') { Open-Studio }
    else { Start-Setup (($state.Phase -eq 'Failed' -and $state.LaunchOnly) -or ($state.Phase -eq 'Welcome' -and $installed)) }
})
$secondary.Add_Click({
    if ($state.Phase -eq 'Ready') { $form.Close() }
    elseif ($state.Phase -eq 'Welcome') { Start-Setup (!$installed) }
    else { Start-Setup (!$state.LaunchOnly) }
})
$store.Add_Click({
    try { Start-Process $storeUrl }
    catch { $status.Text = 'Open the Microsoft Store from the Start menu and search for App Installer.' }
})
$showDetails.Add_Click({
    $details.Visible = !$details.Visible
    foreach ($step in $steps) { $step.Visible = !$details.Visible }
    $showDetails.Text = if ($details.Visible) { 'Show steps' } else { 'Show details' }
})

$timer.Add_Tick({
    try {
        $log = Read-WorkerLog
        $plainLog = $log -replace '(?m)^CLIPPER_SETUP_STAGE=\d+\s*$', ''
        if ($details.Text -ne $plainLog) {
            $details.Text = $plainLog
            $details.SelectionStart = $details.TextLength
            $details.ScrollToCaret()
        }
        $run = $state.Run
        $elapsed = [DateTime]::UtcNow - $state.Started
        $status.Text = "Step $($state.Stage) of $($stageNames.Count)   |   Elapsed $($elapsed.ToString('hh\:mm\:ss'))"
        if ($state.Phase -eq 'Installing') {
            $markers = [regex]::Matches($log, '(?m)^CLIPPER_SETUP_STAGE=([1-5])\s*$')
            if ($markers.Count) {
                $stage = [int] $markers[$markers.Count - 1].Groups[1].Value
                if ($stage -gt $state.Stage) { Show-Step $stage }
            }
            if ($run.HasExited -and $run.ExitCode -eq 0) { Start-StudioStep }
        } elseif ($state.Phase -eq 'Opening') {
            if ($state.Request -and $state.Request.IsCompleted) {
                if ($state.Request.Status -eq 'RanToCompletion' -and $state.Request.Result -match 'Clipper Studio') {
                    $timer.Stop()
                    Show-Step 7
                    $state.Phase = 'Ready'
                    $title.Text = 'Studio is ready'
                    $description.Text = 'In your browser, choose Get started to create your first account. If you already have an account, sign in.'
                    $status.Text = "Studio is open at $studioUrl. You can close this setup window."
                    $primary.Text = 'Open Studio in browser'
                    $primary.Enabled = $true
                    $secondary.Text = 'Close setup'
                    $secondary.Enabled = $true
                    Open-Studio
                    return
                }
                $state.Request = $null
            }
            if (!$state.Request) { $state.Request = $http.GetStringAsync($studioUrl) }
            if ($elapsed.TotalMinutes -gt 4) {
                Show-Failure 'Studio is taking longer than expected. Check the details or the minimized Studio window, then try again.' $log
                return
            }
        }
        if ($run.HasExited -and $run.ExitCode -ne 0) {
            $log = Read-WorkerLog
            $message = 'Check your internet connection and free disk space. Open Show details to see which tool needs attention.'
            if ($log -match 'Microsoft Store to enable WinGet') {
                $message = 'This PC needs Microsoft App Installer. Choose Get App Installer, install or update it in the Store, then choose Try again.'
            } elseif ($log -match 'Close the Studio server') {
                $message = 'Studio is already running. Choose Open existing Studio, or close the Studio terminal window before reinstalling.'
            } elseif ($log -match 'Studio dependencies are missing|Run Install-Clipper.cmd to finish setup') {
                $message = 'Studio still needs to be installed. Choose Install Studio below to set it up.'
            } elseif ($log -match 'Port 4000') {
                $message = 'Another app is using the address Studio needs. Close that app, then choose Try again.'
            }
            Show-Failure $message $log
        }
    } catch {
        Show-Failure 'Setup could not finish. View the details, then try again.' $_.Exception.Message
    }
})

$form.Add_FormClosing({
    param($sender, $eventArgs)
    if ($state.Phase -eq 'Installing') {
        $eventArgs.Cancel = $true
        $status.Text = 'Setup is still installing tools. Keep this window open until it finishes.'
    }
})

try { [void] $form.ShowDialog() }
finally {
    $timer.Dispose()
    $http.Dispose()
    $form.Dispose()
}
