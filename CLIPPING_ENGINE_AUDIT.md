# Clipping engine audit

Scope: the "Complete Self-Hosted Intelligent Clipping Engine" brief (100 numbered requirements) against the repository after the work in this branch. Status words are used strictly:

- **Verified** — covered by an automated test, or by a real-media / real-browser check run during development.
- **Incomplete** — code exists but covers less than the requirement says.
- **Untested** — code exists; no verification was run.
- **Missing** — no implementation.

Nothing is marked Verified without a check. The automated suite is `npm test` (132 tests; `npm run gate` adds typecheck, lint and the production build).

## Decisions and open conflicts

1. **Whisper (kept, as you decided).** `lib/speech.ts` runs whisper.cpp when configured. The brief forbids it; you chose to keep it as an optional local transcriber. It is the only non-Ollama inference path, it runs locally, and the engine works fully without it (source subtitles, imported SRT/VTT, or no transcript).
2. **Ollama models.** Resolved from what is installed, never pulled automatically. Preference order: `qwen3.5:2b`, then your `OLLAMA_MODEL`, then `qwen2.5:3b`/`1.5b` (main); `qwen3.5:0.8b` then smaller qwen2.5 (light); `qwen3-embedding:0.6b` / `nomic-embed-text` (embedding). Availability of the `qwen3.5` tags was not verified; `qwen2.5:3b` was used for real AI tests.
3. **Embeddings are not used yet.** Semantic duplicate detection and related-clip discovery over the new candidates are not built; the existing semantic search code is untouched.
4. **One job queue.** The existing single in-process queue still serialises heavy jobs. The new memory gate is applied inside the new analysis path only.
5. **Unsplash hot-links** on the public pages remain (disclosed in the privacy page).
6. **Docker files are untested** (no running Docker daemon in the development environment).
7. **LAN access is not supported.** The API deliberately rejects non-localhost hosts.

