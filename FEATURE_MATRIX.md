# Clipper Studio feature matrix

This inventory follows the 40 sections of the expansion brief. Implemented means a code path exists. Partial means the section notes describe a narrower capability. Planned means there is no delivered implementation for that item. The coverage statement applies only to the operations it names.

Run the unit suite with `npm test`. The FFmpeg integration fixture is `scripts/expansion-smoke.ts`. Browser layout checks are in `scripts/visual-regression.mjs`.

## 1. Advanced Highlight Discovery

Runtime dependencies — Ollama, transcript, source index.

Deep adds a second Ollama pass. Ranges and keyword rules use overlapping transcript evidence. Source indexing measures signal and scene changes.

Test coverage — Range and keyword unit tests, source-index render fixture.

| Requested feature | Status |
| --- | --- |
| Multiple-pass stream analysis | Implemented |
| Fast, balanced and deep analysis modes | Implemented |
| Audio intensity heatmaps | Implemented |
| Chat activity heatmaps where chat data is available | Implemented |
| Scene transition analysis | Implemented |
| Topic change detection using available transcripts | Partial |
| Reaction intensity estimation | Partial |
| Interesting conversation detection | Partial |
| Hook strength analysis | Partial |
| Context completeness analysis | Partial |
| Highlight similarity detection | Planned |
| Automatic highlight categorization | Planned |
| Configurable minimum engagement score | Implemented |
| Custom highlight detection rules | Partial |
| Positive and negative keyword filters | Implemented |
| User-defined highlight categories | Planned |
| Highlight bookmarks | Partial |
| Manual timestamp suggestions | Partial |
| Highlight comparison | Partial |
| Regeneration of rejected recommendations | Planned |

## 2. AI Director

Runtime dependencies — Ollama, editor.

Director accepts or rejects bounded title, range, layout and zoom proposals. A range can remove material at its ends. Internal cut sequences and multiple automatically rendered alternatives are outstanding.

Test coverage — Proposal bounds unit test.

| Requested feature | Status |
| --- | --- |
| Make this clip more engaging | Partial |
| Find a better opening | Partial |
| Remove unnecessary sections | Partial |
| Make this clip shorter than 45 seconds | Implemented |
| Suggest a stronger title | Implemented |
| Find additional context | Partial |
| Recommend a suitable video layout | Implemented |
| Suggest where to add a zoom | Partial |
| Create a dramatic version | Partial |
| Create a funny version | Partial |
| Generate three alternative edits | Partial |

## 3. Multiple Clip Variations

Runtime dependencies — Editor, FFmpeg.

Save an editor draft as a variation. Comparison tracks family and source time. Most styles require manual edit settings.

Test coverage — Render fixture preserves original and adds a variation.

| Requested feature | Status |
| --- | --- |
| Short version | Implemented |
| Extended version | Implemented |
| Fast-paced version | Planned |
| Original-paced version | Implemented |
| Caption-focused version | Implemented |
| Reaction-focused version | Partial |
| Clean version | Implemented |
| Branded version | Implemented |
| Different opening hooks | Implemented |
| Different ending points | Implemented |
| Different layouts | Implemented |
| Different aspect ratios | Implemented |

## 4. Professional Multi-Track Timeline

Runtime dependencies — Local assets, FFmpeg.

The base clip has captions and text. Additional tracks support local media assets. Ripple operations act on asset timing. No nesting or multi-select.

Test coverage — Real split, inset and audio mix fixture.

| Requested feature | Status |
| --- | --- |
| Multiple video tracks | Implemented |
| Multiple audio tracks | Implemented |
| Caption tracks | Partial |
| Text tracks | Partial |
| Image tracks | Implemented |
| Overlay tracks | Implemented |
| Effect tracks | Planned |
| Track locking | Implemented |
| Track muting | Implemented |
| Track visibility | Implemented |
| Track soloing | Implemented |
| Track duplication | Implemented |
| Track renaming | Implemented |
| Track reordering | Implemented |
| Ripple delete | Implemented |
| Ripple trimming | Implemented |
| Slip editing | Implemented |
| Clip splitting | Implemented |
| Clip duplication | Implemented |
| Clip grouping | Planned |
| Nested compositions where practical | Planned |
| Timeline snapping | Partial |
| Frame-accurate trimming | Partial |
| Multi-selection | Planned |
| Range selection | Partial |
| Timeline markers | Partial |
| In and out points | Implemented |
| Timeline scrolling and zooming | Partial |

