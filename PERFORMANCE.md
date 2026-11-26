# Performance

Clipper Studio runs as a single Next.js process with an in-process job queue (`lib/jobs.ts`). There is no Redis or worker fleet.

## Current practices

- One active heavy job per project; cancellation via AbortSignal.
- Media streamed with range requests; uploads capped (assets 5 GB).
- Preview prefers proxy media when available (`lib/media-proxy.ts`).
- Waveform / thumbnail / proxy caches under the user workspace.
- Composition preview uses viewport-friendly canvas sampling; export uses FFmpeg graphs.
- Studio UI lazy-loads heavy surfaces through page routing; planned studios are not bundled until implemented.
- Capability detection (`lib/capabilities.ts`) avoids advertising unavailable encoders/filters.

## Targets for later phases

- Viewport-based timeline virtualization for very long sources
- Spectrogram / waveform worker caches
- Bounded instant-replay ring buffers
- Storage-aware queue scheduling
- Lazy dynamic imports per creative studio

Do not fake progress bars. Job progress must come from real stage updates.

## Clipping engine

No benchmark has been run for this engine, so no timing or memory figures are given. Design limits that are real:

- Analysis processes the source in 30-minute chunks, one FFmpeg process at a time, keeping only per-interval arrays in memory, and resumes finished chunks after interruption.
- Visual analysis decodes the full source video before downscaling; long high-resolution sources are slow on a CPU. Use a 2 s, 5 s or 10 s interval to reduce audio work (visual sampling stays 2 fps).
- Ollama work is sequential with a 2048-token context (4096 in Deep), at most 8 candidates (12 in Deep), and is skipped when memory is low or the model fails.
- Measure on your own hardware with Settings → System health while a job runs.
