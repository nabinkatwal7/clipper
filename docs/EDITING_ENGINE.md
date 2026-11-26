# Editing engine status

The current editor uses source timestamps and stores clip settings and media references in JSON. The HTML video and canvas provide a responsive source preview. FFmpeg produces short rendered previews and final exports using the same filter graph. The authenticated workspace continues to own projects, assets and renders.

| Brief sections | Current implementation | Outstanding work |
| --- | --- | --- |
| 1–5 · Architecture | Next.js, authenticated local storage, FFmpeg, versioned track data, realtime multi-layer canvas preview (including chroma key), hashed FFmpeg preview cache and export validation | CapCut-parity document interchange formats |
| 6–9 · Editor foundation | Editor workspace, source trim, navigation markers, track properties, grouped media layers, drag/trim, multi-select moves, proxies, undo, checkpoints, asset browser | Vendor-level NLE gesture parity |
| 10–13 · Transforms and animation | Crop, zoom, rotation, opacity, scale and position/gain keyframes, entrance/exit/loop presets, Bézier easing, keyframe graph, motion interpolation on export | Freeform custom Bézier control points in the UI |
| 14–18 · Effects and transitions | Timed effect stack, color tools, compilation transitions, and per-cut intro fades/slides/wipes | Full xfade graph between arbitrary in-clip spans |
| 19–20 · Speed | Constant 0.5×–4×, velocity curves, reverse export, motion interpolation, pitch-preserving audio, retimed captions | Reverse HTML5 monitor playback |
| 21–24 · Text and graphics | Title overlay, composition text layers (drawtext), image layers as stickers | Dedicated motion-graphics timeline |
| 25–28 · Captions | Unicode captions, word highlighting, fade/pop/slide/scale/bounce/typewriter, spacing, bilingual translation, caption track editor | Speaker styles and imported font files |
| 29–33 · Compositing | Media layers, chroma key (canvas + FFmpeg), blend modes, ellipse/rectangle/diamond/rounded masks, mask follow-layer, background-asset ordering | Optical flow tracking |
| 34–39 · Audio | Waveform, gain, EQ, filters, dynamics, ducking, beat detect/snap, preview level meter | Multichannel metering suites |
| 40–45 · Color and enhancement | Grading, LUTs, effect stacks, adjustment layers, histogram/waveform/parade scopes | Vectorscope |
| 46–50 · Templates and AI | Built-in and user JSON templates (including sample composition), layout presets, Ollama Director | Packaged media ZIP template installs |
| 51–57 · Short-form export | Aspect ratios, safe zones, variations, draft/archive/fast/balanced/quality, optional hardware H.264, FFmpeg QA | Broader hardware codec matrix |
| 58–67 · Interaction | Studio shell, keyboard actions, inspector, clip context menu, workspace zoom/snap/tool presets | Full canvas transform gizmos |
| 68–73 · Reliability | Caches, proxies, checkpoints, local + server edit drafts, isolated workspaces, auth | Multi-device draft sync |
| 74–77 · Verification | Unit suite (including chroma), production build, FFmpeg checks, masked preview fixtures | Exhaustive pixel-diff suite across every filter |

## Using speed and chroma key

In the editor, open **Speed** to set a constant speed and render a short preview. Trim and keyframe inputs use source timestamps. The renderer retimes the composed video and audio after it applies captions and layer effects. Exported subtitle timestamps are relative to the rendered clip.

In **Layers**, insert an image or video, select the layer and open **Chroma key**. Choose a color and tune similarity and edge blend. The source monitor approximates transparency in realtime; use **Preview from playhead** for FFmpeg-accurate results.

Open **Shape mask** for ellipse, rectangle, diamond or rounded masks. **Track mask to layer** copies layer position keys onto the mask. **Use layer below as background** pins that asset under keyed layers during export.

Choose **Preview from playhead** in Layers, Grading, Audio or Speed to render up to three seconds at the edited playback rate.
