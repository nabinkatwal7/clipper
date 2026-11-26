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

### Measured: moment analysis on one machine

Measured with `scripts/benchmark-analysis.ts` on: AMD Ryzen 7 5700G, 16 logical cores, 63 GB RAM, Windows, Node 24, FFmpeg 9.1 (software decoding). **This is not an Intel Core i5 / 8 GB machine; no such measurement exists yet.** Sources are synthesised (flat gray picture, a tone, and a noise burst with a picture overlay every 5 minutes), so they decode far more cheaply than real footage. Treat the times as a lower bound and the memory figures as indicative of the design, not of real content.

| Source | Analysis time | Speed vs. real time | Peak Node memory | Peak FFmpeg memory | Avg. system CPU |
| --- | --- | --- | --- | --- | --- |
| 10 min, 320x180 @ 10 fps | 1.2 s | ~490x | 89 MB | 20 MB | 35% |
| 60 min, 320x180 @ 10 fps | 2.3 s | ~1,500x | 87 MB | 29 MB | 36% |
| 10 min, 1280x720 @ 30 fps | 6.1 s | ~98x | 64 MB | 35 MB | 37% |
| 60 min, 1280x720 @ 30 fps | 38.9 s | ~93x | 70 MB | 43 MB | 41% |

What these do show:

- Memory stays flat as the source gets longer (a 60-minute source used no more than a 10-minute one), consistent with chunked streaming analysis that never holds the video in RAM.
- On every run the strongest candidates sat on the known bursts (5 of 5 in both 60-minute runs, within 40 s of a burst). That checks the pipeline, not scoring quality on real content.
- Interruption and resume: a 60-minute run aborted after the first 30-minute chunk left that chunk's audio and visual result files on disk, and the next run completed and produced the same five candidates.

What they do not show: Ollama inference time, render time, browser responsiveness, behaviour under 8 GB of RAM, 4-hour or 8-hour sources, real-world footage, or Nepali/Hindi subtitle workloads. Rerun on the target hardware with `npx tsx --env-file=.env.local scripts/benchmark-analysis.ts 10 60 --720p`.

### Design limits that are real

- Analysis processes the source in 30-minute chunks, one FFmpeg process at a time, keeping only per-interval arrays in memory, and resumes finished chunks after interruption.
- Visual analysis decodes the full source video before downscaling; long high-resolution real footage will be slower than the table above. A 2 s, 5 s or 10 s interval reduces audio work (visual sampling stays 2 fps).
- Ollama work is sequential with a 2048-token context (4096 in Deep), at most 8 candidates (12 in Deep), and is skipped when memory is low or the model fails. One real call took about 17 s for one candidate on the machine above.
- Measure on your own hardware with Settings → System health while a job runs.
