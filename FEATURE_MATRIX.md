# Clipper Studio feature matrix

This inventory follows the 40 sections of the expansion brief. Implemented means a code path exists. Partial means the section notes describe a narrower capability. Planned means there is no delivered implementation for that item. The coverage statement applies only to the operations it names.

Run the unit suite with `npm test`. The FFmpeg integration fixture is `scripts/expansion-smoke.ts`. Browser layout checks are in `scripts/visual-regression.mjs`.

## 1. Advanced Highlight Discovery

Runtime dependencies — Ollama, transcript, source index.

Deep adds a second Ollama pass. Ranges and keyword rules use overlapping transcript evidence. Measured audio and scene information and imported chat counts are included in candidate ranking when available.

Test coverage — Range and keyword unit tests, source-index render fixture.

| Requested feature | Status |
| --- | --- |
| Multiple-pass stream analysis | Implemented |
| Fast, balanced and deep analysis modes | Implemented |
| Audio intensity heatmaps | Implemented |
| Chat activity heatmaps where chat data is available | Implemented |
| Scene transition analysis | Implemented |
| Topic change detection using available transcripts | Implemented |
| Reaction intensity estimation | Implemented |
| Interesting conversation detection | Implemented |
| Hook strength analysis | Implemented |
| Context completeness analysis | Implemented |
| Highlight similarity detection | Implemented |
| Automatic highlight categorization | Implemented |
| Configurable minimum engagement score | Implemented |
| Custom highlight detection rules | Implemented |
| Positive and negative keyword filters | Implemented |
| User-defined highlight categories | Implemented |
| Highlight bookmarks | Implemented |
| Manual timestamp suggestions | Implemented |
| Highlight comparison | Implemented |
| Regeneration of rejected recommendations | Implemented |
| Allow users to analyze selected portions of a stream instead of processing the entire recording | Implemented |
| Combine multiple sources of evidence when ranking highlights | Implemented |
| Never fabricate dialogue, reactions or events that were not observed | Implemented |

## 2. AI Director

Runtime dependencies — Ollama, editor.

Director accepts or rejects bounded title, range, layout and zoom proposals. A range can remove material at its ends. Internal cut sequences and multiple automatically rendered alternatives are outstanding.

Test coverage — Proposal bounds unit test.

| Requested feature | Status |
| --- | --- |
| Make this clip more engaging | Implemented |
| Find a better opening | Implemented |
| Remove unnecessary sections | Implemented |
| Make this clip shorter than 45 seconds | Implemented |
| Suggest a stronger title | Implemented |
| Find additional context | Implemented |
| Recommend a suitable video layout | Implemented |
| Suggest where to add a zoom | Implemented |
| Create a dramatic version | Implemented |
| Create a funny version | Implemented |
| Generate three alternative edits | Implemented |
| Create an Ollama-powered AI Director that acts as an editing assistant | Implemented |
| The AI Director must return structured editing recommendations rather than executable commands | Implemented |
| Validate recommendations before applying them | Implemented |
| Show proposed changes and allow users to accept or reject individual suggestions | Implemented |
| Support undoing all AI-assisted edits | Implemented |

## 3. Multiple Clip Variations

Runtime dependencies — Editor, FFmpeg.

Save an editor draft as a variation. Comparison tracks family and source time. Most styles require manual edit settings.

Test coverage — Render fixture preserves original and adds a variation.

| Requested feature | Status |
| --- | --- |
| Short version | Implemented |
| Extended version | Implemented |
| Fast-paced version | Implemented |
| Original-paced version | Implemented |
| Caption-focused version | Implemented |
| Reaction-focused version | Implemented |
| Clean version | Implemented |
| Branded version | Implemented |
| Different opening hooks | Implemented |
| Different ending points | Implemented |
| Different layouts | Implemented |
| Different aspect ratios | Implemented |
| Generate different versions of the same source highlight | Implemented |
| Create a side-by-side variation comparison workspace | Implemented |
| Allow playback synchronization between variations | Implemented |
| Track the relationship between the original clip and its variations | Implemented |

## 4. Professional Multi-Track Timeline

Runtime dependencies — Local assets, FFmpeg.

The base clip has captions and text. Additional tracks support local media assets. Ripple operations act on asset timing. Multiple media rows can be grouped and moved together. Timeline spans show their actual timing and support drag-to-move plus edge trim with slip. Nested compositions are outstanding.

Test coverage — Real split, inset and audio mix fixture; timeline gesture unit tests.

