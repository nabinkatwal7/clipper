/** Canonical studio registry — navigation groups for the creative OS. */

export type StudioId =
  | "home"
  | "clipping"
  | "editing"
  | "audio"
  | "design"
  | "language"
  | "recording"
  | "media"
  | "automation"
  | "production"
  | "intelligence"
  | "management";

export type StudioRoute = {
  id: string;
  label: string;
  /** Existing workspace page name when already implemented */
  page?: string;
  status: "live" | "partial" | "planned";
};

export type StudioGroup = {
  id: StudioId;
  label: string;
  description: string;
  routes: StudioRoute[];
};

export const studioGroups: StudioGroup[] = [
  {
    id: "home",
    label: "Home",
    description: "Dashboard, recent work and quick actions",
    routes: [
      { id: "overview", label: "Overview", page: "Overview", status: "live" },
      {
        id: "new-project",
        label: "New project",
        page: "New project",
        status: "live",
      },
      { id: "projects", label: "Projects", page: "Projects", status: "live" },
    ],
  },
  {
    id: "clipping",
    label: "Clipping",
    description: "Sources, highlights and high-volume clip production",
    routes: [
      {
        id: "clip-library",
        label: "Clip library",
        page: "Clip library",
        status: "live",
      },
      { id: "discover", label: "Discover", page: "Discover", status: "live" },
      {
        id: "live-clipping",
        label: "Live clipping",
        page: "Live clipping",
        status: "live",
      },
      {
        id: "automatic",
        label: "Automatic clipping",
        page: "Automatic clipping",
        status: "live",
      },
      {
        id: "instant",
        label: "Instant clipping",
        page: "Instant clipping",
        status: "live",
      },
      {
        id: "reel-factory",
        label: "Reel Factory",
        page: "Reel Factory",
        status: "live",
      },
      { id: "moment-finder", label: "Moment finder", page: "Moment finder", status: "live" },
      {
        id: "trend-radar",
        label: "Trend radar",
        page: "Trend radar",
        status: "live",
      },
      {
        id: "campaigns",
        label: "Campaigns",
        page: "Campaigns",
        status: "live",
      },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    description: "Video, transcript, motion and compositing studios",
    routes: [
      {
        id: "video-editor",
        label: "Video Studio",
        page: "Video editor",
        status: "live",
      },
      {
        id: "transcript",
        label: "Transcript Studio",
        page: "Transcript explorer",
        status: "partial",
      },
      {
        id: "compilations",
        label: "Compilations",
        page: "Compilations",
        status: "live",
      },
      {
        id: "motion",
        label: "Motion Studio",
        page: "Motion Studio",
        status: "partial",
      },
      {
        id: "compositing",
        label: "Compositing Studio",
        page: "Compositing Studio",
        status: "partial",
      },
      { id: "color", label: "Color Studio", page: "Video editor", status: "partial" },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    description: "Restoration, mixing and sound tools",
    routes: [
      {
        id: "audio-mixer",
        label: "Audio mixer",
        page: "Video editor",
        status: "partial",
      },
      {
        id: "restoration",
        label: "Audio restoration",
        page: "Audio restoration",
        status: "live",
      },
      {
        id: "soundboard",
        label: "Soundboard",
        page: "Soundboard",
        status: "live",
      },
    ],
  },
  {
    id: "design",
    label: "Design",
    description: "Graphics, thumbnails and image tools",
    routes: [
      {
        id: "thumbnails",
        label: "Thumbnail Studio",
        page: "Thumbnail studio",
        status: "live",
      },
      {
        id: "design-studio",
        label: "Design Studio",
        page: "Design Studio",
        status: "partial",
      },
      {
        id: "image",
        label: "Image editor",
        page: "Image editor",
        status: "partial",
      },
      {
        id: "three-d",
        label: "3D Studio",
        page: "3D Studio",
        status: "partial",
      },
    ],
  },
  {
    id: "language",
    label: "Language",
    description: "Subtitles, translation and localization",
    routes: [
      {
        id: "subtitles",
        label: "Subtitle Studio",
        page: "Subtitle studio",
        status: "live",
      },
      {
        id: "transcripts",
        label: "Transcripts",
        page: "Transcript explorer",
        status: "live",
      },
      {
        id: "language-factory",
        label: "Language Factory",
        page: "Language Factory",
        status: "live",
      },
    ],
  },
  {
    id: "recording",
    label: "Recording",
    description: "Screen, webcam and scene capture",
    routes: [
      {
        id: "record",
        label: "Recording Studio",
        page: "Recording Studio",
        status: "live",
      },
      {
        id: "replay",
        label: "Instant replay",
        page: "Instant replay",
        status: "live",
      },
      {
        id: "tutorial",
        label: "Tutorial tools",
        page: "Tutorial tools",
        status: "partial",
      },
    ],
  },
  {
    id: "media",
    label: "Media",
    description: "Assets, conversion and inspection",
    routes: [
      { id: "assets", label: "Asset library", page: "Assets", status: "live" },
      {
        id: "bins",
        label: "Project bins",
        page: "Project bins",
        status: "live",
      },
      {
        id: "toolbox",
        label: "Media toolbox",
        page: "Media toolbox",
        status: "live",
      },
      {
        id: "family",
        label: "Clip Family Tree",
        page: "Clip Family Tree",
        status: "live",
      },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    description: "Streamers, workflows and queues",
    routes: [
      { id: "streamers", label: "Streamers", page: "Streamers", status: "live" },
      {
        id: "workflow",
        label: "Workflow builder",
        page: "Workflow builder",
        status: "live",
      },
      { id: "autopilot", label: "Autopilot", page: "Autopilot", status: "live" },
      {
        id: "queue",
        label: "Processing queue",
        page: "Processing queue",
        status: "live",
      },
    ],
  },
  {
    id: "production",
    label: "Production",
    description: "Review, boards and scheduling",
    routes: [
      {
        id: "desk",
        label: "Production desk",
        page: "Production desk",
        status: "live",
      },
      {
        id: "calendar",
        label: "Content calendar",
        page: "Content calendar",
        status: "live",
      },
      {
        id: "review",
        label: "Review Studio",
        page: "Review Studio",
        status: "live",
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    description: "Creator memory, search and AI lab",
    routes: [
      {
        id: "moment-search",
        label: "Moment Search",
        page: "Moment Search",
        status: "live",
      },
      {
        id: "creator-memory",
        label: "Creator Memory",
        page: "Creator Memory",
        status: "live",
      },
      {
        id: "ai-lab",
        label: "AI Laboratory",
        page: "AI Laboratory",
        status: "live",
      },
    ],
  },
  {
    id: "management",
    label: "Management",
    description: "Branding, storage, backup and settings",
    routes: [
      { id: "branding", label: "Branding", page: "Branding", status: "live" },
      { id: "storage", label: "Storage", page: "Storage", status: "live" },
      { id: "system-health", label: "System health", page: "System health", status: "live" },
      {
        id: "backup",
        label: "Backup & recovery",
        page: "Backup & recovery",
        status: "live",
      },
    ],
  },
];

export function livePages() {
  return studioGroups.flatMap((g) =>
    g.routes.filter((r) => r.page && r.status !== "planned").map((r) => r.page!),
  );
}

export function studioForPage(page: string): StudioGroup | undefined {
  return studioGroups.find((g) => g.routes.some((r) => r.page === page));
}
