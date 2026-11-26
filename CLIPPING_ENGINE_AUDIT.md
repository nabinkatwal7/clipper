# Clipping engine audit

Scope: the "Complete Self-Hosted Intelligent Clipping Engine" brief (100 numbered requirements) against the repository as of this change. Status words are used strictly:

- **Verified** — implemented and covered by an automated test or a real-media check run in this change.
- **Incomplete** — code exists but covers less than the requirement.
- **Untested** — code exists; no automated or manual verification was run here.
- **Missing** — no implementation.
- **Conflict** — exists, but contradicts a constraint in the brief.

This change delivered Phase 1 (partially) and Phase 2 (core). Everything else is listed honestly as Missing or Incomplete. Nothing below was upgraded to "Verified" without a test.

## Findings that need a decision

1. **Conflict — Whisper.** `lib/speech.ts` runs `whisper-cli` (whisper.cpp) and `.env.local`/`.env.example` carry `WHISPER_*` and `PYTHON_BIN` settings. The brief forbids Whisper/Faster-Whisper and any non-Ollama inference. It is existing, working functionality ("preserve everything"), so it was **not removed**. Decide: keep as an optional local transcriber, or remove it and rely on source subtitles / imported SRT / Ollama audio models.
2. **Ollama default model.** `OLLAMA_MODEL` defaults to `qwen2.5:3b`; the brief proposes `qwen3.5:2b` / `0.8b` / `qwen3-embedding:0.6b`. Availability of those tags was not verified.
3. **Two queues.** The existing single in-process queue (`lib/jobs.ts`) already serialises heavy jobs. A separate "global scheduler" would create a second lock domain, so only a memory gate (`lib/clipping/resources.ts`) was added. Wider scheduler unification is open.
4. **Landing page hot-links Unsplash photos** (`lib/photos.ts`). That conflicts with the offline/no-external-services posture for the public page.
5. `yt-dlp` and FFmpeg are not on `PATH` in this environment; `.env.local` points at `tools/ffmpeg` and `.venv`. `ollama` 0.40.18 is installed.

