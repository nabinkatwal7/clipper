# Editing engine status

The current editor uses source timestamps and stores clip settings and media references in JSON. The HTML video and canvas provide a responsive source preview. FFmpeg produces short rendered previews and final exports using the same filter graph. The authenticated workspace continues to own projects, assets and renders.

| Brief sections | Current implementation | Outstanding work |
| --- | --- | --- |
| 1–5 · Architecture | Next.js, authenticated local storage, FFmpeg, versioned track data, realtime multi-layer canvas preview, hashed FFmpeg preview cache and export validation | Broader document schema; chroma-key still needs FFmpeg preview for accuracy |
| 6–9 · Editor foundation | Editor workspace, source trim, navigation markers, track properties, grouped media layers, drag/trim composition lanes, optional media proxies, undo, checkpoints and asset browser | Multi-select timeline editing and deeper NLE gestures |
| 10–13 · Transforms and animation | Crop, zoom, rotation, opacity, scale and position/gain keyframes, plus entrance/exit presets for supported layers | General-purpose curves, graph editor and loop presets |
| 14–18 · Effects and transitions | Timed effects, color tools and compilation transitions | Expanded effect catalog, effect stacking and per-cut editor transitions |
| 19–20 · Speed | Constant 0.5×–4× playback speed, optional velocity curves with segmented FFmpeg remapping, pitch-preserving audio, retimed sidecar captions | Reverse playback and motion interpolation |
| 21–24 · Text and graphics | Title overlay and imported images | Rich text layers, native stickers and motion-graphics authoring |
| 25–28 · Captions | Unicode captions, word highlighting, several ASS animations, bilingual translation, transcript cleanup and caption updates | Advanced caption motion, typography controls and dedicated caption track editing |
| 29–33 · Compositing | Media layers, color-key transparency, eight blend modes, and elliptical or rectangular masks with position, size and feather keyframes | Additional mask shapes, automatic tracking and dedicated background replacement |
| 34–39 · Audio | Waveform, track gain, EQ, filters, dynamics and ducking | Beat detection, beat snapping and richer audio monitoring |
| 40–45 · Color and enhancement | Grading panel, cube LUTs and FFmpeg effects | Scopes, adjustment layers, and broader enhancement controls |
| 46–50 · Templates and AI | Layout and workflow presets, validated Ollama Director proposals | Full project template bundles and deeper review automation |
| 51–57 · Short-form export | Aspect ratios, safe-zone previews, variations, export queue and FFmpeg quality checks | Expanded export options, hardware-accelerated export, and broader preset coverage |
| 58–67 · Interaction | Existing studio shell, keyboard actions, inspector and workspace preferences | Expanded canvas interactions, context menus and workspace presets |
| 68–73 · Reliability | Local caches, hashed composition preview cache, optional low-res media proxies, version checkpoints, isolated workspaces and authenticated routes | Broader autosave recovery |
| 74–77 · Verification | Unit suite, production build, desktop checks for Speed and mask controls, FFmpeg alpha and scale-dimension checks, and matching decoded frames for one masked preview and export fixture | Chroma key screenshot coverage and broader preview-to-export comparisons |

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