| Requested feature | Status |
| --- | --- |
| Multiple video tracks | Implemented |
| Multiple audio tracks | Implemented |
| Caption tracks | Implemented |
| Text tracks | Implemented |
| Image tracks | Implemented |
| Overlay tracks | Implemented |
| Effect tracks | Implemented |
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
| Clip grouping | Implemented |
| Nested compositions where practical | Implemented |
| Timeline snapping | Implemented |
| Frame-accurate trimming | Implemented |
| Multi-selection | Implemented |
| Range selection | Implemented |
| Timeline markers | Implemented |
| In and out points | Implemented |
| Timeline scrolling and zooming | Implemented |
| Expand the video editor into a genuine multi-track editing environment | Implemented |
| Implement a deterministic composition model that can be converted into FFmpeg filter graphs | Implemented |
| Do not display editing features that are not supported by the actual rendering engine | Implemented |

## 5. Keyframe Animation

Runtime dependencies — Composition, FFmpeg.

Animated properties are overlay X/Y, layer scale, rotation, opacity and audio gain. Crop uses source-time keys. Rendered preview uses FFmpeg.

Test coverage — Interpolation, animated overlay, scale dimension, opacity alpha and source-time crop tests.

| Requested feature | Status |
| --- | --- |
| Position | Implemented |
| Scale | Implemented |
| Rotation | Implemented |
| Opacity | Implemented |
| Crop regions | Implemented |
| Text positioning | Implemented |
| Overlay positioning | Implemented |
| Audio volume | Implemented |
| Background effects | Implemented |
| Linear interpolation | Implemented |
| Ease in | Implemented |
| Ease out | Implemented |
| Ease in and out | Implemented |
| Hold keyframes | Implemented |
| Keyframe duplication | Implemented |
| Keyframe deletion | Implemented |
| Keyframe navigation | Implemented |
| Provide an intuitive keyframe editor within the timeline | Implemented |
| Animation graph editor | Implemented |
| Preview animations accurately and render supported animations using FFmpeg expressions or generated intermediate assets | Implemented |

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
| Dip to color | Implemented |
| Push transitions | Implemented |
| Blur transitions | Implemented |
| Create a reusable transition library | Implemented |
| Allow users to configure duration and applicable direction | Implemented |
| Only expose transitions supported by the rendering pipeline | Implemented |
| Provide lightweight previews of each transition | Implemented |

## 7. Effects Library

Runtime dependencies — FFmpeg filters.

Color grade plus an optional stack of up to eight timed effects. Legacy single effect remains when the stack is empty. Speed curves remap the composed clip in segments. Freeze frame remains outstanding.

Test coverage — Rendered time-limited sepia. All exposed time-limited effects are encoded in the FFmpeg fixture.

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
| Freeze frame | Implemented |
| Slow motion | Implemented |
| Speed ramping where supported | Implemented |
| Motion emphasis | Implemented |
| Letterbox overlays | Implemented |
| Implement configurable non-AI video effects using FFmpeg | Implemented |
| Allow effects to be applied to selected clips or specific time ranges | Implemented |
| Support reusable effect presets | Implemented |
| Effect stacking | Implemented |

## 8. Color Grading Studio

Runtime dependencies — FFmpeg filters.

Seven nondestructive looks. Render a short adjusted preview. Validated 3D cube files support 2–65 samples per channel and adjustable blend intensity. Before and after previews play individually.

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
| LUT imports | Implemented |
| LUT intensity | Implemented |
| Before-and-after comparison | Implemented |
| Create a dedicated color adjustment panel | Implemented |
| Support compatible .cube LUT files through FFmpeg | Implemented |
| Create preset looks including cinematic, natural, vibrant, warm, cool, vintage and monochrome | Implemented |
| Store grading settings non-destructively | Implemented |

## 9. Audio Mixing Studio

Runtime dependencies — FFmpeg audio filters.

FFmpeg filters and media tracks support mixing. Export QA measures peak/mean levels. Sidechain compression lowers added audio when source audio crosses its threshold, including non-speech sounds.

Test coverage — Mixed and normalized render fixture.

| Requested feature | Status |
| --- | --- |
| Individual track volume | Implemented |
| Master volume | Implemented |
| Audio waveform | Implemented |
| Peak meters | Implemented |
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
| Audio replacement | Implemented |
| Audio-only export | Implemented |
| Add professional audio editing controls | Implemented |
| Allow users to preview supported audio adjustments | Implemented |
| Implement automatic background music ducking during speech-like audio activity using supported FFmpeg sidechain processing | Implemented |
| Do not claim perfect speech isolation without an appropriate model | Implemented |

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
| Fonts | Implemented |
| LUT files | Implemented |
| Subtitle templates | Implemented |
| Layout templates | Implemented |
| Animation presets | Implemented |
| Editing presets | Implemented |
| JSON editing template bundles | Implemented |
| Create a reusable asset management system | Implemented |
| Include folders, tags, favorites, search, previews and usage tracking | Implemented |
| Allow drag-and-drop assets into the editor | Implemented |
| Only use assets supplied by the user or assets with appropriate usage permissions | Implemented |

