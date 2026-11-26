"use client";
import type { LucideIcon } from "lucide-react";
import {
  PanelsTopLeft,
  FolderClosed,
  Library,
  Scissors,
  Captions,
  ScanText,
  Image as ImageIcon,
  ListVideo,
  CalendarDays,
  Search,
  Plus,
  Workflow,
  SlidersHorizontal,
  HardDrive,
  Cpu,
  Clapperboard,
  AudioLines,
  Palette,
  Languages,
  Video,
  Box,
  Bot,
  LayoutGrid,
  Layers,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { studioGroups, type StudioGroup, type StudioId } from "@/lib/studios";

export const groupIcons: Record<StudioId, LucideIcon> = {
  home: PanelsTopLeft,
  clipping: Clapperboard,
  editing: Scissors,
  audio: AudioLines,
  design: Palette,
  language: Languages,
  recording: Video,
  media: Box,
  automation: Workflow,
  production: LayoutGrid,
  intelligence: Bot,
  management: SlidersHorizontal,
};

const pageIcons: Record<string, LucideIcon> = {
  Overview: PanelsTopLeft,
  "New project": Plus,
  Projects: FolderClosed,
  "Clip library": Library,
  Assets: FolderClosed,
  Discover: Search,
  "Video editor": Scissors,
  Compilations: ListVideo,
  "Transcript explorer": ScanText,
  "Subtitle studio": Captions,
  "Thumbnail studio": ImageIcon,
  Streamers: Cpu,
  "Processing queue": ListVideo,
  "Automatic clipping": Workflow,
  "Live clipping": ListVideo,
  "Instant clipping": Scissors,
  "Reel Factory": Clapperboard,
  Campaigns: Workflow,
  "System health": Cpu,
  "Moment finder": Scissors,
  Autopilot: Bot,
  "Trend radar": Search,
  "Moment Search": Search,
  "Creator Memory": Bot,
  "Language Factory": Languages,
  "Project bins": FolderClosed,
  "Media toolbox": HardDrive,
  "Clip Family Tree": Clapperboard,
  "Audio restoration": AudioLines,
  Soundboard: AudioLines,
  "Recording Studio": Video,
  "Instant replay": Video,
  "Tutorial tools": BookOpen,
  "Review Studio": MessageSquare,
  "Design Studio": Palette,
  "Image editor": ImageIcon,
  "3D Studio": Box,
  "AI Laboratory": Bot,
  "Motion Studio": Scissors,
  "Compositing Studio": Layers,
  "Workflow builder": Workflow,
  "Production desk": SlidersHorizontal,
  "Content calendar": CalendarDays,
  Branding: SlidersHorizontal,
  Storage: HardDrive,
  "Backup & recovery": HardDrive,
};

export type NavItem = {
  /** Display label from the studio registry */
  label: string;
  /** Workspace page key used by go() */
  page: string;
  Icon: LucideIcon;
  status: "live" | "partial" | "planned";
};

export type NavSection = {
  id:
    | "home"
    | "projects"
    | "clipping"
    | "studio"
    | "library"
    | "automation"
    | "production"
    | "settings";
  Icon: LucideIcon;
  label: string;
  description: string;
  items: NavItem[];
};

/** Live nav sections — one entry per unique page within a group. */
const registeredSections = studioGroups
  .map((group) => {
    const seen = new Set<string>();
    const items: NavItem[] = [];
    for (const route of group.routes) {
      if (!route.page || route.status === "planned") continue;
      if (seen.has(route.page)) continue;
      seen.add(route.page);
      items.push({
        label: route.label,
        page: route.page,
        Icon: pageIcons[route.page] || groupIcons[group.id],
        status: route.status,
      });
    }
    return {
      id: group.id,
      label: group.label,
      description: group.description,
      items,
    };
  })
  .filter((s) => s.items.length > 0);

const destinations = [
  {
    id: "home",
    label: "Home",
    Icon: PanelsTopLeft,
    groups: [],
    pages: ["Overview", "New project"],
    description: "Start or resume a video",
  },
  {
    id: "projects",
    label: "Projects",
    Icon: FolderClosed,
    groups: [],
    pages: ["Projects", "Project bins"],
    description: "Organize your recordings",
  },
  {
    id: "clipping",
    label: "Clipping",
    Icon: Scissors,
    groups: ["clipping", "intelligence"],
    pages: ["Instant clipping", "Live clipping", "Discover"],
    description: "Find and cut moments",
  },
  {
    id: "studio",
    label: "Studio",
    Icon: Clapperboard,
    groups: ["editing", "audio", "design", "language", "recording"],
    pages: ["Video editor"],
    description: "Edit, caption and design",
  },
  {
    id: "library",
    label: "Library",
    Icon: Library,
    groups: ["media"],
    pages: ["Clip library", "Assets", "Branding"],
    description: "Browse clips and assets",
  },
  {
    id: "automation",
    label: "Automation",
    Icon: Workflow,
    groups: ["automation"],
    pages: ["Processing queue", "Automatic clipping", "Streamers"],
    description: "Run and monitor workflows",
  },
  {
    id: "production",
    label: "Production",
    Icon: CalendarDays,
    groups: ["production"],
    pages: ["Production desk"],
    description: "Review and prepare exports",
  },
  {
    id: "settings",
    label: "Settings",
    Icon: SlidersHorizontal,
    groups: ["management"],
    pages: ["Storage", "Backup & recovery"],
    description: "Manage local resources",
  },
] as const;
const pinned = new Map(
  destinations.flatMap((group) =>
    group.pages.map((page) => [page as string, group.id] as const),
  ),
);
const existing = registeredSections.flatMap((group) => group.items);
const assigned = new Set<string>();
export const navSections: NavSection[] = destinations.map((destination) => {
  const ordered = [
    ...destination.pages.flatMap((page) =>
      existing.filter((item) => item.page === page).slice(0, 1),
    ),
    ...registeredSections
      .filter((group) =>
        (destination.groups as readonly string[]).includes(group.id),
      )
      .flatMap((group) => group.items),
  ];
  return {
    ...destination,
    items: ordered.filter((item) => {
      if (
        assigned.has(item.page) ||
        (pinned.has(item.page) && pinned.get(item.page) !== destination.id)
      )
        return false;
      assigned.add(item.page);
      return true;
    }),
  };
});

export const sections = navSections.map(
  (s) => [s.label, s.items.map((i) => [i.page, i.Icon] as const)] as const,
);

export function studioLabelForPage(page: string) {
  const group = studioGroups.find((g) => g.routes.some((r) => r.page === page));
  return group?.label || "Studio";
}

export function sectionForPage(page: string): NavSection | undefined {
  if (page === "Project")
    return navSections.find((group) => group.id === "projects");
  return (
    navSections.find((s) => s.items.some((i) => i.page === page)) ||
    navSections[0]
  );
}

export function liveNavGroups(): NavSection[] {
  return navSections;
}

export { studioGroups };
export type { StudioGroup, StudioId };
