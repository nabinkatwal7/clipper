export type Feature = {
  id: string;
  group: "Workspace" | "Creation" | "Automation" | "Management";
  title: string;
  tag: string;
  text: string;
  points: string[];
  /** Illustrative rows shown in the preview card. Sample text only. */
  sample: [string, string][];
};

export const features: Feature[] = [
  {
    id: "overview", group: "Workspace", title: "Overview", tag: "Your studio at a glance",
    text: "Pick up where you left off. The overview shows recent projects, rendered clips and anything still processing, with live progress for running jobs.",
    points: ["Recent projects and clips", "Live job progress", "Jump to any tool with Ctrl/Cmd + K"],
    sample: [["Project", "Friday stream — 3h 12m"], ["Status", "Analyzing transcript"], ["Clips ready", "4 rendered"]],
  },
  {
    id: "import", group: "Workspace", title: "New project", tag: "Bring footage in",
    text: "Upload a recording or paste a link to a finished stream. The source is inspected first, so you see duration and available formats before anything is downloaded.",
    points: ["Upload up to 5 GiB by default", "URL import with format inspection", "Public completed recordings only; no DRM bypass"],
    sample: [["Source", "stream-recording.mp4"], ["Duration", "3:12:08"], ["Output", "720p vertical"]],
  },
  {
    id: "projects", group: "Workspace", title: "Projects", tag: "Every recording, organized",
    text: "Each source keeps its transcript, highlights, clips and settings together. Retry interrupted jobs, cancel running ones, or delete a project and everything attached to it.",
    points: ["Resume interrupted processing", "Cancel and retry jobs", "One-click removal of a project's files"],
    sample: [["Friday stream", "4 clips"], ["Interview", "2 clips"], ["Tournament day 2", "Processing"]],
  },
  {
    id: "library", group: "Workspace", title: "Clip library", tag: "Everything you rendered",
    text: "Browse, preview, favourite and download every clip across projects. Download a single MP4 or a ZIP, with seeking support for large files.",
    points: ["Favourites and collections", "MP4 and ZIP downloads", "Posters generated for quick scanning"],
    sample: [["Unexpected reaction", "0:37 · 9:16"], ["Story about the setup", "0:34 · 9:16"], ["Chat debate", "0:37 · 9:16"]],
  },
  {
    id: "assets", group: "Workspace", title: "Assets", tag: "Reusable media",
    text: "Keep logos, overlays, music and B-roll in one library and drop them into any project. Assets are validated on upload and stored in your workspace.",
    points: ["Images, audio and video assets", "Used by layers, branding and thumbnails", "Upload limits enforced"],
    sample: [["logo-mark.png", "Overlay"], ["intro-sting.wav", "Audio"], ["gameplay-loop.mp4", "B-roll"]],
  },
  {
    id: "discover", group: "Workspace", title: "Discover", tag: "Search across everything",
    text: "Search transcripts and clips across your projects by keyword, fuzzy match or meaning, and save searches as rules. Results only include what your account owns.",
    points: ["Exact, fuzzy and semantic modes", "Filter by clip, transcript or project", "Saved rules rerun the same search"],
    sample: [["Query", "funny misplay"], ["Mode", "semantic"], ["Matches", "Clips and transcript lines"]],
  },
  {
    id: "editor", group: "Creation", title: "Video editor", tag: "A real timeline",
    text: "Trim, reframe to 9:16, layer titles, images and B-roll, mix audio, grade colour and add effects on a multi-track timeline with checkpoints and history.",
    points: ["Multi-track timeline with keyframes", "Layers, layouts and reframing", "Audio mixing and colour grading", "History, undo and templates"],
    sample: [["Video", "Facecam + gameplay layout"], ["Captions", "3 tracks"], ["Audio", "Music ducked under voice"]],
  },
  {
    id: "director", group: "Creation", title: "AI Director", tag: "Suggestions you can check",
    text: "Ask a local Ollama model for highlight candidates, hooks and B-roll ideas. Every suggestion cites real timestamps and gives its reason; nothing is applied until you accept it.",
    points: ["Highlights with the reason shown", "Context recovery around a moment", "Works with the Ollama models you install"],
    sample: [["Highlight", "12:04 – 12:41"], ["Reason", "Reaction after a surprising result"], ["Action", "Accept / adjust / skip"]],
  },
  {
    id: "compilations", group: "Creation", title: "Compilations", tag: "Many clips, one video",
    text: "Join between 2 and 12 clips from different recordings with transitions such as cross-dissolve. Ask Ollama to propose a sequence, then reorder it yourself.",
    points: ["Up to 12 clips and 12 minutes", "Cross-dissolve and dip transitions", "Manual or suggested ordering"],
    sample: [["1", "Opening reaction"], ["2", "Best play"], ["3", "Closing joke"]],
  },
  {
    id: "transcripts", group: "Creation", title: "Transcript explorer", tag: "Search what was said",
    text: "Read the full timestamped transcript, correct text, search dialogue and translate lines. Selecting a highlight shows its reasoning and trim range.",
    points: ["Edit timestamped segments", "Translate with an installed model", "Index audio and scene changes"],
    sample: [["00:12:04", "I can't believe that worked."], ["00:12:09", "Chat, did you see that?"], ["00:12:15", "Okay, replay it."]],
  },
  {
    id: "subtitles", group: "Creation", title: "Subtitle studio", tag: "Captions in any script",
    text: "Import SRT, VTT or timed transcripts in any Unicode script, style the captions and burn them in. Translated and bilingual tracks are kept separate from the original.",
    points: ["Source, translated and bilingual captions", "Fonts, colours, position and size", "Right-to-left and complex scripts"],
    sample: [["Original", "यो क्षण सम्झनलायक छ।"], ["English", "This moment is worth remembering."], ["Style", "Bold · bottom · yellow keyword"]],
  },
  {
    id: "thumbnails", group: "Creation", title: "Thumbnail studio", tag: "Pick the frame",
    text: "Choose a source frame, add text and image layers, and export a 1280 × 720 PNG. A frame suggestion tool helps you find a strong still.",
    points: ["1280 × 720 PNG export", "Text and image layers", "Frame suggestions from the clip"],
    sample: [["Frame", "12:06.4"], ["Text", "NO WAY"], ["Export", "thumbnail.png"]],
  },
  {
    id: "streamers", group: "Automation", title: "Streamers", tag: "Watch the channels you follow",
    text: "Add a public recordings feed for a channel. The first check records a baseline; later checks queue newly published recordings for analysis.",
    points: ["Public recording feeds", "Baseline on first check", "Checks run while the studio is open"],
    sample: [["Channel", "Example channel"], ["Last check", "Baseline recorded"], ["New", "1 recording queued"]],
  },
  {
    id: "queue", group: "Automation", title: "Processing queue", tag: "One job at a time, visible",
    text: "Jobs run through a local queue with real progress, cancellation and retry. Per-user limits keep one account from starving the machine.",
    points: ["Accurate progress, not fake spinners", "Cancel and retry", "Resumable transcription checkpoints"],
    sample: [["Transcribing", "Window 14 / 96"], ["Queued", "2 projects"], ["Failed", "Retry available"]],
  },
  {
    id: "auto", group: "Automation", title: "Automatic clipping", tag: "Hands-off first pass",
    text: "Turn on automatic clipping for a feed and new recordings are analyzed and cut using your saved settings. You review the results before anything leaves your machine.",
    points: ["Uses your clip settings", "Review before export", "Never publishes on its own"],
    sample: [["Trigger", "New recording found"], ["Plan", "Up to 3 highlights"], ["Result", "Ready for review"]],
  },
  {
    id: "workflows", group: "Automation", title: "Workflow builder", tag: "Presets for repeat work",
    text: "Save a combination of clip length, format, caption style and branding as a workflow and apply it to batches of projects.",
    points: ["Reusable presets", "Batch processing", "Language-aware settings"],
    sample: [["Preset", "Vertical shorts"], ["Length", "30–45 s"], ["Captions", "Bold, bottom"]],
  },
  {
    id: "desk", group: "Management", title: "Production desk", tag: "Review before you publish",
    text: "Mark clips accepted or rejected, add notes and compare model estimates with your own decisions. Prior decisions are fed back as explicit examples to later analyses.",
    points: ["Accept / reject review", "Notes per clip", "Publishing packages with copy and metadata"],
    sample: [["Clip", "Unexpected reaction"], ["Review", "Accepted"], ["Package", "MP4 + caption + hashtags"]],
  },
  {
    id: "calendar", group: "Management", title: "Content calendar", tag: "Plan what goes out",
    text: "Plan posts by date and platform, allocate the next free slot per clip and keep notes. It is planning metadata only; publishing is always a manual step.",
    points: ["Recurring weekday slots", "Platform and brand labels", "No automatic publishing"],
    sample: [["Mon", "Reaction clip"], ["Wed", "Story clip"], ["Fri", "Compilation"]],
  },
  {
    id: "branding", group: "Management", title: "Branding", tag: "Your look, applied consistently",
    text: "Save brand profiles with logo, colours and caption styling and apply them across clips so every export matches.",
    points: ["Multiple brand profiles", "Logo and colour presets", "Caption style defaults"],
    sample: [["Profile", "Main channel"], ["Accent", "#7951D9"], ["Logo", "Top right"]],
  },
  {
    id: "storage", group: "Management", title: "Storage and backups", tag: "Know where your disk went",
    text: "See what each part of your workspace uses, free space on the drive, and create verified backups you can restore into a separate folder.",
    points: ["Usage by category", "Checksummed backups", "Restore without overwriting"],
    sample: [["Sources", "42.1 GB"], ["Clips", "3.8 GB"], ["Backups", "1 verified"]],
  },
  {
    id: "quick-clip", group: "Workspace", title: "Quick Clip", tag: "Link in, clips out",
    text: "Paste a link or point to a recording, choose a content type, clip count and length, and get vertical clips to review. It works without AI and needs no accounts or API keys. Online links need internet access; local files do not.",
    points: ["Instant mode needs no AI at all", "Optional local Ollama ranking", "Platform presets for vertical formats", "Retry resumes from the step that failed"],
    sample: [["Source", "Local file"], ["Type", "Gaming · 5 clips · 30–60 s"], ["Mode", "Instant — no AI"]],
  },
  {
    id: "moments", group: "Creation", title: "Moment finder", tag: "Scores you can inspect",
    text: "Finds candidate moments from measured audio changes, scene and motion changes, subtitles, imported chat logs and replay heatmaps, compared with the recording's own baseline. Every candidate shows where its score came from. Scores rank moments for you to review; they do not predict audience performance.",
    points: ["Interactive heatmap of the real measured tracks", "Missing signals are listed, never invented", "Boundaries snap to subtitles, silence and scene cuts when available", "Hype-word dictionaries for English, Nepali, Hindi, Urdu, Bengali, Spanish and romanized forms"],
    sample: [["Used", "audio, chat, visual"], ["Not available", "replay, transcript"], ["Edges", "duration-only (reduced precision)"]],
  },
  {
    id: "autopilot", group: "Automation", title: "Autopilot", tag: "Scheduled, reviewable, never published",
    text: "Define a workflow that imports a new upload from a tracked creator or a new file in a folder, finds moments, optionally asks you to approve, renders and checks the result. Every run keeps a step-by-step history and can resume after a failure. Automatic checks run only while the studio is running.",
    points: ["Triggers: manual, new upload, new file in a folder", "Approval step before rendering", "Language-based profile routing", "Nothing is ever posted to a platform"],
    sample: [["Trigger", "New file in folder"], ["Step", "Waiting for approval"], ["History", "Per-step results kept"]],
  },
  {
    id: "campaigns", group: "Management", title: "Campaigns", tag: "Rules you can verify",
    text: "Save reusable production rules such as duration, aspect ratio, required captions, watermark, attribution and excluded words. Compliance checks separate what the software can measure from what needs a human, and never mark rights as verified on your behalf.",
    points: ["Structured, validated rules", "Pass, fail or needs review per check", "Import rules from pasted instructions with local Ollama, reviewed before saving", "Compliance report included in publishing packages"],
    sample: [["Duration", "pass · 45 s"], ["Captions language", "needs review"], ["Rights", "needs review"]],
  },
  {
    id: "trends", group: "Management", title: "Trend radar", tag: "Only what you track",
    text: "Track public creator feeds and imported lists, and record views, age and upload frequency over time. Figures come from the feeds and files you add and show when they were observed. They are not platform-wide rankings, and sources without a keyless feed need a manual import.",
    points: ["RSS and Atom feeds, CSV and JSON import", "Velocity needs two real observations", "Stale and missing data are labelled", "Topic summaries cite the titles behind them"],
    sample: [["Views", "1,500"], ["Observed", "2 readings"], ["Source", "Public feed"]],
  },
  {
    id: "health", group: "Management", title: "System health", tag: "Measured, not guessed",
    text: "See CPU, memory, disk, the model Ollama has loaded, the job queue and dependency versions. Encoders are only called verified after a real test encode succeeds on your machine. Eco, Balanced and Performance profiles tune analysis detail, and Performance is never chosen automatically.",
    points: ["Live measured metrics", "Real encoder test", "One heavy job at a time in every profile", "Storage cleanup previews before anything is deleted"],
    sample: [["Memory", "24 GB free"], ["Encoders", "libx264 verified"], ["Profile", "Balanced"]],
  },
];

export const groups = ["Workspace", "Creation", "Automation", "Management"] as const;