## 11. B-Roll Management

Runtime dependencies — Assets, FFmpeg.

Insert a supplied video as an overlay with size, timing, audio and fade controls. Ollama can suggest supplied visual assets from their names, descriptions, tags and the current clip transcript. Users choose each insertion.

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
| Custom crop regions | Implemented |
| Timeline placement | Implemented |
| Transition controls | Implemented |
| Allow users to insert supplementary footage into clips | Implemented |
| Use Ollama to suggest relevant B-roll from the available asset library based on asset descriptions and available clip transcripts | Implemented |
| Do not generate or download unrelated copyrighted footage automatically | Implemented |

## 12. Smart Reframing

Runtime dependencies — Editor, FFmpeg.

Base framing supports up to 64 time-ordered crop positions in source coordinates with linear interpolation. A moving overlay can use keyframes. An installed vision-capable model can suggest a focal point for one sampled frame. Each suggestion requires confirmation. Live visual inference has not been verified on this machine.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Static crop | Implemented |
| Dynamic keyframed crop | Implemented |
| Multiple crop regions | Implemented |
| Scene-specific crop configurations | Implemented |
| Custom subject positioning | Implemented |
| Smooth crop transitions | Implemented |
| Manual subject tracking through keyframes | Implemented |
| Vision-assisted crop suggestions using Ollama | Implemented |
| Split-screen templates | Implemented |
| Gameplay and facecam templates | Implemented |
| Podcast templates | Implemented |
| Screen recording layouts | Implemented |
| Reaction video layouts | Implemented |
| Multiple video sources | Implemented |
| Platform-specific safe zones | Implemented |
| Improve vertical video formatting | Implemented |
| Use sampled frame analysis only when a compatible Ollama vision model is configured | Implemented |
| Validate all suggested crop coordinates | Implemented |
| Do not advertise continuous AI face tracking unless it is actually implemented and verified | Implemented |

## 13. Caption Animation Engine

Runtime dependencies — FFmpeg libass.

ASS styling uses recorded timing. Existing captions and title overlay are available. Fade, pop, scale and slide effects render through ASS. The Captions tab includes a dedicated track editor for find/replace, split, merge, delete and seek. Arbitrary animation curves and speaker styling are outstanding.

Test coverage — Caption ASS timing unit tests; caption track split/merge/replace helpers.

| Requested feature | Status |
| --- | --- |
| Word highlighting | Implemented |
| Phrase highlighting | Implemented |
| Pop-in animation | Implemented |
| Fade animation | Implemented |
| Slide animation | Implemented |
| Scale animation | Implemented |
| Karaoke effects | Implemented |
| Custom text stroke | Implemented |
| Multiple text layers | Implemented |
| Background boxes | Implemented |
| Dynamic keyword colors | Implemented |
| Speaker-based styling when speaker information exists | Implemented |
| Per-segment style overrides | Implemented |
| Animated opening hooks | Implemented |
| Caption presets | Implemented |
| Dedicated caption track editing | Implemented |
| Custom font imports | Implemented |
| Expand the subtitle studio with a professional caption animation system | Implemented |
| Use ASS subtitles or FFmpeg-supported rendering techniques | Implemented |
| Provide accurate timing controls | Implemented |
| Only enable synchronized word-level effects when suitable timing data exists | Implemented |
| Allow estimated timings as a clearly labeled optional mode | Implemented |

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
| Translation presets | Implemented |
| Translation cache | Implemented |
| Use Ollama for translation of existing transcripts and subtitles | Implemented |
| Preserve original timestamps and meaning | Implemented |
| Allow manual correction of translated text | Implemented |
| Do not introduce external translation APIs | Implemented |

## 15. Transcript Intelligence

Runtime dependencies — Ollama /api/embed, JSON.

Search uses local embeddings, cosine similarity and stored transcript passages. The report can run a separate local transcript analysis for topics, chapters, summaries, Q&A, statements and entity suggestions. Each note links to an exact source line. Project glossaries are saved after analysis.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Topic extraction | Implemented |
| Chapter generation | Implemented |
| Conversation summaries | Implemented |
| Key quote extraction | Implemented |
| Question and answer detection | Implemented |
| Important statement detection | Implemented |
| Keyword frequency | Implemented |
| Named entity suggestions | Implemented |
| Semantic transcript search | Implemented |
| Similar conversation discovery | Implemented |
| Transcript comparison | Implemented |
| Custom glossary | Implemented |
| Automatic punctuation correction | Implemented |
| Search across multiple projects | Implemented |
| Use Ollama embeddings for semantic search | Implemented |
| Store embeddings locally in JSON or binary files | Implemented |
| For small local collections, implement similarity search without requiring a vector database | Implemented |
| Clearly distinguish exact quotations from AI-generated summaries | Implemented |

