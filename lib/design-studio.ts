import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot } from "./store";

export type DesignFormat =
  | "youtube-thumb"
  | "vertical-cover"
  | "square-post"
  | "banner"
  | "story"
  | "podcast-cover"
  | "profile"
  | "quote-card"
  | "gaming"
  | "stream-announce"
  | "carousel";

export type DesignLayer = {
  id: string;
  type: "text" | "rect" | "ellipse" | "image";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color?: string;
  assetId?: string;
  fontSize?: number;
  fontWeight?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  /** Degrees */
  rotation?: number;
  shadow?: { blur: number; color: string; ox: number; oy: number };
  /** Optional second color for vertical gradient fills on rects */
  gradientTo?: string;
};

export type DesignArtboard = {
  version: 1;
  id: string;
  name: string;
  format: DesignFormat;
  width: number;
  height: number;
  updatedAt: string;
  layers: DesignLayer[];
  /** Sibling pages in a multi-page design (same document id via parentId) */
  parentId?: string;
  pageIndex?: number;
};

export type DesignDocument = {
  version: 1;
  id: string;
  name: string;
  format: DesignFormat;
  updatedAt: string;
  pages: DesignArtboard[];
};

export const DESIGN_FORMATS: {
  id: DesignFormat;
  label: string;
  width: number;
  height: number;
}[] = [
  { id: "youtube-thumb", label: "YouTube thumbnail", width: 1280, height: 720 },
  { id: "vertical-cover", label: "Vertical cover", width: 1080, height: 1920 },
  { id: "square-post", label: "Square post", width: 1080, height: 1080 },
  { id: "banner", label: "Channel banner", width: 2560, height: 1440 },
  { id: "story", label: "Story", width: 1080, height: 1920 },
  { id: "podcast-cover", label: "Podcast cover", width: 1400, height: 1400 },
  { id: "profile", label: "Profile image", width: 800, height: 800 },
  { id: "quote-card", label: "Quote card", width: 1080, height: 1350 },
  { id: "gaming", label: "Gaming graphic", width: 1920, height: 1080 },
  {
    id: "stream-announce",
    label: "Stream announcement",
    width: 1280,
    height: 720,
  },
  { id: "carousel", label: "Carousel slide", width: 1080, height: 1080 },
];

export function emptyArtboard(
  format: DesignFormat = "youtube-thumb",
  name = "Untitled design",
): DesignArtboard {
  const meta = DESIGN_FORMATS.find((f) => f.id === format) || DESIGN_FORMATS[0];
  return {
    version: 1,
    id: uuid(),
    name: name.slice(0, 80),
    format: meta.id,
    width: meta.width,
    height: meta.height,
    updatedAt: new Date().toISOString(),
    layers: [
      {
        id: uuid(),
        type: "rect",
        name: "Background",
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        color: "#0f172a",
        gradientTo: "#134e4a",
        opacity: 1,
        visible: true,
        locked: false,
        rotation: 0,
      },
      {
        id: uuid(),
        type: "text",
        name: "Title",
        x: 0.08,
        y: 0.35,
        w: 0.84,
        h: 0.25,
        text: "Your headline",
        color: "#f8fafc",
        fontSize: 72,
        fontWeight: 700,
        opacity: 1,
        visible: true,
        locked: false,
        rotation: 0,
        shadow: { blur: 18, color: "#00000088", ox: 0, oy: 0.01 },
      },
    ],
  };
}

export function emptyDocument(
  format: DesignFormat = "youtube-thumb",
  name = "Untitled design",
): DesignDocument {
  const page = emptyArtboard(format, "Page 1");
  const id = uuid();
  page.parentId = id;
  page.pageIndex = 0;
  return {
    version: 1,
    id,
    name: name.slice(0, 80),
    format: page.format,
    updatedAt: new Date().toISOString(),
    pages: [page],
  };
}

