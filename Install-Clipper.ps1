[CmdletBinding(DefaultParameterSetName = 'Install')]
param(
    [Parameter(ParameterSetName = 'Install')]
    [switch] $NoLaunch,
    [Parameter(Mandatory, ParameterSetName = 'Launch')]
    [switch] $LaunchOnly,
    [switch] $ReportStages
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$envFile = Join-Path $PSScriptRoot '.env.local'
$studioUrl = 'http://127.0.0.1:4000'

function Write-SetupStage([int] $number) {
    if ($ReportStages) { Write-Host "CLIPPER_SETUP_STAGE=$number" }
}

function Get-Setting($name, $default) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) { return $value }
    if (Test-Path -LiteralPath $envFile) {
        $matchLine = Get-Content -LiteralPath $envFile |
            Select-String -Pattern "^\s*(?:export\s+)?$name\s*=\s*(.*)" |
            Select-Object -Last 1
        if ($matchLine) {
            $raw = $matchLine.Matches[0].Groups[1].Value.Trim()
            if ($raw -match '^("([^"]*)"|''([^'']*)''|`([^`]*)`)') {
                $value = $Matches[1].Substring(1, $Matches[1].Length - 2)
            } else {
                $value = ($raw -split '#', 2)[0].Trim()
            }
            if ($value) { return $value }
        }
    }
    return $default
}

function Update-SetupPath {
    $paths = @($env:Path, [Environment]::GetEnvironmentVariable('Path', 'Machine'),
        [Environment]::GetEnvironmentVariable('Path', 'User'),
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links", "$env:ProgramFiles\nodejs",
        "$env:LOCALAPPDATA\Programs\Ollama", "$env:USERPROFILE\.deno\bin")
    $env:Path = (($paths -split ';' | Where-Object { $_ } |
        ForEach-Object { [Environment]::ExpandEnvironmentVariables($_) } |
        Select-Object -Unique) -join ';')
}

function Find-Tool($candidates, $versionArgument, $versionPattern = '.') {
    foreach ($candidate in $candidates) {
        $commands = Get-Command -Name $candidate -CommandType Application -All -ErrorAction SilentlyContinue
        foreach ($command in $commands) {
            $previousPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = 'Continue'
                $version = (& $command.Source $versionArgument 2>&1 | Out-String)
                if ($LASTEXITCODE -eq 0 -and $version -match $versionPattern) { return $command.Source }
            } finally {
                $ErrorActionPreference = $previousPreference
            }
        }
    }
}

function Invoke-Checked($command, [string[]] $arguments) {
    & $command @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$([IO.Path]::GetFileName($command)) failed with exit code $LASTEXITCODE."
    }
}

function Install-Package($id) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (!$winget) {
        throw 'Install or update App Installer from the Microsoft Store to enable WinGet, then run setup again.'
    }
    Write-Host "Installing $id through WinGet..."
    Invoke-Checked $winget.Source @('install', '--id', $id, '--exact', '--source', 'winget',
        '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
    Update-SetupPath
}

function Get-Tool($label, $id, $candidates, $versionArgument, $versionPattern = '.') {
    $command = Find-Tool $candidates $versionArgument $versionPattern
    if (!$command -and !$LaunchOnly) {
        Install-Package $id
        $command = Find-Tool $candidates $versionArgument $versionPattern
    }
    if (!$command) { throw "$label is unavailable. Run Install-Clipper.cmd to finish setup, then reopen the terminal if needed." }
    Write-Host "Found $label"
    return $command
}

function Save-Download($url, $target, $sha256) {
    $temporary = "$target.download"
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $temporary
        if ((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash -ne $sha256) {
            throw "SHA-256 verification failed for $([IO.Path]::GetFileName($target))."
        }
        Move-Item -LiteralPath $temporary -Destination $target -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    }
}