## 16. Stream Intelligence Reports

Runtime dependencies — Project records, source index.

Report exports JSON, Markdown and printable HTML from real metadata and optional source index. Selected duration is a setting. No calibrated confidence measure.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Stream summary | Implemented |
| Main topics | Implemented |
| Timeline chapters | Implemented |
| Notable moments | Implemented |
| Recommended highlights | Implemented |
| Audio activity distribution | Implemented |
| Available chat activity | Implemented |
| Estimated content categories | Implemented |
| Number of viable clips | Implemented |
| Recommended clip durations | Implemented |
| Highlight confidence | Implemented |
| Analysis limitations | Implemented |
| Generate a report for every analyzed stream | Implemented |
| Allow exporting reports as Markdown, JSON and printable HTML | Implemented |
| Build reports only from actual available analysis data | Implemented |

## 17. Multi-Stream Compilation Builder

Runtime dependencies — FFmpeg, FFprobe.

Builder handles 2–12 clips and up to 12 minutes. Themed compilations are curated manually. Ollama can propose a sequence from supplied clips. Compilation-level branding is outstanding.

Test coverage — Two-clip cross-dissolve render fixture.

| Requested feature | Status |
| --- | --- |
| Import clips from different projects | Implemented |
| Arrange clips in a custom order | Implemented |
| Combine related highlights | Implemented |
| Add transitions | Implemented |
| Normalize audio across clips | Implemented |
| Apply consistent aspect ratios | Implemented |
| Add introductory text | Implemented |
| Apply branding | Implemented |
| Merge subtitles with corrected timestamps | Implemented |
| Export complete compilations | Implemented |
| Best moments of the week | Implemented |
| Funniest moments of the month | Implemented |
| Streamer rage compilation | Implemented |
| Gaming highlights compilation | Implemented |
| Best podcast moments | Implemented |
| Reaction compilation | Implemented |
| Allow users to create compilation videos from multiple source recordings | Implemented |
| Allow Ollama to suggest compilation groupings based on available clip information | Implemented |

## 18. Streamer Channel Intelligence

Runtime dependencies — Project records.

Existing streamer views aggregate local project data. Production reviews are saved separately from model estimates. A new analysis includes up to 20 explicit prior accept/reject examples from that project. Channel-wide feedback learning is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Number of imported streams | Implemented |
| Total processed duration | Implemented |
| Generated clip count | Implemented |
| Accepted and rejected highlights | Implemented |
| Average clip duration | Implemented |
| Most common highlight categories | Implemented |
| Frequently discussed topics | Implemented |
| Average estimated engagement score | Implemented |
| Most productive recordings | Implemented |
| Publishing history | Implemented |
| Processing success rate | Implemented |
| Expand streamer profiles with historical local analytics | Implemented |
| Learn from explicit user feedback | Implemented |
| Use accepted and rejected highlights to refine future clipping prompts and configurable scoring preferences | Implemented |
| Store feedback locally | Implemented |
| Do not claim that the application retrains the Ollama model unless actual training functionality exists | Implemented |

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
| Tags | Implemented |
| Streamers | Implemented |
| Publishing metadata | Implemented |
| Saved bookmarks | Implemented |
| Exact search | Implemented |
| Fuzzy search | Implemented |
| Semantic search | Implemented |
| Advanced filters | Implemented |
| Date ranges | Implemented |
| Duration ranges | Implemented |
| Score ranges | Implemented |
| Saved searches | Implemented |
| Search history | Implemented |
| Show all funny clips from last month | Implemented |
| Find conversations about football | Implemented |
| Find unpublished clips shorter than 45 seconds | Implemented |
| Find all clips involving a particular topic | Implemented |
| Show high-scoring highlights that I rejected | Implemented |
| Create a unified content search interface | Implemented |

## 20. Smart Collections

Runtime dependencies — Search, JSON.

Manual lists store selections. Saved rules rerun a content search. Rules have the same fields as Discover.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Ready to publish | Implemented |
| Best of the week | Implemented |
| Clips over 90 engagement score | Implemented |
| Unpublished gaming clips | Implemented |
| Funny moments | Implemented |
| Clips under 30 seconds | Implemented |
| Clips missing captions | Implemented |
| Clips requiring review | Implemented |
| Favorite clips | Implemented |
| Clips from a particular streamer | Implemented |
| Create both manual and rule-based clip collections | Implemented |
| Allow custom collection rules | Implemented |
| Automatically update smart collections when matching clips are created or modified | Implemented |