## 5. Keyframe Animation

Runtime dependencies — Composition, FFmpeg.

Animated properties are overlay X/Y and audio gain. Other transforms are static. Rendered preview uses FFmpeg.

Test coverage — Interpolation and animated overlay fixture.

| Requested feature | Status |
| --- | --- |
| Position | Partial |
| Scale | Planned |
| Rotation | Planned |
| Opacity | Planned |
| Crop regions | Planned |
| Text positioning | Planned |
| Overlay positioning | Implemented |
| Audio volume | Implemented |
| Background effects | Planned |
| Linear interpolation | Implemented |
| Ease in | Implemented |
| Ease out | Implemented |
| Ease in and out | Implemented |
| Hold keyframes | Implemented |
| Keyframe duplication | Planned |
| Keyframe deletion | Implemented |
| Keyframe navigation | Implemented |

## 6. Professional Transitions

Runtime dependencies — FFmpeg xfade/acrossfade.

Transitions join clips in compilations. Black and white dips are fixed colors. Individual transition previews are outstanding.

Test coverage — Real cross-dissolve compilation. Other transitions lack dedicated fixtures.

| Requested feature | Status |
| --- | --- |
| Cross dissolve | Implemented |
| Fade to black | Implemented |
| Fade to white | Implemented |
| Slide | Implemented |
| Wipe | Implemented |
| Smooth zoom | Implemented |
| Dip to color | Partial |
| Push transitions | Implemented |
| Blur transitions | Implemented |

## 7. Effects Library

Runtime dependencies — FFmpeg filters.

One selected effect plus grade per clip. Range controls apply to the selected effect. Speed changes and freeze frame are outstanding.

Test coverage — Rendered time-limited sepia. Other effects lack dedicated fixtures.

| Requested feature | Status |
| --- | --- |
| Gaussian blur | Implemented |
| Background blur | Implemented |
| Sharpening | Implemented |
| Vignette | Implemented |
| Film grain | Implemented |
| Black and white | Implemented |
| Sepia | Implemented |
| Pixelation | Implemented |
| Mirror | Implemented |
| RGB color adjustment | Implemented |
| Contrast enhancement | Implemented |
| Exposure adjustment | Implemented |
| Saturation | Implemented |
| Temperature adjustment | Implemented |
| Glow approximation | Implemented |
| Freeze frame | Planned |
| Slow motion | Planned |
| Speed ramping where supported | Planned |
| Motion emphasis | Planned |
| Letterbox overlays | Implemented |

## 8. Color Grading Studio

Runtime dependencies — FFmpeg filters.

Seven nondestructive looks. Render a short adjusted preview. LUT handling and paired comparison are outstanding.

Test coverage — Graded render fixture.

| Requested feature | Status |
| --- | --- |
| Brightness | Implemented |
| Contrast | Implemented |
| Exposure | Implemented |
| Gamma | Implemented |
| Saturation | Implemented |
| Hue | Implemented |
| RGB channel adjustment | Implemented |
| Color temperature approximation | Implemented |
| Shadows | Implemented |
| Highlights | Implemented |
| LUT imports | Planned |
| LUT intensity | Planned |
| Before-and-after comparison | Partial |

## 9. Audio Mixing Studio

Runtime dependencies — FFmpeg audio filters.

FFmpeg filters and media tracks support mixing. Export QA measures peak/mean levels. Sidechain compression lowers added audio when source audio crosses its threshold, including non-speech sounds.

Test coverage — Mixed and normalized render fixture.

| Requested feature | Status |
| --- | --- |
| Individual track volume | Implemented |
| Master volume | Implemented |
| Audio waveform | Implemented |
| Peak meters | Partial |
| Audio clipping warnings | Implemented |
| Loudness measurement | Implemented |
| Normalization | Implemented |
| Noise reduction | Implemented |
| Equalizer | Implemented |
| Compressor | Implemented |
| Limiter | Implemented |
| High-pass filter | Implemented |
| Low-pass filter | Implemented |
| Audio fades | Implemented |
| Stereo balance | Implemented |
| Audio ducking | Implemented |
| Background music mixing | Implemented |
| Sound effect placement | Implemented |
| Audio extraction | Implemented |
| Audio replacement | Partial |
| Audio-only export | Implemented |