export function validateLayer(input: unknown): DesignLayer {
  const l = input as DesignLayer;
  if (
    !l ||
    typeof l.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(l.id) ||
    !["text", "rect", "ellipse", "image"].includes(l.type) ||
    typeof l.name !== "string" ||
    !Number.isFinite(l.x) ||
    !Number.isFinite(l.y) ||
    !Number.isFinite(l.w) ||
    !Number.isFinite(l.h) ||
    l.w <= 0 ||
    l.h <= 0 ||
    (l.opacity !== undefined &&
      (!Number.isFinite(l.opacity) || l.opacity < 0 || l.opacity > 1)) ||
    (l.gradientTo !== undefined && !/^#[0-9a-fA-F]{6}$/.test(l.gradientTo))
  )
    throw Error("Invalid design layer");
  return {
    id: l.id,
    type: l.type,
    name: l.name.slice(0, 80),
    x: l.x,
    y: l.y,
    w: l.w,
    h: l.h,
    text: l.text?.slice(0, 200),
    color: l.color,
    assetId: l.assetId,
    fontSize: l.fontSize,
    opacity: l.opacity ?? 1,
    visible: l.visible !== false,
    locked: !!l.locked,
    gradientTo: l.gradientTo,
    fontWeight:
      l.fontWeight !== undefined &&
      Number.isFinite(l.fontWeight) &&
      l.fontWeight >= 100 &&
      l.fontWeight <= 900
        ? l.fontWeight
        : undefined,
    rotation:
      l.rotation !== undefined &&
      Number.isFinite(l.rotation) &&
      Math.abs(l.rotation) <= 180
        ? l.rotation
        : 0,
    shadow:
      l.shadow &&
      Number.isFinite(l.shadow.blur) &&
      l.shadow.blur >= 0 &&
      l.shadow.blur <= 80
        ? {
            blur: l.shadow.blur,
            color: l.shadow.color || "#00000088",
            ox: Number.isFinite(l.shadow.ox) ? l.shadow.ox : 0,
            oy: Number.isFinite(l.shadow.oy) ? l.shadow.oy : 0,
          }
        : undefined,
  };
}

export type AlignMode =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

export function alignLayer(
  layer: DesignLayer,
  mode: AlignMode,
): DesignLayer {
  const next = { ...layer };
  switch (mode) {
    case "left":
      next.x = 0;
      break;
    case "center-x":
      next.x = Math.max(0, (1 - layer.w) / 2);
      break;
    case "right":
      next.x = Math.max(0, 1 - layer.w);
      break;
    case "top":
      next.y = 0;
      break;
    case "center-y":
      next.y = Math.max(0, (1 - layer.h) / 2);
      break;
    case "bottom":
      next.y = Math.max(0, 1 - layer.h);
      break;
  }
  return next;
}

export function addPage(doc: DesignDocument): DesignDocument {
  const page = emptyArtboard(doc.format, `Page ${doc.pages.length + 1}`);
  page.parentId = doc.id;
  page.pageIndex = doc.pages.length;
  if (doc.pages.length >= 12) throw Error("At most 12 pages per design");
  return {
    ...doc,
    updatedAt: new Date().toISOString(),
    pages: [...doc.pages, page],
  };
}

export function validateArtboard(input: unknown): DesignArtboard {
  const a = input as DesignArtboard;
  if (
    !a ||
    a.version !== 1 ||
    typeof a.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(a.id) ||
    typeof a.name !== "string" ||
    !a.name.trim() ||
    !DESIGN_FORMATS.some((f) => f.id === a.format) ||
    !Number.isFinite(a.width) ||
    !Number.isFinite(a.height) ||
    a.width < 64 ||
    a.height < 64 ||
    a.width > 4096 ||
    a.height > 4096 ||
    !Array.isArray(a.layers) ||
    a.layers.length > 48
  )
    throw Error("Invalid design artboard");
  return {
    version: 1,
    id: a.id,
    name: a.name.trim().slice(0, 80),
    format: a.format,
    width: Math.round(a.width),
    height: Math.round(a.height),
    updatedAt: new Date().toISOString(),
    layers: a.layers.map(validateLayer),
    parentId: a.parentId,
    pageIndex: a.pageIndex,
  };
}

export function validateDocument(input: unknown): DesignDocument {
  const d = input as DesignDocument;
  if (
    !d ||
    d.version !== 1 ||
    typeof d.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(d.id) ||
    typeof d.name !== "string" ||
    !d.name.trim() ||
    !DESIGN_FORMATS.some((f) => f.id === d.format) ||
    !Array.isArray(d.pages) ||
    !d.pages.length ||
    d.pages.length > 12
  )
    throw Error("Invalid design document");
  return {
    version: 1,
    id: d.id,
    name: d.name.trim().slice(0, 80),
    format: d.format,
    updatedAt: new Date().toISOString(),
    pages: d.pages.map((p, i) =>
      validateArtboard({
        ...p,
        parentId: d.id,
        pageIndex: i,
        format: d.format,
      }),
    ),
  };
}

/** Apply {{title}} / {{creator}} style tokens into text layers. */
export function applyDesignVariables(
  board: DesignArtboard,
  vars: Record<string, string>,
): DesignArtboard {
  const replace = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      vars[key] !== undefined ? String(vars[key]).slice(0, 120) : "",
    );
  return validateArtboard({
    ...board,
    id: uuid(),
    name: replace(board.name).slice(0, 80) || board.name,
    layers: board.layers.map((l) => ({
      ...l,
      id: uuid(),
      text: l.text ? replace(l.text) : l.text,
    })),
  });
}