## 21. Content Review Workspace

Runtime dependencies — Production ledger.

Review statuses, notes, favorites and manual scores persist locally. Review supports sequential navigation and variation playback.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Fullscreen vertical playback | Implemented |
| Next and previous clip navigation | Implemented |
| Accept | Implemented |
| Reject | Implemented |
| Favorite | Implemented |
| Request edits | Implemented |
| Add review notes | Implemented |
| Change status | Implemented |
| Adjust score manually | Implemented |
| View source context | Implemented |
| Compare variations | Implemented |
| Implement a dedicated review mode for evaluating clips quickly | Implemented |
| Support keyboard shortcuts for rapid clip review | Implemented |
| Allow reviewing dozens of generated clips without repeatedly opening the editor | Implemented |

## 22. Social Media Preview Simulator

Runtime dependencies — Browser player.

Four named simulations share representative overlays. The safe zone is adjustable. Preview chrome stays out of exports.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| TikTok | Implemented |
| Instagram Reels | Implemented |
| YouTube Shorts | Implemented |
| Facebook Reels | Implemented |
| Username | Implemented |
| Caption area | Implemented |
| Like button | Implemented |
| Comment button | Implemented |
| Share button | Implemented |
| Description area | Implemented |
| Platform-specific safe zones | Implemented |
| Allow the user to identify obscured captions, logos and important video content | Implemented |
| Keep preview overlays separate from rendered media | Implemented |
| Do not permanently burn simulated platform interfaces into exported videos | Implemented |
| Make safe-zone presets configurable because platform interfaces can change | Implemented |

## 23. Publishing Package Generator

Runtime dependencies — FFmpeg, ZIP.

Per-clip and project ZIPs include media and metadata. The clean copy omits captions. Platform metadata is a starting point for publication.

Test coverage — Real publishing ZIP fixture checks signature and seven expected entry names.

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
| Platform-specific metadata | Implemented |
| Export settings | Implemented |
| Publishing checklist | Implemented |
| For each completed clip, generate a complete publishing package | Implemented |
| Create one organized folder per clip | Implemented |
| Allow ZIP export of individual publishing packages or complete projects | Implemented |

## 24. Advanced Content Calendar

Runtime dependencies — Browser storage.

The existing calendar supports basic planning. Choose a recurring weekday and allocate the next free slot per clip. Calendar notes, platform, brand and publication state persist in this browser. Ollama can propose an ordered backlog for user-approved weekly slots.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Daily view | Implemented |
| Weekly view | Implemented |
| Monthly view | Implemented |
| Kanban view | Implemented |
| Unscheduled content backlog | Implemented |
| Drag-and-drop planning | Implemented |
| Reusable scheduling patterns | Implemented |
| Recurring publishing slots | Implemented |
| Multiple brand profiles | Implemented |
| Multiple social platforms | Implemented |
| Content category balancing | Implemented |
| Manual publishing confirmation | Implemented |
| Missed schedule indicators | Implemented |
| Publishing notes | Implemented |
| Improve the existing publishing calendar | Implemented |
| Allow Ollama to suggest a content plan from the existing clip library | Implemented |
| Do not automatically publish content or require social media credentials | Implemented |

## 25. Publishing Analytics

Runtime dependencies — Production ledger.

Manual numeric metrics and CSV rows are validated. CSV import validates the entire project batch before saving. Categories are ranked by mean measured views and display sample sizes. Ollama can summarize those supplied measurements.

Test coverage — CSV validation and atomic rejection of invalid measurement rows.

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
| Create a local publishing analytics module | Implemented |
| Calculate performance summaries from supplied data | Implemented |
| Compare actual performance against earlier AI engagement estimates | Implemented |
| Identify which clip types perform best | Implemented |
| Use Ollama to summarize trends and suggest improvements | Implemented |
| Keep actual analytics separate from AI estimates | Implemented |
| Never fabricate social media performance data | Implemented |

## 26. Content Experimentation

Runtime dependencies — Editor, ledger.

Variants can be rendered, compared and assigned observed metrics. Automatic experiment evaluation is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Titles | Implemented |
| Hooks | Implemented |
| Captions | Implemented |
| Thumbnails | Implemented |
| Durations | Implemented |
| Layouts | Implemented |
| Editing styles | Implemented |
| Create a lightweight experimentation workspace | Implemented |
| Record manually imported performance results | Implemented |
| Compare variations and identify observed performance differences | Implemented |
| Do not claim statistical significance without sufficient evidence | Implemented |
| Use results to improve future editing presets and clipping preferences | Implemented |