## 10. Local Asset Library

Runtime dependencies — FFprobe, filesystem.

Local video, image and audio assets support folders, tags, favorites, search and insertion. Templates and fonts are separate concerns.

Test coverage — MP4 import fixture.

| Requested feature | Status |
| --- | --- |
| Background music | Implemented |
| Sound effects | Implemented |
| Intro videos | Implemented |
| Outro videos | Implemented |
| Logos | Implemented |
| Watermarks | Implemented |
| Images | Implemented |
| B-roll footage | Implemented |
| Background videos | Implemented |
| Fonts | Planned |
| LUT files | Planned |
| Subtitle templates | Partial |
| Layout templates | Partial |
| Animation presets | Planned |
| Editing presets | Partial |

## 11. B-Roll Management

Runtime dependencies — Assets, FFmpeg.

Insert a supplied video as an overlay with size, timing, audio and fade controls. No AI asset matching.

Test coverage — Animated inset render fixture.

| Requested feature | Status |
| --- | --- |
| Local B-roll library | Implemented |
| Manual B-roll insertion | Implemented |
| Picture-in-picture | Implemented |
| Full-screen B-roll replacement | Implemented |
| Adjustable B-roll duration | Implemented |
| Automatic looping | Implemented |
| Audio muting | Implemented |
| Custom crop regions | Planned |
| Timeline placement | Implemented |
| Transition controls | Partial |

## 12. Smart Reframing

Runtime dependencies — Editor, FFmpeg.

Base clip framing is static. A moving overlay can use keyframes. Vision-based subject tracking is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Static crop | Implemented |
| Dynamic keyframed crop | Planned |
| Multiple crop regions | Planned |
| Scene-specific crop configurations | Planned |
| Custom subject positioning | Implemented |
| Smooth crop transitions | Planned |
| Manual subject tracking through keyframes | Planned |
| Vision-assisted crop suggestions using Ollama | Planned |
| Split-screen templates | Partial |
| Gameplay and facecam templates | Implemented |
| Podcast templates | Partial |
| Screen recording layouts | Partial |
| Reaction video layouts | Partial |
| Multiple video sources | Implemented |
| Platform-specific safe zones | Partial |

## 13. Caption Animation Engine

Runtime dependencies — FFmpeg libass.

ASS styling uses recorded timing. Existing captions and title overlay are available. General purpose caption animation is outstanding.

Test coverage — Caption ASS timing unit tests.

| Requested feature | Status |
| --- | --- |
| Word highlighting | Implemented |
| Phrase highlighting | Partial |
| Pop-in animation | Planned |
| Fade animation | Planned |
| Slide animation | Planned |
| Scale animation | Planned |
| Karaoke effects | Planned |
| Custom text stroke | Partial |
| Multiple text layers | Partial |
| Background boxes | Implemented |
| Dynamic keyword colors | Planned |
| Speaker-based styling when speaker information exists | Planned |
| Per-segment style overrides | Planned |
| Animated opening hooks | Partial |
| Caption presets | Implemented |
| Custom font imports | Planned |

## 14. Multi-Language Content Creation

Runtime dependencies — Ollama, transcript.

Ollama supplies translations for editable, timestamp-aligned subtitle rows. Quality depends on the installed model. Review before publishing.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| English | Implemented |
| Nepali | Implemented |
| Hindi | Implemented |
| Spanish | Implemented |
| French | Implemented |
| German | Implemented |
| Other languages supported by the selected model | Implemented |
| Subtitle translation | Implemented |
| Translated clip titles | Implemented |
| Translated descriptions | Implemented |
| Localized hashtags | Implemented |
| Bilingual subtitle layouts | Implemented |
| Side-by-side translation editing | Implemented |
| Multiple subtitle export tracks | Implemented |
| Translation presets | Partial |
| Translation cache | Implemented |

## 15. Transcript Intelligence

Runtime dependencies — Ollama /api/embed, JSON.