## Status by requirement group

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 1–3 | Self-hosted, internet policy, target hardware | Incomplete | Next.js/FFmpeg/yt-dlp/Ollama/JSON persistence already in place. No databases or cloud AI found. Whisper conflict above. |
| 4 | Repository audit | Verified | This document. |
| 5 | Universal source import | Incomplete | yt-dlp URL import and upload exist (`lib/ingestion.ts`, `lib/jobs.ts`). Local folders, per-platform capability detection not built. |
| 6 | Source inspection | Incomplete | `components/source-inspection.tsx`, `lib/source-info.ts` exist; completeness vs. the field list unchecked. |
| 7 | Smart download manager | Incomplete | Queue and cancel exist. No resumable/partial/audio-only/subtitle-only modes, duplicate detection or storage check verified. |
| 8 | Long-form support | Incomplete | New analysis streams in 30-minute chunks and resumes after interruption (**Verified** by parser/fixture tests; multi-hour run not benchmarked). Rendering/download paths unchanged. |
| 9 | No-LLM scoring engine | **Verified** | `lib/clipping/*`. |
| 10 | Timeline signal extraction | Incomplete | Audio, scene/motion, subtitle pacing, hype words, chat, replay: **Verified**. Not built: user bookmarks and source markers as signals, chapter boundaries as signal. |
| 11 | Audio activity | Incomplete | RMS, peak, sudden rise, silence spans, baseline-relative: **Verified**. "Loudness" is an RMS dB proxy, not LUFS. Onset activity is approximated by the sudden-rise measure; dynamic range and sustained-region detection are not separately computed. |
| 12 | Scene change | Incomplete | FFmpeg `scene_score` at 2 fps on a 160-px downscale: cuts, motion estimate, cut rate **Verified**. Static-scene and rapid-edit labels are implicit in the tracks, not separate outputs. Analysis decodes the full source; no proxy is used yet. |
| 13 | Chat analysis | Incomplete | JSON/CSV/Twitch-style import, offset, rate, unique users, reactions/emoji, repeated phrases, hype: **Verified**. Retrieval of live chat replay via yt-dlp not built. Existing 120-bin count import (`lib/activity-evidence.ts`) untouched. |
| 14 | Replay heatmap | Incomplete | Manual import and yt-dlp-metadata-shaped `heatmap` parsing: **Verified**. Automatic retrieval wiring into the download step not built. |
| 15 | Multilingual hype dictionaries | Incomplete | en, ne, ne-Latn, hi, hinglish, ur, bn, es, gaming: **Verified** for matching/normalisation. Lists are small starter sets, not validated lexicons. No UI to edit custom dictionaries; custom dictionaries are supported by the API type only. pt/ar/zh/ja/ko lists absent. |
| 16 | Combined scoring | **Verified** | Weighted, normalised, redistribution, smoothing, breakdown. |
| 17 | Candidate windows | **Verified** | Peaks, adaptive window, context, min/max, merge, spacing, duplicate-text removal, chronological. |
| 18 | Boundary refinement | Incomplete | Subtitle/sentence/silence/scene/leading-silence: **Verified** on unit cases. Dialogue-turn awareness not built. |
| 19 | Moment heatmap | Incomplete | `components/moment-explorer.tsx`: real tracks, zoom, scroll, toggles, hover, seek, candidate ranges: **Untested in a browser**. Bookmarks and live custom weighting in the UI not built (weights are accepted by the API). |
| 20 | Instant mode | Incomplete | Analyse → candidates → render through the existing renderer works at code level. Auto layout presets are per-profile hints only; end-to-end render from the UI not run. |
| 21–23 | Intelligent / Deep / AI fallback | Missing (new) | Existing Ollama highlight analysis (`lib/jobs.ts#analyze`) is separate and untested against these requirements. No hybrid ranking of formula candidates, no deep mode UI, no resource warning. |
| 24–27 | Ollama profiles, resources, routing, structured output | Incomplete | Existing code uses JSON schemas and validation (`lib/discovery.ts`, `lib/ollama.ts`). Model routing, memory-pressure fallback and embeddings not built. |
| 28–32 | Multilingual clipping and captions | Incomplete | Language packs and caption styling exist (`lib/localization.ts`, `lib/captions.ts`, `docs/LANGUAGE_SUPPORT.md`). Separate source/transcript/analysis/caption/translation/metadata language settings, audio-capable Ollama detection, RTL/complex-script checks not verified. |
| 33–40 | Content-type modes | Incomplete | 13 profiles with weights, durations, padding, boundary strategy and layout hint: **Verified** (schema + validation). Per-profile Ollama prompts, edit templates and metadata rules not built. Custom profile validation exists; no builder UI or persistence. |
| 41–45 | Clip genome, hooks, payoff, comparison, duplicates | Incomplete | Existing clip-family, comparison and transcript-insight code. Genome/hook/payoff scoring per brief not built. Duplicate detection: transcript similarity only. |
| 46–49 | Layouts, webcam regions, reframing, recipes | Incomplete | Layouts, vision crop, keyframed reframe and recipes exist (`lib/composition.ts`, `lib/vision-crop.ts`, `lib/reframe.ts`, `lib/edit-recipes.ts`). Not re-verified here. |
| 50–52 | Music, SFX, thumbnails | Incomplete | Soundboard, beat detect, poster generation exist. Ducking/looping/fit and thumbnail variants unchecked. |
| 53–57 | Trend radar, creators, research | Missing | No discovery workspace beyond `lib/discovery.ts` search helpers. |
| 58–61 | Campaigns and compliance | Missing | |
| 62–64 | Post kits and packages | Incomplete | `lib/publishing-package.ts` and `archiver` exist. Not re-verified against the file list. |
| 65–68 | Quick Clip UX | Incomplete | `components/quick-clips.tsx` exists with a narrower workflow. |
| 69–71 | Reel Factory, Autopilot | Incomplete | `lib/reel-factory.ts` (batch jobs) and `lib/workflow.ts` exist. No file-arrival triggers, schedules or approval steps verified. |
| 72–74 | Storage policies, cleanup, cache | Incomplete | `components/storage-usage.tsx`, `lib/backup.ts`. No dependency-aware cleanup preview. |
| 75–78 | Hardware profiles, scheduler, FFmpeg, frontend | Incomplete | `lib/performance.ts`, encode profiles, hardware-encode flag exist. Memory gate added. TanStack Virtual not used; heavy studios not confirmed lazy-loaded. The new explorer is lazy-loaded. |
| 79–82 | Windows setup, Docker | Incomplete | `Install-Clipper*.ps1/.cmd` exist. `setup/start/stop/update/doctor/backup.ps1` set not created; no Docker. |
| 83–90 | UI/UX libraries and workspaces | Incomplete | Radix, cmdk, lucide, zod present. Not installed: TanStack Table/Virtual, React Hook Form, Sonner, Resizable Panels, dnd-kit, Recharts, React Flow. Navigation matches the brief only partly. |
| 91–95 | Security | Incomplete | Argon2id auth, per-user isolation, localhost guard, SSRF-blocking proxy (`lib/network.ts`) exist and have tests. New endpoints use the same guard, session scope, zod-validated options and a 60 MB import cap. Rights/provenance fields not built. |
| 96–100 | Testing and benchmarking | Incomplete | 14 new tests; full suite 97 tests. No hardware benchmark, offline test, Playwright run or rendered-clip quality check was performed here. **No benchmark numbers exist and none are claimed.** |

## What this change added

- `lib/clipping/` — signal math, FFmpeg audio and visual analysis (chunked, resumable), hype dictionaries, chat and replay import, content profiles, weighted scoring with weight redistribution, candidate generation and boundary refinement, memory gate, orchestration.
- API: `moments`, `moments-import`, `moment-profiles`.
- UI: `components/moment-explorer.tsx` (lazy) mounted under Highlights.
- Tests: `tests/clipping.test.ts`, including a synthesised video with a known loud, visually busy burst and a known silent tail, analysed by real FFmpeg.

See `CLIPPING_ENGINE.md` for how the engine works and its limits.