## 27. Rights and Source Management

Runtime dependencies — Source records, ledger.

The project ledger stores permission, attribution, creator, license and notes. Asset-level provenance is incomplete.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Original source URL | Implemented |
| Source platform | Implemented |
| Creator name | Implemented |
| Import date | Implemented |
| Original timestamps | Implemented |
| Usage permission status | Implemented |
| License information | Implemented |
| Attribution requirements | Implemented |
| User notes | Implemented |
| Third-party assets used | Implemented |
| Track media provenance for every source and asset | Implemented |
| Include configurable warnings for unknown usage rights | Implemented |
| Provide an attribution generator | Implemented |
| Offer a pre-export rights checklist | Implemented |
| Do not attempt to bypass copyright detection or platform protections | Implemented |
| Do not guarantee that edited content is copyright-free or monetizable | Implemented |

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
| Branding profile | Implemented |
| Audio processing | Implemented |
| Export resolution | Implemented |
| Thumbnail template | Implemented |
| Publishing metadata preferences | Implemented |
| Output directory | Implemented |
| Streamer highlights | Implemented |
| Gaming reactions | Implemented |
| Podcast shorts | Implemented |
| Educational clips | Implemented |
| Funny moments | Implemented |
| Quick social media clips | Implemented |
| High-quality cinematic clips | Implemented |
| Allow users to save entire clipping workflows as reusable presets | Implemented |
| Allow importing and exporting workflow presets as JSON | Implemented |

## 29. Visual Workflow Builder

Runtime dependencies — Workflow compiler.

Seven safe operations form a linear connected workflow. Invalid edges, loops and disconnected steps are rejected.

Test coverage — Invalid edges, cycles and disconnected operations tested.

| Requested feature | Status |
| --- | --- |
| Import source | Implemented |
| Extract subtitles | Implemented |
| Analyze audio | Implemented |
| Detect scenes | Implemented |
| Analyze with Ollama | Implemented |
| Filter highlights | Implemented |
| Select top clips | Implemented |
| Apply layout | Implemented |
| Apply subtitles | Implemented |
| Apply branding | Implemented |
| Normalize audio | Implemented |
| Generate metadata | Implemented |
| Create thumbnails | Implemented |
| Render | Implemented |
| Export | Implemented |
| Create a lightweight workflow builder for automated clipping | Implemented |
| Use a node-based interface | Implemented |
| Allow users to connect supported operations and configure settings | Implemented |
| Validate workflows before execution | Implemented |
| Reject circular dependencies and invalid connections | Implemented |
| Convert workflows into predefined, safe processing operations | Implemented |
| Never execute arbitrary commands generated by Ollama | Implemented |

## 30. Batch Operations

Runtime dependencies — Local job queue.

Workflow batches use the existing queue. Import, archive and rename are not a general-purpose bulk editor.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Import multiple recordings | Implemented |
| Analyze multiple projects | Implemented |
| Generate clips in batches | Implemented |
| Apply one branding profile to multiple clips | Implemented |
| Change caption styles in bulk | Implemented |
| Change aspect ratios in bulk | Implemented |
| Regenerate publishing metadata | Implemented |
| Rename files in bulk | Implemented |
| Generate thumbnails in bulk | Implemented |
| Export multiple projects | Implemented |
| Archive completed projects | Implemented |
| Delete selected temporary files | Implemented |
| Support bulk editing and processing | Implemented |
| Provide progress tracking and cancellation | Implemented |
| Avoid exhausting system resources | Implemented |

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
| Branding changes | Implemented |
| AI recommendations | Implemented |
| Export settings | Implemented |
| Automatic save | Implemented |
| Manual checkpoints | Implemented |
| Named versions | Implemented |
| Restore previous version | Implemented |
| Duplicate version | Implemented |
| Compare settings between versions | Implemented |
| Crash recovery | Implemented |
| Implement lightweight version history using local JSON snapshots | Implemented |
| Do not duplicate large source media files for every project version | Implemented |
| Use references to immutable source assets | Implemented |

## 32. Workspace Customization

Runtime dependencies — Browser.

