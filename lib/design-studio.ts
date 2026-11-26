import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot } from "./store";

export type DesignFormat =
  | "youtube-thumb"
  | "vertical-cover"
  | "square-post"
  | "banner"
  | "story";

export type DesignLayer = {
  id: string;
  type: "text" | "rect" | "image";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color?: string;
  assetId?: string;
  fontSize?: number;
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
      },
    ],
  };
}

export function validateLayer(input: unknown): DesignLayer {
  const l = input as DesignLayer;
  if (
    !l ||
    typeof l.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(l.id) ||
    !["text", "rect", "image"].includes(l.type) ||
    typeof l.name !== "string" ||
    !Number.isFinite(l.x) ||
    !Number.isFinite(l.y) ||
    !Number.isFinite(l.w) ||
    !Number.isFinite(l.h) ||
    l.w <= 0 ||
    l.h <= 0
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
  };
}

function designsPath() {
  return path.join(workspaceRoot(), "design-artboards.json");
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
