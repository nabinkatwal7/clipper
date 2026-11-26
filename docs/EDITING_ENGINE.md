# Editing engine status

The current editor uses source timestamps and stores clip settings and media references in JSON. The HTML video and canvas provide a responsive source preview. FFmpeg produces short rendered previews and final exports using the same filter graph. The authenticated workspace continues to own projects, assets and renders.

| Brief sections | Current implementation | Outstanding work |
| --- | --- | --- |
| 1–5 · Architecture | Next.js, authenticated local storage, FFmpeg, versioned track data, realtime multi-layer canvas preview (including chroma key), hashed FFmpeg preview cache and export validation | Broader document schema |
| 6–9 · Editor foundation | Editor workspace, source trim, navigation markers, track properties, grouped media layers, drag/trim composition lanes, multi-select moves, optional media proxies, undo, checkpoints and asset browser | Deeper NLE gestures |
| 10–13 · Transforms and animation | Crop, zoom, rotation, opacity, scale and position/gain keyframes, entrance/exit and loop presets, Bézier easing, and a draggable keyframe graph | Motion interpolation |
| 14–18 · Effects and transitions | Timed effect stack (edge, RGB shift, posterize, invert), color tools, compilation transitions, and per-cut intro fades in the clip renderer | Broader transition catalog in the single-clip path |
| 19–20 · Speed | Constant 0.5×–4× playback speed, optional velocity curves, reverse export, pitch-preserving audio, retimed sidecar captions | Motion interpolation |
| 21–24 · Text and graphics | Title overlay, composition text layers (drawtext), and imported images | Native stickers and motion-graphics authoring |
| 25–28 · Captions | Unicode captions, word highlighting, fade/pop/slide/scale/bounce/typewriter animations, spacing, bilingual translation, transcript cleanup, and a dedicated caption track editor | Further typography tooling |
| 29–33 · Compositing | Media layers, color-key transparency, eight blend modes, ellipse/rectangle/diamond/rounded masks with keyframes, mask follow-layer, and background-slot hints | Full background-replace pipeline metadata |
| 34–39 · Audio | Waveform, track gain, EQ, filters, dynamics, ducking, onset beat detection, timeline snap, and preview level meter | Richer audio monitoring |
| 40–45 · Color and enhancement | Grading panel, cube LUTs, effect stacks, adjustment layers, RGB/luma histogram, waveform and parade scopes | Broader enhancement controls |
| 46–50 · Templates and AI | Built-in and user JSON templates (including sample composition layout), layout presets, validated Ollama Director proposals | Project media bundles and review automation |
| 51–57 · Short-form export | Aspect ratios, safe-zone previews, variations, export queue, draft/archive profiles, optional hardware H.264, and FFmpeg quality checks | Broader preset coverage |
| 58–67 · Interaction | Studio shell, keyboard actions, inspector, clip context menu, and persisted workspace zoom/snap | Expanded canvas tool presets |
| 68–73 · Reliability | Local caches, hashed composition preview cache, optional proxies, version checkpoints, editor draft autosave, isolated workspaces and authenticated routes | Server-side autosave |
| 74–77 · Verification | Unit suite (including chroma key), production build, desktop checks, FFmpeg alpha checks, and masked preview fixtures | Broader preview-to-export comparisons |

## Using speed and chroma key

In the editor, open **Speed** to set a constant speed and render a short preview. Trim and keyframe inputs use source timestamps. The renderer retimes the composed video and audio after it applies captions and layer effects. Exported subtitle timestamps are relative to the rendered clip.

In **Layers**, insert an image or video, select the layer and open **Chroma key**. Choose a color and tune similarity and edge blend. Use the rendered layer preview to inspect transparency. The source monitor provides a source preview, and the short rendered preview shows the composited result.

Open **Shape mask** in the same panel to retain the inside or outside of an ellipse or rectangle. Size and position are relative to the individual layer. The mask multiplies the layer’s existing transparency, including chroma key. Render a short composition preview to inspect it.

Move the playhead within the layer and choose **Set mask keyframe**. Adjust its center, width, height and feather, then move the playhead and add another keyframe. The renderer interpolates linearly and holds the end values outside the keyframe range. Use the keyframe list to jump to a keyframe, edit it or delete it.

Choose **Preview from playhead** in Layers, Grading, Audio or Speed to render up to three seconds at the edited playback rate. FFmpeg evaluates the composition from its trim start before discarding frames prior to the preview window. This preserves mask, effect and audio timing. Previewing near the end of a long edit can therefore take longer.

Choose **Blend mode** on an image or video layer. Multiply darkens, Screen brightens, and Overlay combines the two according to the underlying pixels. Darken, Lighten, Add and Difference are also available. The mode uses the layer’s existing transparency, including opacity, feathered masks, and chroma key. Use **Preview from playhead** to inspect the composite.

Open **Layer transform** to rotate an image or video layer from −180° to 180°, or mirror it horizontally and vertically. Chroma key and masks move with the transformed layer. Rotation expands the layer bounds and leaves the corners transparent. The existing position controls place those bounds on the canvas.

To animate rotation, choose **Rotation** under **Keyframes**. Set an angle in **Layer transform** and add a keyframe at the playhead. Repeat at another time. Each keyframe determines the interpolation toward the next one. The renderer uses a fixed transparent square large enough for every angle, so the layer turns about its center without its bounds changing during playback. Mirroring is static.

Choose **Opacity** under **Keyframes** to animate an image or video layer’s transparency. Set a value from 0% to 100% and add it at the playhead. The keyframes multiply any transparency already present in the layer, including masks and chroma key. Layer fades and blend modes still apply.

Choose **Scale** under **Keyframes** to animate layer size. Values match the **size** field (5%–100% of the canvas). The renderer scales the layer up to the largest keyframe size first, then interpolates down or up so mid-animation frames are not upscaled from a smaller raster. Position still uses the overlay placement formula, so a centered layer stays centered while it grows or shrinks.

Open **Animation presets** on an image or video layer to apply fade, slide, zoom, pop or rotate entrance and exit keyframes. Presets merge into the existing keyframe lists and remain editable. Use **Duplicate** on a keyframe row to copy it 0.25 seconds later when that slot is free.