function Install-Speech {
    $speechDir = Join-Path $PSScriptRoot 'tools\whisper'
    $runtime = Join-Path $speechDir 'runtime'
    $binary = Get-Setting 'CLIPPER_SPEECH_BIN' ''
    if (!$binary -and (Test-Path -LiteralPath $runtime)) {
        $binary = Get-ChildItem -LiteralPath $runtime -Filter 'whisper-cli.exe' -Recurse -File |
            Select-Object -First 1 -ExpandProperty FullName
    }
    $model = Get-Setting 'CLIPPER_SPEECH_MODEL' (Join-Path $speechDir 'ggml-base.bin')
    if (!(Test-Path -LiteralPath $speechDir)) {
        New-Item -ItemType Directory -Path $speechDir -Force | Out-Null
    }
    if (!$binary) {
        $archive = Join-Path $speechDir 'windows.zip'
        $archiveHash = '6BA69E3482D7826214F90A6A9C84CA07782AEC1E1D0C6A7C30C994FD5D816CCB'
        if (!(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive).Hash -ne $archiveHash) {
            Write-Host 'Downloading whisper.cpp for Windows x64...'
            Save-Download 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip' $archive $archiveHash
        }
        Expand-Archive -LiteralPath $archive -DestinationPath $runtime -Force
        $binary = Get-ChildItem -LiteralPath $runtime -Filter 'whisper-cli.exe' -Recurse -File |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if (!$binary -or !(Find-Tool @($binary) '-h')) {
        throw 'whisper.cpp could not start. Check CLIPPER_SPEECH_BIN and the Windows x64 runtime.'
    }
    if (!(Test-Path -LiteralPath $model -PathType Leaf)) {
        if ($model -ne (Join-Path $speechDir 'ggml-base.bin')) {
            throw 'CLIPPER_SPEECH_MODEL points to a missing file. Correct the path in .env.local.'
        }
        Write-Host 'Downloading the multilingual Whisper base model (about 148 MB)...'
        Save-Download 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true' $model `
            '60ED5BC3DD14EEA856493D334349B405782DDCAF0028D4B5DF4088345FBA2EFE'
    }
    Write-Host 'Local speech recognition is ready.'
}

function Get-OllamaTags($url) {
    try { Invoke-RestMethod -Uri "$($url.TrimEnd('/'))/api/tags" -TimeoutSec 3 }
    catch { return $null }
}

function Initialize-Ollama {
    $url = Get-Setting 'OLLAMA_URL' 'http://127.0.0.1:11434'
    $model = Get-Setting 'OLLAMA_MODEL' 'qwen2.5:3b'
    $uri = [uri] $url
    if (!$uri.IsAbsoluteUri -or $uri.Scheme -notin @('http', 'https')) {
        throw 'OLLAMA_URL must be an absolute HTTP or HTTPS URL.'
    }
    $tags = Get-OllamaTags $url
    if (!$uri.IsLoopback) {
        if (!$tags) { throw 'The Ollama server configured in OLLAMA_URL could not be reached.' }
        Write-Host 'Using the Ollama server configured in OLLAMA_URL.'
        return
    }
    if (!$tags -or !$LaunchOnly) {
        $ollama = Get-Tool 'Ollama' 'Ollama.Ollama' @('ollama.exe') '--version'
    }
    $oldHost = $env:OLLAMA_HOST
    $env:OLLAMA_HOST = $uri.Authority
    try {
        if (!$tags) {
            Write-Host 'Starting Ollama...'
            $server = Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden -PassThru
            $deadline = (Get-Date).AddSeconds(45)
            do {
                Start-Sleep -Milliseconds 500
                $tags = Get-OllamaTags $url
            } until ($tags -or $server.HasExited -or (Get-Date) -ge $deadline)
            if (!$tags) { throw 'Ollama did not respond. Check its service and OLLAMA_URL, then rerun setup.' }
        }
        if (!$LaunchOnly) {
            foreach ($name in (@($model, 'all-minilm') | Select-Object -Unique)) {
                $qualifiedName = $name
                if (($name -split '/')[-1] -notmatch ':') { $qualifiedName = "${name}:latest" }
                if ($tags.models.name -notcontains $qualifiedName) {
                    Write-Host "Downloading Ollama model $name..."
                    Invoke-Checked $ollama @('pull', $name)
                }
            }
        }
    } finally {
        $env:OLLAMA_HOST = $oldHost
    }
}

function Test-StudioPort {
    return [bool] ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
        Where-Object { $_.Port -eq 4000 })
}

