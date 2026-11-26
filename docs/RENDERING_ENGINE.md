# Rendering engine

Final exports and short composition previews share one FFmpeg path. Settings are validated in application code; Ollama never emits shell or FFmpeg command strings.

## Pipeline

1. Load the clip’s source media and validated `Settings`.
2. Apply layout, reframe/crop keys, grading, timed effects and captions (`lib/jobs.ts`, `lib/captions.ts`, `lib/grading.ts`).
3. Overlay composition tracks through `lib/composite-render.ts` → `compose()`.
4. Apply constant playback rate, mix/duck audio and write the output container.
5. Run export QA (`lib/export-qa.ts`) with FFprobe and decode checks.

Preview jobs reuse this graph with a trimmed output window. Successful previews are stored under the workspace `temp` directory keyed by a SHA-256 of settings, timing and media fingerprints (`lib/preview-cache.ts`). Cache hits skip FFmpeg. At most 24 previews are retained per project.

Optional editor proxies (`lib/media-proxy.ts`) are ≤854px H.264 copies of source uploads or video assets. The monitor may stream them via `proxy=1`; final exports and FFmpeg render jobs always read original media. Capability detection disables unavailable encoders or filters with clear errors.

## Composition graph (`compose`)

For each enabled track:

- Image/video layers scale to the largest required size (static `size` or max scale keyframe), convert to RGBA, optional colorkey, reset PTS for time-based expressions, apply mask, rotation/flip, animated scale, opacity and fades, then overlay with the selected blend mode.
- Audio tracks contribute delayed, volume-keyed streams into `amix`, with optional sidechain ducking against source speech.

Animated scale pre-scales to the maximum keyframe size, then scales by `interpolatedSize / maxSize` so mid-animation frames are not upscaled from a smaller raster.

## Safety

- Arguments are typed arrays passed to `run()` in `lib/process.ts`.
- Paths come from `lib/store.ts` helpers and UUID asset ids.
- Composition and grade payloads are schema-validated before render.
- Temporary files are scoped to the job and cleaned up on cancel or failure.

## Instant clipping (`lib/fast-cut.ts`)

Separate from the full composition export path. Segments can export as:

- **lossless** — `-c copy` after keyframe snap (not frame-accurate)
- **accurate** — re-encode with explicit `-ss`/`-t`
- **smart** — stream copy when near a keyframe, otherwise accurate re-encode

Outputs land under `exports/fast-cuts/<projectId>/`. Overlaps are rejected before FFmpeg runs.

## Render and replace (`lib/render-replace.ts`)

Complex compositions can be baked to an intermediate asset under `assets/`. The original composition JSON is stored in `render-replace/<project>/<clip>.json` for restore. A content fingerprint marks the bake stale if the live composition changes.

## Verified limitations

- Preview is not a full realtime compositor; short FFmpeg windows are the accurate check.
- Speed is constant per clip (no velocity curves yet).
- Hardware encoders are used only when detected; software encoding is the fallback.
- Effect stacking beyond one timed effect plus grade is not implemented.

## Related docs

- [EDITOR_ARCHITECTURE.md](./EDITOR_ARCHITECTURE.md)
- [EDITING_ENGINE.md](./EDITING_ENGINE.md)
- [CONFIGURATION.md](./CONFIGURATION.md)
