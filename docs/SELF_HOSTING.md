# Self-hosting Clipper Studio

Clipper Studio is one Next.js app that runs on your computer. Data lives in the `storage/` folder (or `CLIPPER_STORAGE_DIR`). There is no database, no cloud account and no API key. Ollama, if you use it, is the only AI service and runs on your machine.

## Windows

Scripts live in `scripts/windows/`. Read them before running; none needs administrator rights, and none pipes a remote script into a shell.

| Script | What it does |
| --- | --- |
| `setup.ps1` | Runs `Install-Clipper.ps1`: checks Node.js, FFmpeg, FFprobe, yt-dlp, Ollama; installs npm packages from `package-lock.json`; writes `.env.local`. Never pulls an Ollama model without asking. |
| `doctor.ps1` | Read-only report: tool versions, installed Ollama models, RAM, CPU, free disk, listed H.264 encoders, port 4000. Exits 1 if a required component is missing. |
| `start.ps1` | Starts Studio in the background on `127.0.0.1:4000` (`-Production` after `npm run build`). Writes `storage\studio.pid` and logs to `storage\logs`. |
| `stop.ps1` | Stops only the process recorded in `studio.pid`. |
| `backup.ps1` | ZIP of accounts (password hashes only), workspaces, projects, clips, assets, transcripts and saved data. Excludes caches, logs, proxies, partial files, login sessions, and (unless `-IncludeSources`) source videos. |
| `update.ps1` | Refuses with uncommitted changes or a running server, backs up, `git pull --ff-only`, `npm ci`, type check. |

The backup ZIP contains personal data. Keep it private.

## Hardware

Defaults target a modest laptop (for example an Intel Core i5 with 8 GB RAM, no GPU):

- One heavy job at a time (existing queue). Analysis also waits while free memory is below 700 MB (`CLIPPER_MIN_FREE_MB`).
- No-AI ("Instant") clipping is the default path and does not need Ollama.
- Settings → System health shows measured CPU, RAM, disk and the model Ollama has loaded, and lets you choose Eco, Balanced or Performance. Performance is never selected automatically and asks for confirmation below 12 GB RAM.
- Hardware encoders (`h264_qsv`, `h264_nvenc`, `h264_amf`) are only reported as verified after a real test encode succeeds on your machine. They are never assumed.

No benchmark numbers are published for any hardware; measure on your own machine.

## Ollama

Set `OLLAMA_URL` (default `http://127.0.0.1:11434`). Keep it on localhost. Studio uses only models you already installed and tells you when none fit. Optional overrides: `CLIPPER_MODEL_MAIN`, `CLIPPER_MODEL_LIGHT`, `CLIPPER_MODEL_EMBED`. Transcripts and frames are never sent anywhere else.

## Network and offline behaviour

Needs internet: importing from a URL, checking creator feeds, downloading dependencies or Ollama models. Everything else (login, local import, no-AI analysis, local Ollama, editing, rendering, packages, storage, campaigns) is local. When a network operation cannot reach the internet it reports an error; nothing silently falls back to another service. An offline acceptance run has not been performed yet.

## Scheduled work

Autopilot and creator checks run inside the Studio process: only while it is running, and only after someone has opened the app since it started. Nothing runs while the computer is off or Studio is stopped. Autopilot never publishes anywhere.

## Network exposure

Studio binds to `127.0.0.1` and the API rejects any other host, so it is **not** meant to be reachable from the LAN or internet. A login screen alone does not make public exposure safe. If you need remote access, put it behind a VPN you control.

## Docker (optional, untested)

`Dockerfile` and `docker-compose.yml` build an image with FFmpeg and a pinned yt-dlp, publish only `127.0.0.1:4000`, keep data in a named volume, and reach Ollama on the host through `host.docker.internal`. They have not been built or run (no Docker daemon was available during development). Containers cannot use host hardware encoders without extra device configuration; expect software encoding.

## Storage policy

Settings → Storage → Policy. Every cleanup is a two-step preview: nothing is deleted until you review the list and confirm. Downloaded sources are only ever proposed under "Temporary Processing", only when the source URL can be fetched again, the project is idle with verified clips, and no other project references it; you must tick an explicit authorisation. Chat/replay imports and moment results are never offered for deletion.

## Downloads

Files live in `storage/.../downloads/<id>/` and are excluded from `backup.ps1` unless you pass `-IncludeSources` (they can be downloaded again). Only download media you own or have permission to use; the manager does not bypass logins, paywalls or DRM, and reports sources that need them as unavailable.
