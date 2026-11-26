# Clipping engine (no-AI "Instant" mode)

Finds candidate moments from measured signals only. No Ollama, no network, no API keys. Code: `lib/clipping/`.

## Pipeline

1. **Analyse** (`media-analysis.ts`, `engine.ts#ensureSignals`) — the source is processed in 30-minute chunks, one FFmpeg process at a time, after a free-memory check (`resources.ts`, default 700 MB, `CLIPPER_MIN_FREE_MB`). Each finished chunk is written to `storage/.../temp/<project>.signals.*.json`, so an interrupted run resumes at the next chunk. Nothing is held in RAM beyond one chunk's per-interval arrays.
   - Audio: 16 kHz mono, `astats` RMS and peak per interval, `silencedetect` (-40 dB, 0.4 s).
   - Visual: 2 fps, 160 px wide, FFmpeg `scene_score` per frame. Its mean per interval is the motion estimate; frames at or above 0.3 are recorded as cuts.
2. **Normalise** (`signals.ts`) — each signal is scaled against its own median and MAD, so a constantly loud recording is not maximal everywhere. Flat signals score 0 and are excluded from the mix.
3. **Add optional evidence** — transcript/subtitles (hype words, speech pacing), imported chat (`chat.ts`), imported replay heatmap (`replay.ts`). Absent inputs are reported, never synthesised.
4. **Combine** (`scoring.ts`) — profile weights, renormalised over the signals that are present and informative, then lightly smoothed.
5. **Candidates** (`candidates.ts`) — local maxima → window grown while the score stays above 55 % of the peak → pre/post context → min/max duration → boundary refinement → overlap merge → minimum spacing → near-duplicate transcript removal → top N → chronological.
6. **Boundary refinement** — never cuts inside a subtitle line, finishes an unfinished sentence (up to two following lines), trims long leading silence, else snaps to silence or scene cuts. Each candidate records its `precision`: `transcript`, `media` or `duration-only`.

Output: `<project>.moments.json` with all tracks, candidates, per-candidate score breakdown, and warnings. The UI renders those tracks directly.

## Inputs

| Input | How | Notes |
| --- | --- | --- |
| Chat log | JSON array of seconds or objects, `{comments:[…]}` (Twitch downloader style), or CSV with a time column | Rows that cannot be parsed are counted and skipped. Manual offset in seconds. |
| Replay heatmap | JSON array, or `{start_time,end_time,value}` rows (the shape yt-dlp reports as `heatmap`) | Coverage below 90 % is flagged. |
| Profiles | 13 built in; custom profiles validate via `parseProfile` | Versioned JSON, schema in `profiles.ts`. No UI yet. |

## API

- `GET /api/moments?project=ID` — latest result and whether chat/replay are imported.
- `POST /api/moments?project=ID` — queue analysis. Body: `profile, count, interval (1|2|5|10), minScore, minDuration, maxDuration, weights, chatOffset`. Validated with zod.
- `POST /api/moments-import` — `{project, kind: "chat"|"replay", text, format}`.
- `GET /api/moment-profiles` — profiles, default weights, dictionaries, free/total memory.
- Rendering selected candidates reuses `POST /api/generate` with `ranges`.

## Limits (read before trusting a score)

- Scores rank moments for human review. They are not validated predictions of virality or interest. Default weights are starting values.
- Audio level alone does not show that something interesting happened; the engine warns when audio is the only signal.
- "Loudness" is RMS in dB, not LUFS. Onset activity is approximated by the rise over the trailing median.
- Hype dictionaries are small starter lists. Matching is exact on normalised text; misspellings and slang outside the lists are missed.
- Without a transcript, edges rely on silence and scene cuts and may land mid-sentence.
- Silence uses a fixed -40 dB threshold; a very quiet recording can read as mostly silent.
- Visual analysis decodes the full source video (downscaling happens after decode). Long 1080p+ sources are slow on a laptop CPU. A proxy-based path is not wired in yet.
- Not benchmarked. No timing or memory figures are claimed.

## Tests

`tests/clipping.test.ts`: unit tests for every module plus a real-FFmpeg fixture (needs `FFMPEG_BIN`; `npm test` loads `.env.local`). The fixture video has a known loud, visually busy burst at 10–14 s and silence from 20 s; the test asserts the analysis finds both and that the top candidate covers the burst.

## Beyond Instant mode

- **Ollama layer** (`ai.ts`): after the formula engine has produced candidates, the top 8 (12 in Deep) with transcript text are read one at a time by the installed model (context 2048, or 4096 in Deep). It returns validated JSON: hook, payoff, completeness and clarity (0–10), a category, title, hashtags, optional opening text, reason. These are labelled `ai-estimate` and never overwrite the measured score; `rankScore` blends them for display only (70/30). The model never proposes timestamps. Failures (unreachable, no model, invalid JSON, timeout, out of memory) keep the measured result, fill template metadata and explain what was skipped; three consecutive failures stop further requests. Verified against a real `qwen2.5:3b` (about 17 s for one candidate on a desktop CPU).
- **Campaigns** (`campaigns.ts`): validated rule sets and a compliance engine returning `pass`, `fail` or `needs-review` per check. Measurable facts (duration, ratio, resolution, hashtags, excluded words, watermark text, attribution text) are checked; captions language, source rights and review are human items unless you recorded them in the rights ledger. A recorded "permitted" is shown as your assertion, not as verified.
- **Discovery** (`feeds.ts`, `discovery-store.ts`, `niche.ts`): Atom/RSS parsing (YouTube feeds include view counts), polling that refuses to hit a feed before its interval, per-hop SSRF validation, observation history, velocity from two real readings at least 10 minutes apart, staleness labels, token-count topics, and Ollama topic summaries that must cite titles.
- **Autopilot** (`autopilot-core.ts`, `autopilot.ts`): import → analyse → (AI) → select → approval → render → validate, each step idempotent and recorded in a run history; failed runs resume from the failed step. Triggers baseline existing uploads/files so only later arrivals are processed.
- **Storage** (`storage.ts`) and **system** (`system.ts`): see `docs/SELF_HOSTING.md`.
- **Quick Clip** posts to `/api/quick-clip`, which creates an internal Autopilot definition and runs the same pipeline.

Persisted data (per user, JSON): `data/campaigns.json`, `profiles.json`, `creators.json`, `videos.json`, `research.json`, `autopilots.json`, `runs.json`, `settings.json`. Reads are cached by file size and mtime; writes are atomic with retry for Windows file-locking.