Search uses local embeddings, cosine similarity and stored transcript passages. Common terms are frequency counts.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Topic extraction | Partial |
| Chapter generation | Partial |
| Conversation summaries | Planned |
| Key quote extraction | Implemented |
| Question and answer detection | Planned |
| Important statement detection | Planned |
| Keyword frequency | Implemented |
| Named entity suggestions | Planned |
| Semantic transcript search | Implemented |
| Similar conversation discovery | Partial |
| Transcript comparison | Planned |
| Custom glossary | Planned |
| Automatic punctuation correction | Planned |
| Search across multiple projects | Implemented |

## 16. Stream Intelligence Reports

Runtime dependencies — Project records, source index.

Report exports JSON, Markdown and printable HTML from real metadata and optional source index. Selected duration is a setting. No calibrated confidence measure.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Stream summary | Partial |
| Main topics | Partial |
| Timeline chapters | Partial |
| Notable moments | Implemented |
| Recommended highlights | Implemented |
| Audio activity distribution | Implemented |
| Available chat activity | Planned |
| Estimated content categories | Partial |
| Number of viable clips | Partial |
| Recommended clip durations | Partial |
| Highlight confidence | Partial |
| Analysis limitations | Implemented |

## 17. Multi-Stream Compilation Builder

Runtime dependencies — FFmpeg, FFprobe.

Builder handles 2–12 clips and up to 12 minutes. Themed compilations are curated manually. Automatic grouping and compilation branding are outstanding.

Test coverage — Two-clip cross-dissolve render fixture.

| Requested feature | Status |
| --- | --- |
| Import clips from different projects | Implemented |
| Arrange clips in a custom order | Implemented |
| Combine related highlights | Implemented |
| Add transitions | Implemented |
| Normalize audio across clips | Implemented |
| Apply consistent aspect ratios | Implemented |
| Add introductory text | Planned |
| Apply branding | Planned |
| Merge subtitles with corrected timestamps | Implemented |
| Export complete compilations | Implemented |
| Best moments of the week | Partial |
| Funniest moments of the month | Partial |
| Streamer rage compilation | Partial |
| Gaming highlights compilation | Partial |
| Best podcast moments | Partial |
| Reaction compilation | Partial |

## 18. Streamer Channel Intelligence

Runtime dependencies — Project records.

Existing streamer views aggregate local project data. Production reviews are saved separately from model estimates. Feedback-driven prompt refinement is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Number of imported streams | Implemented |
| Total processed duration | Partial |
| Generated clip count | Implemented |
| Accepted and rejected highlights | Partial |
| Average clip duration | Partial |
| Most common highlight categories | Partial |
| Frequently discussed topics | Planned |
| Average estimated engagement score | Partial |
| Most productive recordings | Partial |
| Publishing history | Planned |
| Processing success rate | Planned |

## 19. Content Discovery Across Projects

Runtime dependencies — Local search, Ollama for semantic mode.

Exact, fuzzy and Ollama embedding search. Filters use project dates, maximum duration, minimum score and review status. Natural-language date parsing is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Video titles | Implemented |
| Project names | Implemented |
| Available transcripts | Implemented |
| Clip titles | Implemented |
| Clip descriptions | Implemented |
| Highlight reasoning | Implemented |
| Categories | Implemented |
| Tags | Planned |
| Streamers | Planned |
| Publishing metadata | Partial |
| Saved bookmarks | Planned |
| Exact search | Implemented |
| Fuzzy search | Implemented |
| Semantic search | Implemented |
| Advanced filters | Implemented |
| Date ranges | Implemented |
| Duration ranges | Implemented |
| Score ranges | Partial |
| Saved searches | Implemented |
| Search history | Planned |
| Show all funny clips from last month | Partial |
| Find conversations about football | Partial |
| Find unpublished clips shorter than 45 seconds | Partial |
| Find all clips involving a particular topic | Partial |
| Show high-scoring highlights that I rejected | Partial |

## 20. Smart Collections

Runtime dependencies — Search, JSON.

Manual lists store selections. Saved rules rerun a content search. Rules have the same fields as Discover.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Ready to publish | Partial |
| Best of the week | Partial |
| Clips over 90 engagement score | Implemented |
| Unpublished gaming clips | Partial |
| Funny moments | Implemented |
| Clips under 30 seconds | Implemented |
| Clips missing captions | Planned |
| Clips requiring review | Implemented |
| Favorite clips | Partial |
| Clips from a particular streamer | Partial |

## 21. Content Review Workspace

Runtime dependencies — Production ledger.