Push-Location -LiteralPath $PSScriptRoot
try {
    Write-SetupStage 1
    if ([Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
        throw 'The automated installer requires 64-bit x86 Windows. See docs/INSTALL.md for manual setup.'
    }
    if (!(Test-Path -LiteralPath 'package-lock.json')) { throw 'Extract or clone the full Clipper Studio repository before running setup.' }
    if (!$LaunchOnly -and (Test-Path -LiteralPath 'node_modules\next\package.json') -and (Test-StudioPort)) {
        throw 'Close the Studio server before reinstalling dependencies, or use -LaunchOnly to check the running server.'
    }
    Update-SetupPath
    $nvmHome = @("$env:LOCALAPPDATA\Author Software\nvm", "$env:USERPROFILE\AppData\Local\Author Software\nvm")
    $nvmNodes = @(
        if ($env:NVM_HOME) { Get-ChildItem -Path "$env:NVM_HOME\v*\node.exe" -ErrorAction SilentlyContinue }
        foreach ($folder in ($nvmHome | Select-Object -Unique)) {
            Get-ChildItem -Path "$folder\installs\v*\node.exe" -ErrorAction SilentlyContinue
        }
    )
    $nodeCandidates = @($nvmNodes | Sort-Object { [version] $_.Directory.Name.TrimStart('v') } -Descending |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.DirectoryName 'node_modules\npm\bin\npm-cli.js') } |
        Select-Object -ExpandProperty FullName) + @('node.exe')
    $node = Get-Tool 'Node.js 22 or newer' 'OpenJS.NodeJS.LTS' $nodeCandidates '--version' '^v(?:2[2-9]|[3-9][0-9])\.'
    $env:Path = "$(Split-Path -Parent $node);$env:Path"
    $npmCli = Join-Path (Split-Path -Parent $node) 'node_modules\npm\bin\npm-cli.js'
    $npmExecutable = $node
    $npmPrefix = @($npmCli)
    if (!(Test-Path -LiteralPath $npmCli)) {
        $npmExecutable = Find-Tool @('npm.cmd') '--version'
        $npmPrefix = @()
        if (!$npmExecutable) { throw 'npm is missing. Repair the Node.js installation and run setup again.' }
    }

    if (!$LaunchOnly) {
        Write-SetupStage 2
        $ffmpeg = Get-Tool 'FFmpeg' 'Gyan.FFmpeg' @((Get-Setting 'FFMPEG_BIN' 'ffmpeg'), 'ffmpeg.exe') '-version'
        $env:Path = "$(Split-Path -Parent $ffmpeg);$env:Path"
        $ffprobe = Get-Tool 'FFprobe' 'Gyan.FFmpeg' @((Get-Setting 'FFPROBE_BIN' 'ffprobe'), 'ffprobe.exe') '-version'
        $ytdlp = Get-Tool 'yt-dlp' 'yt-dlp.yt-dlp' @((Get-Setting 'YTDLP_BIN' 'yt-dlp'), 'yt-dlp.exe') '--version'
        $deno = Get-Tool 'Deno' 'DenoLand.Deno' @('deno.exe') '--version'
        if (!(Test-Path -LiteralPath $envFile)) {
            Copy-Item -LiteralPath '.env.example' -Destination $envFile
        }
        Write-SetupStage 3
        Install-Speech
        Write-SetupStage 4
        Write-Host 'Installing Studio dependencies from package-lock.json...'
        Invoke-Checked $npmExecutable ($npmPrefix + @('ci', '--include=dev', '--no-audit', '--no-fund'))
    } elseif (!(Test-Path -LiteralPath 'node_modules\next\package.json')) {
        throw 'Studio dependencies are missing. Run Install-Clipper.cmd without -LaunchOnly first.'
    }

    Write-SetupStage 5
    Initialize-Ollama
    if (!$LaunchOnly) {
        Set-Content -LiteralPath 'node_modules\.clipper-setup-complete' -Value 'ready'
    }
    if ($NoLaunch) {
        Write-Host 'Setup complete. To start Studio, run Install-Clipper.cmd -LaunchOnly.'
    } else {
        if (Test-StudioPort) {
            try { $page = Invoke-WebRequest -UseBasicParsing -Uri $studioUrl -TimeoutSec 5 }
            catch { throw 'Port 4000 is already in use. Stop the process using it and run with -LaunchOnly.' }
            if ($page.Content -notmatch 'Clipper Studio') { throw 'Port 4000 is occupied by another app.' }
            Write-Host "Clipper Studio is already running at $studioUrl"
        } else {
            Write-Host "Starting Clipper Studio at $studioUrl. Keep this window open while you use it."
            Invoke-Checked $npmExecutable ($npmPrefix + @('run', 'dev'))
        }
    }
} catch {
    [Console]::Error.WriteLine("Clipper Studio setup failed. $($_.Exception.Message)")
    exit 1
} finally {
    Pop-Location
}