## Status by requirement

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 1–3 | Self-hosted, internet policy, target hardware | Incomplete | No databases, no cloud AI, no API-key fields. Local-only Ollama endpoint. Whisper kept (decision 1). No i5/8 GB measurement was made (see 99). |
| 4 | Repository audit | Verified | This file. |
| 5 | Universal source import | Incomplete | yt-dlp URL import, upload, local-file path (Quick Clip, Autopilot folder watch) exist. Local audio-only and per-platform capability detection not built. |
| 6 | Source inspection | Incomplete | Downloads page reads title, creator, platform, duration, upload date, language, availability, chapters, per-resolution sizes, audio tracks, subtitle tracks and capability flags: **Verified** (unit tests, plus a live metadata read of a public video through the real yt-dlp and proxy, also in the browser). Thumbnails are shown only from an allowlist of hosts. |
| 7 | Smart download manager | Incomplete | Queue, cancel (keep or discard partial), retry with resume, progress/speed/ETA, 720p default with higher on request, audio-only, subtitles-only, time-range downloads, canonical-URL cache, SHA-256 duplicate flags, free-disk pre-check, temp-file cleanup, use-as-project: **Verified** with a stub downloader through the real queue and files. **No real media file has been downloaded with it yet**, so real yt-dlp resume and section behaviour is unverified. |
| 8 | Long-form support | Incomplete | Analysis streams in 30-minute chunks and resumes after interruption: **Verified** (parsers, autopilot retry, and a benchmark that aborted a 60-minute run after one chunk and resumed it). A 60-minute 720p synthetic source analysed in 39 s with about 70 MB of Node memory on a 16-thread desktop CPU. Multi-hour (4 h / 8 h) sources and real footage were not run. |
| 9–11 | No-LLM scoring, signals, audio | **Verified** | RMS/peak/sudden-rise/silence, baseline-relative. "Loudness" is an RMS proxy, not LUFS; onset ≈ sudden rise. |
| 12 | Scene change | Incomplete | Scene score at 2 fps downscaled, cut rate, motion: Verified on a synthetic video. Static/rapid-edit are implicit in tracks, not separate outputs. Full source is decoded (no proxy path). |
| 13 | Chat analysis | Incomplete | JSON, Twitch-style, CSV import, offset, rate, unique users, reactions, repeats, hype: **Verified**. Automatic replay chat download not built. |
| 14 | Replay heatmap | Incomplete | Manual import and yt-dlp-shaped parsing: **Verified**. Auto-fetch not wired. |
| 15 | Hype dictionaries | Incomplete | en, ne, ne-Latn, hi, hinglish, ur, bn, es, gaming: matching/normalisation **Verified**. Small starter lists; no dictionary editor UI; pt/ar/zh/ja/ko lists absent. |
| 16–18 | Combined scoring, windows, boundaries | **Verified** | Weight redistribution, merge, spacing, duplicates, subtitle/sentence/silence/scene snapping. Dialogue-turn awareness not built. |
| 19 | Moment heatmap | Incomplete | Own page, real tracks, zoom, scroll, toggles, hover, seek, ranges, review: **Verified in a real browser** (layout bugs found and fixed). Manual bookmarks and in-UI weight sliders not built. |
| 20 | Instant mode | **Verified** | Real FFmpeg pipeline test: analysis → selection → approval → render → retry. |
| 21–23 | Intelligent, Deep, fallback | Incomplete | Intelligent and Deep passes with bounded retries, template fallback, failure circuit-breaker: unit-tested with a stubbed transport and **run against real `qwen2.5:3b`**. Deep adds a larger context only; cross-candidate comparison and narrative passes are not built. |
| 24–27 | Ollama profiles, resources, routing, structured output | Incomplete | Model resolution, eco/main routing, zod-validated output, grounded (no model timestamps) done. Embedding routing, automatic unload, memory-pressure model downgrade beyond one threshold not built. |
| 28–32 | Multilingual clipping and captions | Incomplete | Existing language packs/captions/RTL not re-verified. Separate per-purpose language settings and audio-capable-model detection not built. Quick Clip exposes a source-language choice used for profile routing. |
| 33–40 | Content-type modes | Incomplete | 13 profiles (weights, durations, padding, boundary strategy, layout hint) and a custom profile builder with versioned JSON: **Verified** (schema + API + UI). Per-profile Ollama prompts, editing templates, metadata rules not built. |
| 41–45 | Clip genome, hooks, payoff, comparison, duplicates | Incomplete | Per-candidate measured breakdown plus AI estimates (hook, payoff, completeness, clarity) kept separate from measured scores. Candidate-to-candidate comparison UI, embeddings duplicates not built. Transcript-similarity duplicates: Verified. |
| 46–49 | Layouts, webcam regions, reframing, recipes | Incomplete | Existing editor features, not re-verified. Quick Clip applies ratio/layout via platform presets. |
| 50–52 | Music, SFX, thumbnails | Incomplete | Existing soundboard/beat/poster code; not extended. |
| 53–57 | Trend radar, creators, research | Incomplete | Atom/RSS parsing (YouTube feed statistics), polling interval enforcement, observations, velocity, staleness, topic counts, evidence-cited Ollama summaries, imports, saved notes: **Verified** by tests and a real-browser check. Live network fetch of a real feed was not exercised; SSRF blocking is Verified. |
| 58–61 | Campaigns and compliance | Incomplete | Schema, editor, brief import (Ollama, review before save), compliance engine with pass/fail/needs-review, rights ledger feeding checks, report in packages: **Verified**. Linked-projects and production-history views not built. |
| 62–64 | Post kits, presets, packages | Incomplete | title/description/hashtags/pinned-comment/attribution/captions-original/metadata/compliance files plus existing video/thumbnail(jpg)/srt/vtt: **Verified** (unit). Platform presets (advisory limits). `captions-english.srt` is not generated (no translation track). A full ZIP build was not run in this session. |
| 65–68 | Quick Clip UX | Incomplete | Express page with the 10 steps, defaults, advanced section, progress, results with real preview, download, open in editor: **Verified in a real browser** with a real render. Per-clip accept/reject/trim/regenerate on that screen not built (review happens in Moment finder before rendering). |
| 69–71 | Reel Factory, Autopilot | Incomplete | Autopilot: new-upload and folder triggers, stable-file detection, approval, language routing, score filter, transcript condition, history, retry: **Verified** (unit + real pipeline). Background polling only runs while the server is up and after the first request since start. Existing Reel Factory unchanged. |
| 72–74 | Storage, cleanup, cache | Incomplete | Policies, classification, dependency-aware previews, authorised source deletion, cache age/size sweeps: **Verified** (fixtures). Archive mode defers to existing Backups. Not every dependency kind (e.g., review-version references) is inspected. |
| 75–78 | Profiles, scheduler, FFmpeg, frontend | Incomplete | Eco/Balanced/Performance (Performance gated below 12 GB): **Verified**. Encoder claims only after a real test encode: **Verified**. TanStack Virtual/Web Workers not used. New pages are lazy-loaded. |
| 79–82 | Windows scripts, Docker | Incomplete | `scripts/windows/{setup,start,stop,update,doctor,backup}.ps1`: doctor and backup **run for real** (backup verified to exclude sessions/temp/sources); stop tested with no PID; start/update/setup not run end to end. Docker **untested**. |
| 83–90 | UI libraries and workspaces | Incomplete | Radix, cmdk, lucide, zod used. TanStack Table/Virtual, React Hook Form, Sonner, Resizable Panels, dnd-kit, Recharts, React Flow **not installed** (plain React forms and canvas were used instead). Navigation: Home gains Quick Clip; Clipping gains Moment finder, Trend radar, Campaigns; Automation gains Autopilot; Settings gains System health. System health values measured: **Verified in browser**. |
| 91–95 | Security | Incomplete | New endpoints use the existing session, origin and localhost guards, zod validation, size caps, SSRF validation for feeds (blocks loopback/private hosts: Verified), path-confined cleanup. Rights ledger (existing) feeds compliance. A formal security review was not done. |
| 97–98 | No-API-key and offline acceptance | Incomplete | A 16-step run (`scripts/offline-acceptance.mjs`) passes against the real server with a network guard that fails every non-loopback DNS/connection from the server process: account, sign-in, local import + render, no-AI analysis, chat/transcript signals, local Ollama ranking, Quick Clip, manual edit, Devanagari translation via local Ollama, compliance report, package ZIP, local pages; zero blocked attempts during those flows; the studio page and its stylesheet reference no external hosts; internet-only features fail with a clear message. **Not a physical disconnection**; separate programs (FFmpeg) were not covered by the guard; the public landing pages still load Unsplash photos; Whisper and subtitle editing were not part of the run. |
| 96, 99–100 | Testing and benchmarking | Incomplete | 120 tests including real-FFmpeg and real-pipeline tests. **A partial benchmark exists** (analysis time and memory for 10- and 60-minute synthetic sources, on a Ryzen 7 / 63 GB desktop, in `PERFORMANCE.md`). Not done: any measurement on Intel Core i5 / 8 GB hardware, Ollama and render timings, 4 h / 8 h sources, real footage, Nepali/Hindi subtitle runs, browser-responsiveness measurement, a Playwright visual suite, and black/frozen-frame analysis. The only rendered-clip check was resolution/codec/audio through the existing export QA on a synthetic file. |

## Bugs found by running the software (all fixed)

- The Next.js development server fetched the npm registry (version banner) and Next telemetry was enabled; both contradict the no-external-calls rule. Launch scripts now disable telemetry and block those requests.
- The login/register side panel loaded a stock photo from Unsplash through the shared stylesheet; replaced with a local gradient.
- URL features showed raw DNS errors when offline; they now say that internet access is needed.
- Windows `EPERM` when atomically replacing a JSON file another request was reading → retrying rename plus stat-validated read cache; covered by a stress test.
- Quick Clip showed the oldest run instead of the newest.
- Moment explorer layout (labels, oversized controls, time axis) and its placement inside a collapsed section.
- Doctor script returned noise in its pipeline and missed an `npm.exe` shim.
- Model output strictness: over-long free text rejected valid structured output; now shortened instead.