Review statuses, notes, favorites and manual scores persist locally. Review supports sequential navigation and variation playback.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Fullscreen vertical playback | Partial |
| Next and previous clip navigation | Implemented |
| Accept | Implemented |
| Reject | Implemented |
| Favorite | Implemented |
| Request edits | Implemented |
| Add review notes | Implemented |
| Change status | Implemented |
| Adjust score manually | Implemented |
| View source context | Partial |
| Compare variations | Implemented |

## 22. Social Media Preview Simulator

Runtime dependencies — Browser player.

Four named simulations share representative overlays. The safe zone is adjustable. Preview chrome stays out of exports.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| TikTok | Partial |
| Instagram Reels | Partial |
| YouTube Shorts | Partial |
| Facebook Reels | Partial |
| Username | Partial |
| Caption area | Partial |
| Like button | Partial |
| Comment button | Partial |
| Share button | Partial |
| Description area | Partial |
| Platform-specific safe zones | Partial |

## 23. Publishing Package Generator

Runtime dependencies — FFmpeg, ZIP.

Per-clip and project ZIPs include media and metadata. The clean copy omits captions. Platform metadata is a starting point for publication.

Test coverage — Real publishing ZIP fixture checks signature.

| Requested feature | Status |
| --- | --- |
| Final vertical MP4 | Implemented |
| Clean MP4 without captions | Implemented |
| Subtitle files | Implemented |
| Thumbnail | Implemented |
| Suggested title | Implemented |
| Description | Implemented |
| Hashtags | Implemented |
| Pinned comment | Implemented |
| Source attribution | Implemented |
| Original source URL | Implemented |
| Original timestamps | Implemented |
| Platform-specific metadata | Partial |
| Export settings | Implemented |
| Publishing checklist | Implemented |

## 24. Advanced Content Calendar

Runtime dependencies — Browser storage.

The existing calendar supports basic planning. Recurrence, multi-brand scheduling and an AI planner are outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Daily view | Planned |
| Weekly view | Partial |
| Monthly view | Planned |
| Kanban view | Planned |
| Unscheduled content backlog | Partial |
| Drag-and-drop planning | Planned |
| Reusable scheduling patterns | Planned |
| Recurring publishing slots | Planned |
| Multiple brand profiles | Planned |
| Multiple social platforms | Partial |
| Content category balancing | Planned |
| Manual publishing confirmation | Partial |
| Missed schedule indicators | Planned |
| Publishing notes | Partial |

## 25. Publishing Analytics

Runtime dependencies — Production ledger.

Manual numeric metrics and CSV rows are validated. CSV import validates the entire project batch before saving. Model trend analysis is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Views | Implemented |
| Likes | Implemented |
| Comments | Implemented |
| Shares | Implemented |
| Saves | Implemented |
| Watch time | Implemented |
| Average viewing duration | Implemented |
| Completion rate | Implemented |
| Followers gained | Implemented |
| Revenue | Implemented |

## 26. Content Experimentation

Runtime dependencies — Editor, ledger.

Variants can be rendered, compared and assigned observed metrics. Automatic experiment evaluation is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Titles | Implemented |
| Hooks | Implemented |
| Captions | Implemented |
| Thumbnails | Partial |
| Durations | Implemented |
| Layouts | Implemented |
| Editing styles | Implemented |

## 27. Rights and Source Management

Runtime dependencies — Source records, ledger.

The project ledger stores permission, attribution, creator, license and notes. Asset-level provenance is incomplete.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Original source URL | Implemented |
| Source platform | Partial |
| Creator name | Partial |
| Import date | Implemented |
| Original timestamps | Implemented |
| Usage permission status | Implemented |
| License information | Implemented |
| Attribution requirements | Implemented |
| User notes | Implemented |
| Third-party assets used | Partial |

## 28. Workflow Presets

Runtime dependencies — Job settings, JSON.

Seven built-ins and versioned JSON import/export. Available settings come from the current renderer and analysis engine.

Test coverage — Workflow compiler unit test.

