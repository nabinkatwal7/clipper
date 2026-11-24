# Clipper AI

A personal, locally hosted Next.js video clipper. Import a recording, transcribe with Faster Whisper, select moments with Ollama, and render downloadable clips with FFmpeg. All metadata lives in JSON files; no accounts, database, cloud service, or paid API.

## Install

Use Node.js 22 or 24 LTS and Python 3.10–3.12. Install FFmpeg (including FFprobe and the libass subtitle filter), yt-dlp, and Ollama. Ensure the commands are on PATH **before starting Next.js**.

If your Node version manager reports “No active Node.js version”, select an installed version first (for example, `nvm use 24.22.1`).

### Windows

Install Node.js from https://nodejs.org and Python from https://www.python.org/downloads/ (enable “Add Python to PATH”). In PowerShell:

```powershell
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
winget install Ollama.Ollama
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
ollama pull qwen2.5:3b
```

Open a new terminal after installing system tools. If Python points to the Windows Store alias, install Python and disable the alias in Windows app execution settings, or set `PYTHON_BIN` to your actual Python executable.

### macOS

Install Homebrew, then:

```sh
brew install node@22 python@3.12 ffmpeg yt-dlp ollama
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
ollama serve
```

In another terminal: `ollama pull qwen2.5:3b`.

### Linux (Ubuntu/Debian)

Install Node.js 22+ from nodejs.org or your preferred version manager. Then:

```sh
sudo apt update
sudo apt install ffmpeg python3 python3-venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt yt-dlp
```

Install Ollama following https://ollama.com/download/linux, run `ollama serve`, and run `ollama pull qwen2.5:3b` in a separate terminal.

### Start

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4000. Keep Ollama running and keep the virtual environment active when launching Next.js. The first transcription downloads the selected open model; subsequent transcription runs are local. Model downloads and URL imports require internet access. No video or transcript is sent to an AI cloud service.

Copy `.env.example` to `.env.local` to customize commands, limits, or model settings. `PYTHON_BIN` can point directly to `.venv/Scripts/python.exe` on Windows or `.venv/bin/python` on Unix. `npm run health` loads `.env.local` and checks the configured tools. Missing Ollama does not prevent manual clipping or fixed-duration splitting. Turn off captions to skip Whisper too.

For production locally: `npm run build` then `npm start`. This requires a persistent Node server; do not deploy to serverless platforms. Development hot reloads and server restarts can interrupt work. Projects are preserved, and interrupted projects can be retried. The app now has first-party accounts: open `/register` and sign up; the first account becomes the owner (a setup token from `CLIPPER_SETUP_TOKEN` or `storage/auth/owner-setup-token.txt` is only required when the server is not reached via localhost). Registration is open by default and the owner can switch it to invitation-only or closed. Forgotten passwords are reset at `/recover` with the one-time recovery code shown at sign-up. `/app` and `/api/*` require a session, and each user has an isolated folder under `storage/workspaces/`. Keep the app bound to localhost; the auth routes only accept localhost origins and it is not hardened for LAN or internet exposure.

## Use

1. Paste a supported public YouTube, Twitch, Kick, or direct video URL, or upload a local video.
2. Choose clip length, count, ratio, resolution, layout, and caption settings. Defaults are 30–60 seconds, 9:16, 720 × 1280, with captions.
3. Generate clips. Actual stages appear as the single local worker downloads, extracts audio, transcribes, analyzes chunks, and renders each result.
4. Preview the clips, edit trims and subtitles, adjust crop, and re-render. Download individual MP4 files or a streaming ZIP.
5. Cancel processing when needed. Delete clips or delete a project to remove its source, transcript, thumbnails, and renders.

Only import content you own or are authorized to use. URLs must be publicly accessible. The downloader uses no cookies or login credentials, and does not bypass DRM or platform restrictions. Active live broadcasts are rejected; use completed recordings. Platform support depends on the installed yt-dlp version; keep it current.

