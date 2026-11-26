# Clipper Studio — Creative Platform Expansion Roadmap

Status reflects the codebase after Phase 1 foundations landed. Features marked **planned** must not be advertised as complete on the public site.

## Phase status

| Phase | Focus | Status |
| --- | --- | --- |
| 1 | Shared foundations | **In progress** — registry, capabilities, sequences, asset refs, workspace switcher |
| 2 | Clipping productivity | **In progress** — transcript cuts, instant clip, monitors, suggestions, Moment Search, Creator Memory, Reel Factory |
| 3 | Professional video workflows | **In progress** — sequences, bins, render-and-replace |
| 4 | Language Studio | Partial (subtitle studio live) |
| 5 | Audio production | **In progress** — mixer, restoration/spectrogram, soundboard + sequencer |
| 6 | Design Studio | Partial — formats, gradients, bulk CSV, PNG export |
| 7 | Motion Studio | Partial — presets, canvas preview, animation recipes → composition |
| 8 | Recording Studio | **Live** — capture, scenes, rolling replay buffer, bookmark scrub |
| 9 | Compositing Studio | Partial — node graph + FFmpeg bake to asset (60s cap) |
| 10 | Media Toolbox | Partial — inspect/convert/extract/batch (8) |
| 11 | Production and Review | Partial — desk/calendar + Review Studio live |
| 12 | Automation | Partial (workflow builder live) |
| 13 | Optional 3D Studio | Planned |
| 14 | AI Laboratory + original features | Partial — director/templates + Ollama lab playground |
| 15 | Professional product quality | Ongoing |

## Phase 1 checklist

| Item | Module | Status |
| --- | --- | --- |
| Studio registry | `lib/studios.ts` | Implemented |
| Capability detection | `lib/capabilities.ts`, `GET /api/capabilities` | Implemented |
| Workspace switcher | `components/workspace-nav.tsx`, `studio-shell.tsx` | Implemented |
| Project sequences + migration | `lib/sequences.ts`, settings `sequences` | Implemented (scaffold) |
| Asset fingerprint + usage refs | `lib/assets.ts` | Implemented |
| Docs / feature matrix | this file, ARCHITECTURE, FEATURE_MATRIX | Implemented |

## Compatibility rules

- Do not rebuild working clipping/editor features.
- Ollama remains the only AI service.
- Filesystem JSON remains the persistence layer.
- Planned studios stay out of primary navigation until functional.
- Public marketing pages must only claim Implemented matrix rows.

## Next implementation priority (Phase 2)

1. ~~Transcript-based non-destructive cuts~~
2. ~~Fast lossless / frame-accurate clip modes~~
3. ~~Source + program monitors~~
4. ~~Smart dialogue suggestions (approval-gated)~~
5. ~~Moment Search + Creator Memory scaffolds~~
6. ~~Reel Factory batch UI~~
7. ~~Language Factory batch UI~~
8. ~~Natural-language rough cut generator~~
9. ~~Nested sequences UI / project bins~~
10. ~~Edit Recipes~~
11. ~~Clip Family Tree~~
12. ~~Media Toolbox (HandBrake-style)~~
13. ~~Render and Replace~~
14. ~~Audio restoration spectrogram~~
15. ~~Soundboard / basic sequencer~~
16. ~~Recording Studio (getDisplayMedia)~~
17. ~~Motion Studio scaffold~~
18. ~~Instant replay / bookmark scrub~~
19. ~~Compositing Studio foundations~~
20. ~~Compositing graph → FFmpeg bake~~
21. ~~Deeper motion presets + preview~~
22. ~~Separate-track recording (mic/system split where supported)~~
23. ~~Tutorial callouts / cursor markers scaffold~~
24. ~~Media toolbox batch encode + track extract~~
25. ~~Review Studio (local notes / approvals)~~
26. ~~Design Studio artboard scaffold~~
27. ~~AI Laboratory prompt playground (Ollama-only)~~

Priority queue through item 27 is complete.

### Optional scopes (in progress)

28. ~~Design Studio depth (formats / bulk / PNG export)~~
29. Image editor (raster corrections)
30. Compositing node depth
31. 3D Studio scaffold