| Requested feature | Status |
| --- | --- |
| Analysis mode | Implemented |
| Ollama model | Implemented |
| Clipping prompt | Implemented |
| Number of clips | Implemented |
| Duration range | Implemented |
| Minimum score | Implemented |
| Target aspect ratio | Implemented |
| Video layout | Implemented |
| Subtitle style | Implemented |
| Branding profile | Partial |
| Audio processing | Implemented |
| Export resolution | Implemented |
| Thumbnail template | Planned |
| Publishing metadata preferences | Planned |
| Output directory | Planned |
| Streamer highlights | Implemented |
| Gaming reactions | Implemented |
| Podcast shorts | Implemented |
| Educational clips | Implemented |
| Funny moments | Implemented |
| Quick social media clips | Implemented |
| High-quality cinematic clips | Implemented |

## 29. Visual Workflow Builder

Runtime dependencies — Workflow compiler.

Seven safe operations form a linear connected workflow. Invalid edges, loops and disconnected steps are rejected.

Test coverage — Invalid edges, cycles and disconnected operations tested.

| Requested feature | Status |
| --- | --- |
| Import source | Planned |
| Extract subtitles | Partial |
| Analyze audio | Partial |
| Detect scenes | Partial |
| Analyze with Ollama | Implemented |
| Filter highlights | Implemented |
| Select top clips | Implemented |
| Apply layout | Implemented |
| Apply subtitles | Implemented |
| Apply branding | Planned |
| Normalize audio | Implemented |
| Generate metadata | Partial |
| Create thumbnails | Partial |
| Render | Implemented |
| Export | Planned |

## 30. Batch Operations

Runtime dependencies — Local job queue.

Workflow batches use the existing queue. Import, archive and rename are not a general-purpose bulk editor.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Import multiple recordings | Partial |
| Analyze multiple projects | Implemented |
| Generate clips in batches | Implemented |
| Apply one branding profile to multiple clips | Planned |
| Change caption styles in bulk | Partial |
| Change aspect ratios in bulk | Partial |
| Regenerate publishing metadata | Planned |
| Rename files in bulk | Planned |
| Generate thumbnails in bulk | Partial |
| Export multiple projects | Partial |
| Archive completed projects | Planned |
| Delete selected temporary files | Partial |

## 31. Project Version History

Runtime dependencies — JSON, original media.

Metadata checkpoints reference original files. Restore populates an editor draft. The latest saved snapshot can be opened after interruption.

Test coverage — Edit and variation fixture invokes automatic checkpoints.

| Requested feature | Status |
| --- | --- |
| Editing changes | Implemented |
| Timeline changes | Implemented |
| Layout changes | Implemented |
| Caption edits | Implemented |
| Branding changes | Partial |
| AI recommendations | Partial |
| Export settings | Implemented |
| Automatic save | Partial |
| Manual checkpoints | Implemented |
| Named versions | Implemented |
| Restore previous version | Implemented |
| Duplicate version | Partial |
| Compare settings between versions | Partial |
| Crash recovery | Partial |

## 32. Workspace Customization

Runtime dependencies — Browser.

Existing dedicated workspaces, theme and editor preview are available. Personalized panel arrangements are outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Resizable panels | Planned |
| Collapsible panels | Partial |
| Persistent panel positions | Planned |
| Custom workspace layouts | Planned |
| Fullscreen editing | Partial |
| Distraction-free preview | Partial |
| Compact interface mode | Planned |
| Comfortable interface mode | Planned |
| Custom accent color | Planned |
| Timeline color preferences | Planned |
| Custom keyboard shortcuts | Planned |
| Clipping | Partial |
| Editing | Partial |
| Captions | Partial |
| Audio | Partial |
| Review | Partial |
| Publishing | Partial |
| Automation | Partial |

## 33. Global Activity Center

Runtime dependencies — Job queue.

Existing queue reports job activity and supports cancellation. A universal persistent event drawer is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Active downloads | Implemented |
| Active analyses | Implemented |
| Active Ollama requests | Partial |
| Active renders | Implemented |
| Pending jobs | Implemented |
| Completed jobs | Implemented |
| Failed jobs | Implemented |
| New recordings | Partial |
| Storage warnings | Partial |
| Recent exports | Partial |
| Application errors | Partial |

## 34. Local Developer Tools

Runtime dependencies — FFmpeg, FFprobe, Ollama.