AI highlights are based only on the timestamped transcript; visual-only jokes and silent action can be missed. Scores are model estimates, not measured engagement. Invalid ranges and duplicates are removed. If no valid highlights exist the app reports an error; it never invents selections. Automatic count selects up to 20 valid moments. Fixed splitting is an explicitly selected fallback and never labeled as AI output.

The crop preview shows source framing and trim. Final blur, facecam composition, and burned captions appear after re-rendering. Facecam layout assumes a camera in the upper 40% of the input; the horizontal slider sets its position. It is not face detection. Original landscape fits the full source into a 16:9 canvas with a blurred backdrop. Caption edits retain phrase timing; unchanged captions retain word timing. Font size is relative to a 1920-pixel-high canvas and scales with the output. A re-render keeps the prior clip until the replacement succeeds.

## CPU and GPU

CPU defaults: `WHISPER_MODEL=tiny`, `WHISPER_DEVICE=cpu`, `WHISPER_COMPUTE_TYPE=int8`. For an NVIDIA GPU, install a compatible CUDA/cuDNN runtime per Faster Whisper documentation, then set `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16`. `WHISPER_MODEL=small` or `medium` improves accuracy at higher cost. Ollama uses supported GPUs automatically. Qwen2.5 7B needs several GB of RAM; set `OLLAMA_MODEL` to another installed instruction model if necessary. FFmpeg uses CPU encoding, up to eight threads, a superfast preset, and sequential renders.

## API and storage

All endpoints are Next.js Route Handlers using Node runtime:

