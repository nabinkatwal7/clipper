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