Health and diagnostic export inspect the local runtime. Full request traces and per-request timings are outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Dependency health checks | Implemented |
| FFmpeg encoder capabilities | Implemented |
| FFmpeg filter availability | Implemented |
| Ollama model capabilities | Implemented |
| Local storage health | Implemented |
| Application logs | Partial |
| Processing logs | Partial |
| Failed job details | Partial |
| Generated FFmpeg arguments | Planned |
| AI response inspection | Planned |
| AI request duration | Planned |
| Cache statistics | Partial |
| Resource usage | Implemented |

## 35. Performance Optimization

Runtime dependencies — Filesystem, local runtime.

Content hashes, shared media and local caches reduce duplicate work. Encoder availability does not establish hardware throughput.

Test coverage — Existing progress and storage tests.

| Requested feature | Status |
| --- | --- |
| Content-based cache keys | Implemented |
| Media fingerprinting | Implemented |
| Duplicate file detection | Implemented |
| Incremental analysis | Partial |
| Incremental rendering where practical | Partial |
| Shared source media references | Implemented |
| Preview proxy generation | Partial |
| Thumbnail caching | Implemented |
| Waveform caching | Implemented |
| Transcript caching | Implemented |
| Embedding caching | Implemented |
| Ollama response caching | Implemented |
| Configurable analysis sampling | Partial |
| CPU-aware concurrency | Partial |
| Memory-aware processing | Planned |
| Hardware encoder detection | Partial |
| Disk-space-aware scheduling | Planned |
| Job checkpointing | Partial |
| Interrupted job recovery | Partial |

## 36. Backup, Portability and Recovery

Runtime dependencies — Filesystem, SHA-256.

Per-project or workspace filesystem snapshots optionally include media. SHA-256 restore writes a separate directory. Browser-only state needs separate handling.

Test coverage — Media snapshot and restored source fixture.

| Requested feature | Status |
| --- | --- |
| Complete workspace backup | Partial |
| Project-only backup | Implemented |
| Settings export | Partial |
| Branding export | Partial |
| Preset export | Partial |
| Clip library export | Implemented |
| Selective media backup | Implemented |
| Backup validation | Implemented |
| Project restoration | Implemented |
| Storage migration | Partial |
| Automatic metadata checkpoints | Implemented |

## 37. First-Run Experience

Runtime dependencies — Local dependencies.

Health and diagnostics expose dependency information. A complete guided first-launch setup is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Check FFmpeg | Partial |
| Check FFprobe | Partial |
| Check yt-dlp | Partial |
| Check Ollama | Partial |
| Discover installed models | Partial |
| Select the preferred text model | Partial |
| Select optional vision and embedding models | Partial |
| Configure the storage directory | Partial |
| Verify available disk space | Partial |
| Detect available encoders | Partial |
| Test the processing pipeline | Partial |

## 38. Professional Export Quality Assurance

Runtime dependencies — FFprobe, FFmpeg.

FFprobe metadata and FFmpeg decode, black/frozen intervals and level checks produce warnings. Black or still content may be intentional.

Test coverage — Actual rendered output verified by application QA.

| Requested feature | Status |
| --- | --- |
| File readability | Implemented |
| Video duration | Implemented |
| Output resolution | Implemented |
| Aspect ratio | Implemented |
| Frame rate | Implemented |
| Audio presence when expected | Implemented |
| Audio loudness | Implemented |
| File size | Implemented |
| Corruption indicators | Implemented |
| Unexpected black frames | Implemented |
| Unexpected frozen frames | Implemented |

## 39. Local API and CLI

Runtime dependencies — Node, loopback API.

CLI calls the loopback API used by the UI. URL import, queue operations, reports and ZIP export are supported.

Test coverage — API entry points exercised in render fixture.

| Requested feature | Status |
| --- | --- |
| Importing sources | Implemented |
| Analyzing recordings | Implemented |
| Generating clips | Implemented |
| Rendering clips | Implemented |
| Exporting projects | Implemented |
| Listing jobs | Implemented |
| Checking dependency status | Implemented |

## 40. Extensibility

Runtime dependencies — TypeScript.

Typed effects and workflow tables are extension points. There is one filesystem implementation and no plugin loader.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Source importers | Partial |
| Analysis strategies | Partial |
| Ollama tasks | Partial |
| Video effects | Implemented |
| Layout templates | Partial |
| Subtitle styles | Partial |
| Export presets | Partial |
| Workflow operations | Implemented |
| Storage providers | Partial |