| Endpoint               | Input / result                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/import`     | JSON `{url, settings, generate?: boolean}`; queues import and generation by default. Uploads use raw `application/octet-stream`, `X-File-Name`, and JSON `settings` query parameter; streaming body, not multipart. |
| `POST /api/transcribe` | `{project}`; reuses existing transcript                                                                                                                                                                             |
| `POST /api/analyze`    | `{project, settings?}`; transcribes if needed and finds highlights                                                                                                                                                  |
| `POST /api/generate`   | `{project, settings?}`; reuses source and transcript; appends new renders                                                                                                                                           |
| `GET /api/progress`    | All projects, or `?project=UUID`; actual saved stages                                                                                                                                                               |
| `POST /api/edit`       | `{project, clip, start, end, settings, segments}`; queues replacement render                                                                                                                                        |
| `POST /api/cancel`     | `{project}`; cancels queued/active work                                                                                                                                                                             |
| `GET /api/download`    | `?project=UUID&clip=UUID`, `&attachment=1`, `&kind=source`, `&kind=thumbnail`, or `&kind=zip`; video range support                                                                                                  |
| `DELETE /api/cleanup`  | `?project=UUID`, optionally `&clip=UUID`; active jobs must stop first                                                                                                                                               |
| `GET /api/health`      | FFmpeg, FFprobe, yt-dlp, Faster Whisper, and configured Ollama model checks                                                                                                                                         |

`storage/uploads/` holds sources/thumbnails; `audio/` holds temporary WAV files; `transcripts/` stores timestamped segments/words; `projects/` stores project JSON; `clips/` holds MP4s; `temp/` holds render intermediates. Metadata writes use temporary files and atomic renames. A single in-process queue limits work to one job, renders sequentially, and permits cancellation. Restarted jobs are marked interrupted on polling rather than silently resumed. Run only one Next.js server against a storage directory.

URL downloads pass through an authenticated temporary local proxy. It checks every connection, rejects nonpublic IPs, pins DNS results, restricts ports, and rechecks redirect/media destinations. Child processes use argument arrays with no shell interpolation; file access uses validated UUIDs, and local media demuxing restricts protocols. Host/origin checks protect local mutation routes. Default upload/download limit is 5 GiB and duration is 12 hours; configure environment values as needed. URL imports inspect available formats and select video plus audio within the combined size budget, reserving muxing overhead. Very long recordings may use a lower source resolution to fit. Increase MAX_UPLOAD_MB in .env.local and restart the dev server if you prefer a larger source. Downloads that are skipped or incomplete stop with an import error before FFprobe runs. Very large metadata sets and many concurrent uploads are outside the scope of this personal tool. Failed jobs keep source/transcript files for retry; project deletion clears them. Temporary render files are removed after success/failure; interrupted process termination may leave files in `temp/`, which can be removed while the server is stopped.

## Development checks

```sh
npm run typecheck
npm test
npm run build
npm run health
```

Core tests cover timestamp validation, overlap removal, local IP blocking, settings, ASS timestamp generation, and output dimensions. Run `npx tsx scripts/smoke.ts` with FFmpeg and FFprobe installed to create a synthetic source, exercise all video layouts/caption styles, and validate generated files. This is a deterministic media smoke test, not a substitute for testing model quality on your own recordings.

`npx tsx scripts/integration.ts` exercises route handlers with real upload, rendering, editing, range streaming, ZIP export, and cleanup. `npx tsx scripts/ingest-smoke.ts` downloads the openly licensed Sintel trailer, transcribes it, and renders a captioned vertical clip. These media scripts use exported environment variables; unlike `npm run health`, they do not load `.env.local`. Set `FFMPEG_BIN`, `FFPROBE_BIN`, `PYTHON_BIN`, and `YTDLP_BIN` or add their directories to PATH. Use `WHISPER_MODEL=tiny` for a quick smoke run. Test artifacts are removed afterward.

### Verification in this checkout

The production build, 22 automated tests, all five FFmpeg layouts, three caption styles, route integration, real URL ingestion, and real Faster Whisper transcription/captioned export were verified. The dashboard and dependency panel were checked in a browser. The npm dependency audit reported zero vulnerabilities. Local test tools are configured in the ignored `.env.local`; Whisper uses the downloaded `tiny` model. Ollama is installed and running with `qwen2.5:3b`; a real structured JSON inference and all dependency health checks pass. AI highlight selection and model quality on full recordings still require validation. YouTube, Twitch, and Kick platform-specific imports were not individually tested.

### Faster processing and live progress

The default export and URL import target is 720p; 1080p remains selectable. The default upload/import budget is 5120 MiB (5 GiB), configured by MAX_UPLOAD_MB. Existing cached video and extracted audio are reused; raising the limit does not upgrade a previously imported source.

Faster Whisper uses 120-second windows with 5 seconds of overlap, batched decoding, beam size 1, and up to eight CPU threads. Each window writes an atomic checkpoint, so cancelling and retrying can resume completed windows. This faster profile trades some transcription accuracy for speed; use WHISPER_BEAM_SIZE=5 or a larger WHISPER_MODEL for accuracy. WHISPER_BATCH_SIZE, WHISPER_CPU_THREADS, WHISPER_WINDOW_SECONDS, FFMPEG_THREADS, and FFMPEG_PRESET are configurable. The local profile uses Qwen2.5 3B for faster CPU analysis; Qwen2.5 7B remains supported by setting OLLAMA_MODEL=qwen2.5:7b.

Click a stage in the progress panel to inspect it. Bars measure downloaded bytes, extracted/transcribed audio seconds, completed analysis chunks, or rendered clips plus encoded time within the current clip. AI responses stream live activity counts. Details show elapsed time and when the tool last reported; Refresh queries the server immediately. No overall percentage is fabricated for unmeasured work. Long recordings still require local CPU time.

### Post captions and TXT exports

Each clip has an editable social post caption with Copy, Save, Generate, and TXT controls. New AI selections request a transcript-grounded post caption and relevant hashtags. Existing clips use their title as an explicit starter until you generate or write a caption. Caption generation runs through the same local job queue; editing captions requires the project to be idle.

The main clip download returns a ZIP with matching MP4 and TXT filenames. Download all includes a TXT beside every MP4. TXT uses UTF-8 and contains the saved post caption, separate from burned-in subtitles. Save edits before downloading. Raw MP4 previews and direct MP4 URLs remain supported.

POST /api/caption accepts {project, clip, caption} to save text, or {project, clip} to queue local AI generation. GET /api/download?project=UUID&clip=UUID&kind=caption downloads TXT; kind=bundle downloads a single MP4 + TXT ZIP. kind=zip includes videos and text for the entire project.

### Simplified workspace

Use New video to paste a link or upload a video. Only clip length and count are shown initially; More options contains format, quality, layout, clipping method, and subtitle preferences. Uploads show actual transferred progress.

The main workspace focuses on the clip gallery. Open Review clip to preview the video, edit or copy its post caption, and download the MP4 + TXT bundle. Edit video separates Trim & layout from Subtitles, with timecode inputs such as 1:23.5. Projects opens a searchable library and remembers the chosen project. Activity holds completed processing details; active jobs show a compact live progress card with expandable steps.

The redesign was checked at desktop and phone widths, including a real local upload, manual generation, caption save, and trim/re-render. Temporary test media was removed afterward.



## Studio workspace

Open the local app at `http://127.0.0.1:4000`. Studio overview shows recent projects and rendered clips. Start with a video link or upload, then select **Generate clips**. The default output is 720p and the upload limit is 5 GiB. Use **Ctrl/Cmd + K** to find a project, clip, channel, page, or command.