/** Bulk-generate artboards from rows (max 20). */
export function bulkFromRows(
  template: DesignArtboard,
  rows: Record<string, string>[],
): DesignArtboard[] {
  if (!Array.isArray(rows) || !rows.length)
    throw Error("Provide at least one data row");
  return rows.slice(0, 20).map((row, i) => {
    const board = applyDesignVariables(template, row);
    board.name = (row.title || row.name || `Design ${i + 1}`).slice(0, 80);
    return board;
  });
}

export function reorderLayer(
  board: DesignArtboard,
  id: string,
  dir: "up" | "down",
): DesignArtboard {
  const layers = [...board.layers];
  const i = layers.findIndex((l) => l.id === id);
  if (i < 0) throw Error("Layer not found");
  const j = dir === "up" ? i + 1 : i - 1;
  if (j < 0 || j >= layers.length) return board;
  [layers[i], layers[j]] = [layers[j], layers[i]];
  return validateArtboard({ ...board, layers });
}

function designsPath() {
  return path.join(workspaceRoot(), "design-artboards.json");
}

function documentsPath() {
  return path.join(workspaceRoot(), "design-documents.json");
}

export async function listDocuments(): Promise<DesignDocument[]> {
  try {
    const raw = JSON.parse(await fs.readFile(documentsPath(), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.map((d) => validateDocument(d)).slice(0, 32);
  } catch {
    return [];
  }
}

export async function saveDocument(doc: DesignDocument) {
  const row = validateDocument(doc);
  const rows = await listDocuments();
  const next = [row, ...rows.filter((r) => r.id !== row.id)].slice(0, 32);
  const tmp = documentsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, documentsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  // Also mirror pages into artboard list for older callers
  await saveArtboards(row.pages);
  return row;
}

export async function listArtboards(): Promise<DesignArtboard[]> {
  try {
    const raw = JSON.parse(await fs.readFile(designsPath(), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.map((a) => validateArtboard(a)).slice(0, 64);
  } catch {
    return [];
  }
}

export async function saveArtboard(board: DesignArtboard) {
  const row = validateArtboard(board);
  const rows = await listArtboards();
  const next = [row, ...rows.filter((r) => r.id !== row.id)].slice(0, 64);
  const tmp = designsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, designsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return row;
}

export async function saveArtboards(boards: DesignArtboard[]) {
  const rows = boards.map(validateArtboard).slice(0, 64);
  const existing = await listArtboards();
  const ids = new Set(rows.map((r) => r.id));
  const next = [...rows, ...existing.filter((e) => !ids.has(e.id))].slice(0, 64);
  const tmp = designsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, designsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return rows;
}
