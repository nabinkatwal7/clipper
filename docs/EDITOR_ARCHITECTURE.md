# Editor architecture

Clipper Studio keeps a single authenticated Next.js app. Editing is non-destructive: original media stays on disk and every change updates clip settings JSON.

## Composition model

`lib/composition.ts` defines versioned compositions (`version: 1`) with up to 16 tracks. Each track references a local asset by UUID and stores timeline placement (`at`, `length`, `slip`), visual placement (`x`, `y`, `size`, `opacity`), audio (`volume`, `muted`, `fade`), and optional chroma key, mask, blend mode and layer transform fields.

Keyframeable properties: `x`, `y`, `volume`, `rotation`, `opacity`, `size`. Interpolation lives in `lib/keyframe-curve.ts` and is shared by preview renders and final export.

`validateComposition` rejects unsupported animation keys, out-of-range values and visual-only keys on audio tracks.

## Workspace UI

| Surface | Role |
| --- | --- |
| `components/video-editor.tsx` | Full editor shell, undo/redo, save, tabs |
| `components/edit-timeline.tsx` | Source trim, markers, zoom, composition drag/trim gestures |
| `components/layers-panel.tsx` | Track CRUD, transforms, masks, chroma, keyframes |
| `components/editor-monitor.tsx` | Fast source canvas (layout, crop, captions) |
| `components/render-preview.tsx` | Short FFmpeg composition preview |
| `components/grade-panel.tsx` | Color grading and timed effects |
| `components/director-panel.tsx` | Validated Ollama edit proposals |

Workspace preferences persist in browser storage (`lib/client-storage.ts`). Project ownership and media paths stay server-side behind the session.

## Preview vs export

The HTML video and canvas monitor show source framing quickly. Accurate composites (layers, masks, blends, animated scale/rotation/opacity) require `POST /api/render-preview`, which runs the same filter graph as final export for a short window.

Outstanding for later phases: realtime multi-layer canvas preview, proxy media workflow, deeper timeline gestures on composition lanes, graph editor and entrance/exit animation presets.

## Related docs

- [EDITING_ENGINE.md](./EDITING_ENGINE.md) — brief coverage and operator notes
- [RENDERING_ENGINE.md](./RENDERING_ENGINE.md) — FFmpeg graph construction
- [FEATURE_MATRIX.md](../FEATURE_MATRIX.md) — feature inventory
