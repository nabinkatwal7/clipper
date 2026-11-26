# Editing engine status

The current editor uses source timestamps and stores clip settings and media references in JSON. The HTML video and canvas provide a responsive source preview. FFmpeg produces short rendered previews and final exports using the same filter graph. The authenticated workspace continues to own projects, assets and renders.

| Brief sections | Current implementation | Outstanding work |
| --- | --- | --- |
| 1–5 · Architecture | Next.js, authenticated local storage, FFmpeg, versioned track data, realtime multi-layer canvas preview (including chroma key), schemaVersion settings, hashed preview cache and export validation | — |
| 6–9 · Editor foundation | Editor workspace, source trim, markers, track properties, grouped layers, drag/trim, multi-select, proxies, undo, checkpoints, asset browser, canvas transform gizmos | — |
| 10–13 · Transforms and animation | Keyframes with freeform Bézier handles, entrance/exit/loop presets, keyframe graph, motion interpolation | — |
| 14–18 · Effects and transitions | Timed effect stacks (incl. freeze/motionblur), effect tracks, color tools, compilation + per-cut + span transitions | — |
| 19–20 · Speed | Constant/curve speed, reverse export and HTML5 reverse scrub monitor, motion interpolation, retimed captions | — |
| 21–24 · Text and graphics | Title overlay, text layers, shape motion-graphics (rect/ellipse/line), image stickers | — |
| 25–28 · Captions | Unicode captions, karaoke/phrase highlight, bounce/typewriter, spacing, speaker styles, custom font name, caption track editor | — |
| 29–33 · Compositing | Chroma (canvas+FFmpeg), blend modes, ellipse/rectangle/diamond/rounded masks, mask follow, block-match motion track, background-asset order, nested compositions (1 level) | — |
| 34–39 · Audio | Waveform, gain, EQ, filters, dynamics, ducking, beat detect/snap, stereo peak meters with hold | — |
| 40–45 · Color and enhancement | Grading, LUTs, stacks, adjustment layers, histogram/waveform/parade/vectorscope | — |
| 46–50 · Templates and AI | Built-in/user JSON templates, ZIP pack import/export with assets, Ollama Director | — |
| 51–57 · Short-form export | Aspect ratios, safe zones, variations, draft/archive/quality profiles, nvenc/qsv/amf/videotoolbox/libx264, FFmpeg QA | — |
| 58–67 · Interaction | Studio shell, keyboard, inspector, context menu, workspace zoom/snap/tool presets, canvas gizmos | — |
| 68–73 · Reliability | Caches, proxies, checkpoints, local + server edit drafts, isolated workspaces, auth | — |
| 74–77 · Verification | Unit suite, `npm run pixel-diff` filter hash stability, production build, FFmpeg checks | — |

## Operator notes

Open **Speed** for rate, reverse (export + monitor scrub), motion interpolation, and span transitions. **Layers** adds text/shapes/stickers, chroma, masks, motion track, and animation presets with Bézier graph handles. **Scopes** includes vectorscope. **Templates** can download/upload ZIP packs. Run `npm run pixel-diff` for filter frame-hash checks.