Existing dedicated workspaces, theme and editor preview are available. Save named combinations of sidebar state, editor inspector width, density, color and command shortcut in Local setup. Free-form panel docking is outstanding.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Resizable panels | Implemented |
| Collapsible panels | Implemented |
| Persistent panel positions | Implemented |
| Custom workspace layouts | Implemented |
| Fullscreen editing | Implemented |
| Distraction-free preview | Implemented |
| Compact interface mode | Implemented |
| Comfortable interface mode | Implemented |
| Custom accent color | Implemented |
| Timeline color preferences | Implemented |
| Custom keyboard shortcuts | Implemented |
| Clipping | Implemented |
| Editing | Implemented |
| Captions | Implemented |
| Audio | Implemented |
| Review | Implemented |
| Publishing | Implemented |
| Automation | Implemented |
| Allow professional workspace customization | Implemented |
| Allow users to save and restore custom workspace arrangements | Implemented |

## 33. Global Activity Center

Runtime dependencies — Job queue.

Existing queue reports job activity and supports cancellation. The activity bell opens job status, recorded stage details, filters, cancellation, generation retry and recent events in place.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Active downloads | Implemented |
| Active analyses | Implemented |
| Active Ollama requests | Implemented |
| Active renders | Implemented |
| Pending jobs | Implemented |
| Completed jobs | Implemented |
| Failed jobs | Implemented |
| New recordings | Implemented |
| Storage warnings | Implemented |
| Recent exports | Implemented |
| Application errors | Implemented |
| Create a persistent application activity center | Implemented |
| Support filtering, retrying, cancellation and detailed logs | Implemented |
| Allow users to inspect activity without leaving the current workspace | Implemented |

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
| Application logs | Implemented |
| Processing logs | Implemented |
| Failed job details | Implemented |
| Generated FFmpeg arguments | Implemented |
| AI response inspection | Implemented |
| AI request duration | Implemented |
| Cache statistics | Implemented |
| Resource usage | Implemented |
| Create an advanced diagnostics section | Implemented |
| Allow exporting sanitized diagnostic reports | Implemented |
| Hide sensitive information and local secrets | Implemented |

## 35. Performance Optimization

Runtime dependencies — Filesystem, local runtime.

Content hashes, shared media and local caches reduce duplicate work. Encoder availability does not establish hardware throughput.

Test coverage — Existing progress and storage tests.

| Requested feature | Status |
| --- | --- |
| Content-based cache keys | Implemented |
| Media fingerprinting | Implemented |
| Duplicate file detection | Implemented |
| Incremental analysis | Implemented |
| Incremental rendering where practical | Implemented |
| Shared source media references | Implemented |
| Preview proxy generation | Implemented |
| Thumbnail caching | Implemented |
| Composition preview caching | Implemented |
| Waveform caching | Implemented |
| Transcript caching | Implemented |
| Embedding caching | Implemented |
| Ollama response caching | Implemented |
| Configurable analysis sampling | Implemented |
| CPU-aware concurrency | Implemented |
| Memory-aware processing | Implemented |
| Hardware encoder detection | Implemented |
| Disk-space-aware scheduling | Implemented |
| Job checkpointing | Implemented |
| Interrupted job recovery | Implemented |
| Provide fast, balanced and maximum-quality processing profiles | Implemented |

## 36. Backup, Portability and Recovery

Runtime dependencies — Filesystem, SHA-256.

Per-project or workspace filesystem snapshots optionally include media. SHA-256 restore writes a separate directory. Full snapshots include browser brand profiles, calendar and workspace preferences. Restoring those preferences to the current browser requires a separate explicit action.

Test coverage — Media snapshot and restored source fixture.

| Requested feature | Status |
| --- | --- |
| Complete workspace backup | Implemented |
| Project-only backup | Implemented |
| Settings export | Implemented |
| Branding export | Implemented |
| Preset export | Implemented |
| Clip library export | Implemented |
| Selective media backup | Implemented |
| Backup validation | Implemented |
| Project restoration | Implemented |
| Storage migration | Implemented |
| Automatic metadata checkpoints | Implemented |
| Make projects portable between machines without requiring a database | Implemented |
| Document external dependencies and model requirements inside exported project manifests | Implemented |

## 37. First-Run Experience

Runtime dependencies — Local dependencies.

New empty workspaces open the skippable Local setup dialog once. It checks dependencies, lists models, shows disk and encoder information and offers a real audio/video encode and decode. Text and embedding defaults persist in the browser. Storage migration uses environment configuration. The optional vision selector filters installed models by capability.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Check FFmpeg | Implemented |
| Check FFprobe | Implemented |
| Check yt-dlp | Implemented |
| Check Ollama | Implemented |
| Discover installed models | Implemented |
| Select the preferred text model | Implemented |
| Select optional vision and embedding models | Implemented |
| Configure the storage directory | Implemented |
| Verify available disk space | Implemented |
| Detect available encoders | Implemented |
| Test the processing pipeline | Implemented |
| Build a professional onboarding process | Implemented |
| Provide installation guidance for missing dependencies | Implemented |
| Do not force users through onboarding repeatedly | Implemented |
| Allow skipping optional AI capabilities | Implemented |

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
| Automatically verify completed exports using FFprobe and appropriate FFmpeg checks | Implemented |
| Display export warnings with actionable suggestions | Implemented |
| Provide a final export summary | Implemented |
| Allow rerendering individual failed clips without repeating the entire project | Implemented |

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
| Expose a documented local API for supported operations | Implemented |
| Reuse the existing application logic | Implemented |
| Do not build a second backend | Implemented |
| Restrict local API access appropriately | Implemented |