- **Clip library** supports grid and list views, favorites, publishing status, search, and selection across projects. A selected download streams a ZIP with one MP4 and one matching caption TXT per clip.
- **Video editor** previews framing and subtitles, plays source audio, and supports timeline scrubbing, trim handles, source-frame stepping, split, undo/redo, and composition transforms. **Save changes** queues an FFmpeg render. **Export saved clip** downloads the latest completed render. **Subtitle studio** opens the caption inspector directly.
- **Transcript explorer** searches source dialogue, edits timestamped text, and uses local Ollama for translations and related-term queries. Selecting a highlight exposes its reasoning, trim range, and clip action. **Index audio and scene changes** queues a measured source scan. Long streams can take time.
- **Thumbnail studio** exports a 1280 × 720 PNG from a selected source frame, with text and optional image layers.
- **Streamers** accepts a public channel recordings feed. **Automatic clipping** checks enabled feeds while the studio is open. The first successful check records a baseline. Subsequent checks queue newly discovered recordings.
- **Content calendar** stores editorial plans in this browser. Dates, publishing labels, and platform selections are planning metadata. Publishing to a platform is a separate manual step.
- Media and transcripts are stored on disk. Theme, sidebar preferences, favorites, branding profiles, calendar entries, and channel monitoring settings are stored in the browser for this local origin.

## Local automation

Start the studio with `npm run dev`. Its local CLI uses the same API and processing queue as the browser. See [the feature inventory](FEATURE_MATRIX.md) for implementation status and coverage.

| CLI command after `npm run clipper --` | Operation |
| --- | --- |
| `health`, `jobs` | Read dependency health or project job state |
| `import URL` | Import a recording URL and return its project ID |
| `analyze PROJECT`, `generate PROJECT` | Queue highlight discovery or clip generation |
| `render PROJECT EDIT_JSON` | Queue an edit using its clip ID, source range and settings |
| `cancel PROJECT` | Cancel a queued or running project |
| `report PROJECT`, `export PROJECT FILE.zip` | Read a source report or save a project archive |

The server binds to loopback on port 4000. Read project data with `GET /api/progress` and dependency state with `GET /api/health`. Send edit parameters to `POST /api/edit` as JSON. The request includes `project`, `clip`, numeric `start` and `end` in source seconds, and `settings`. Set `variation` to true to keep both versions. Read the clip using `GET /api/download?project=ID&clip=ID`. Run `npm run clipper --` for the CLI argument list.

For media integration checks, set `FFMPEG_BIN` and `FFPROBE_BIN` to your installed executables and run `npx tsx scripts/expansion-smoke.ts`. Set `TEST_OLLAMA=1` to exercise the local model. The fixture uses a temporary filesystem workspace. To check browser layouts, run `node scripts/visual-regression.mjs` with the dev server running and Playwright available through `PLAYWRIGHT_MODULE`. By default it launches the Edge channel and writes screenshots under `tools/visual-regression`.
