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
import { studioGroups, type StudioId } from "@/lib/studios";

const groupIcons: Record<StudioId, LucideIcon> = {
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

/** Live nav sections derived from the studio registry (planned routes omitted). */
export const sections = studioGroups
  .map((group) => {
    const items = group.routes
      .filter((r) => r.page && r.status !== "planned")
      .map((r) => {
        const label = r.page!;
        const Icon = pageIcons[label] || groupIcons[group.id];
        return [label, Icon] as const;
      });
    // Deduplicate pages that appear once per group
    const seen = new Set<string>();
    const unique = items.filter(([label]) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    return [group.label, unique] as const;
  })
  .filter(([, items]) => items.length > 0);

export function studioLabelForPage(page: string) {
  const group = studioGroups.find((g) =>
    g.routes.some((r) => r.page === page),
  );
  return group?.label || "Studio";
}

export { groupIcons, studioGroups };