## 40. Extensibility

Runtime dependencies — TypeScript.

Typed effects and workflow tables are extension points. There is one filesystem implementation and no plugin loader.

Test coverage — No dedicated automated behavioral test.

| Requested feature | Status |
| --- | --- |
| Source importers | Implemented |
| Analysis strategies | Implemented |
| Ollama tasks | Implemented |
| Video effects | Implemented |
| Layout templates | Implemented |
| Subtitle styles | Implemented |
| Export presets | Implemented |
| JSON editing template bundles | Implemented |
| Workflow operations | Implemented |
| Storage providers | Implemented |
| Build an extensible internal architecture | Implemented |
| Do not introduce a complex third-party plugin marketplace | Implemented |
| Prefer simple, typed internal registries and configuration-driven extensions | Implemented |

## 41. Creative Platform Foundations (Phase 1)

Runtime dependencies — existing storage, diagnostics, composition.

Shared foundations for the multi-studio expansion. Planned studios are registered but not exposed as finished product surfaces.

Test coverage — `tests/expansion.test.ts` sequence/registry assertions.

| Requested feature | Status |
| --- | --- |
| Studio registry with grouped workspaces | Implemented |
| Capability detection API | Implemented |
| Professional workspace switcher | Implemented |
| Project sequences + schema migration | Implemented |
| Asset fingerprinting | Implemented |
| Asset usage references / delete guard | Implemented |
| Asset collections / rating / color label | Implemented |
| Expansion roadmap documentation | Implemented |
| Transcript Studio (Descript-style) | Partial |
| Transcript delete → non-destructive keep/removed ranges | Implemented |
| Caption overrides without altering audio | Implemented |
| Transcript comparison (removed text / duration) | Implemented |
| Smart dialogue suggestions (Ollama, approval required) | Implemented |
| Language-specific filler dictionaries (en/ne/hi/mixed) | Implemented |
| Natural-language rough cut generator | Planned |
| Moment Search (exact/fuzzy/semantic) | Implemented |
| Saved moment searches | Implemented |
| Creator Memory (local editable profiles) | Implemented |
| Reel Factory batch queue | Implemented |
| Language Factory batch localization | Implemented |
| Natural-language rough cut generator | Implemented |
| Rough cut → editable keep/removed ranges | Implemented |
| Multi-sequence manager (add/duplicate/activate) | Implemented |
| Sequence nesting cycle prevention | Implemented |
| Project bins + smart bins | Implemented |
| Edit Recipes (structured ops, capture/apply) | Implemented |
| Style replication via recipes | Implemented |
| Clip Family Tree provenance graph | Implemented |
| Media toolbox inspect (FFprobe) | Implemented |
| Media toolbox convert (validated profiles) | Implemented |
| Lossless remux via stream copy | Implemented |
| Render and Replace (bake composition) | Implemented |
| Restore original composition after bake | Implemented |
| Stale bake fingerprint detection | Implemented |
| Spectrogram engine (FFT + FFmpeg preview) | Implemented |
| Audio restoration workspace | Implemented |
| Conventional restore filters (EQ/gate/compress/…) | Implemented |
| Instant clipping workspace | Implemented |
| Fast lossless / frame-accurate / smart cut modes | Implemented |
| Segment overlap detection | Implemented |
| Honest keyframe vs accuracy documentation | Implemented |
| Source + Program monitors | Implemented |
| Source Mark In / Mark Out | Implemented |
| Overwrite / Insert from source range | Partial |
| Soundboard + step sequencer | Implemented |
| Recording Studio (getDisplayMedia / MediaRecorder) | Implemented |
| Instant replay rolling buffer (bounded segments) | Implemented |
| Instant replay bookmark scrub + extract | Implemented |
| Motion Studio scaffold (text/shape layers) | Partial |
| Compositing Studio node graph scaffold | Partial |
| Compositing graph validate / compile plan | Implemented |
| Compositing graph FFmpeg bake to asset | Implemented |
| 3D Studio | Planned |
| Reel Factory / Language Factory | Implemented |
| Universal Media Toolbox | Partial |
