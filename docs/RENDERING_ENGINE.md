# Rendering engine

Final exports and short composition previews share one FFmpeg path. Settings are validated in application code; Ollama never emits shell or FFmpeg command strings.

## Pipeline

1. Load the clip’s source media and validated `Settings`.
2. Apply layout, reframe/crop keys, grading, timed effects and captions (`lib/jobs.ts`, `lib/captions.ts`, `lib/grading.ts`).
3. Overlay composition tracks through `lib/composite-render.ts` → `compose()`.
4. Apply constant playback rate, mix/duck audio and write the output container.
5. Run export QA (`lib/export-qa.ts`) with FFprobe and decode checks.

Preview jobs reuse this graph with a trimmed output window. Capability detection disables unavailable encoders or filters with clear errors.

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

## Verified limitations

- Preview is not a full realtime compositor; short FFmpeg windows are the accurate check.
- Speed is constant per clip (no velocity curves yet).
- Hardware encoders are used only when detected; software encoding is the fallback.
- Effect stacking beyond one timed effect plus grade is not implemented.

## Related docs

- [EDITOR_ARCHITECTURE.md](./EDITOR_ARCHITECTURE.md)
- [EDITING_ENGINE.md](./EDITING_ENGINE.md)
- [CONFIGURATION.md](./CONFIGURATION.md)
