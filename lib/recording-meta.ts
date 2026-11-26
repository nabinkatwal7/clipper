import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot } from "./store";

export type RecordingScene = {
  id: string;
  name: string;
  layout: "fullscreen" | "pip" | "split" | "vertical" | "presentation";
  includeWebcam: boolean;
  includeMic: boolean;
  includeSystemAudio: boolean;
};

export type RecordingBookmark = {
  id: string;
  at: number;
  label: string;
};

export type RecordingTrackRole =
  | "composite"
  | "screen"
  | "webcam"
  | "microphone"
  | "system";

export type RecordingTrackAsset = {
  role: RecordingTrackRole;
  assetId: string;
};

export type RecordingSessionMeta = {
  version: 1;
  id: string;
  startedAt: string;
  endedAt?: string;
  sceneId: string;
  assetId?: string;
  duration?: number;
  bookmarks: RecordingBookmark[];
  separateTracks: boolean;
  /** Per-source assets when separate-track capture was enabled */
  tracks?: RecordingTrackAsset[];
};

export function validateTrackAsset(input: unknown): RecordingTrackAsset {
  const t = input as RecordingTrackAsset;
  if (
    !t ||
    !["composite", "screen", "webcam", "microphone", "system"].includes(
      t.role,
    ) ||
    typeof t.assetId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(t.assetId)
  )
    throw Error("Invalid recording track asset");
  return { role: t.role, assetId: t.assetId };
}

function scenesPath() {
  return path.join(workspaceRoot(), "recording-scenes.json");
}

function sessionsPath() {
  return path.join(workspaceRoot(), "recording-sessions.json");
}

export const defaultScenes: RecordingScene[] = [
  {
    id: "scene-gameplay",
    name: "Gameplay",
    layout: "fullscreen",
    includeWebcam: false,
    includeMic: true,
    includeSystemAudio: true,
  },
  {
    id: "scene-facecam",
    name: "Facecam",
    layout: "pip",
    includeWebcam: true,
    includeMic: true,
    includeSystemAudio: false,
  },
  {
    id: "scene-tutorial",
    name: "Screen tutorial",
    layout: "presentation",
    includeWebcam: true,
    includeMic: true,
    includeSystemAudio: true,
  },
  {
    id: "scene-vertical",
    name: "Vertical recording",
    layout: "vertical",
    includeWebcam: true,
    includeMic: true,
    includeSystemAudio: false,
  },
];

export function validateScene(input: unknown): RecordingScene {
  const s = input as RecordingScene;
  if (
    !s ||
    typeof s.id !== "string" ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 80 ||
    !["fullscreen", "pip", "split", "vertical", "presentation"].includes(
      s.layout,
    ) ||
    typeof s.includeWebcam !== "boolean" ||
    typeof s.includeMic !== "boolean" ||
    typeof s.includeSystemAudio !== "boolean"
  )
    throw Error("Invalid recording scene");
  return {
    id: s.id.slice(0, 80),
    name: s.name.trim(),
    layout: s.layout,
    includeWebcam: s.includeWebcam,
    includeMic: s.includeMic,
    includeSystemAudio: s.includeSystemAudio,
  };
}

export async function loadScenes(): Promise<RecordingScene[]> {
  try {
    const raw = JSON.parse(await fs.readFile(scenesPath(), "utf8"));
    if (!Array.isArray(raw) || !raw.length) return defaultScenes;
    return raw.map(validateScene).slice(0, 32);
  } catch {
    return defaultScenes;
  }
}

export async function saveScenes(scenes: RecordingScene[]) {
  const rows = scenes.map(validateScene).slice(0, 32);
  const tmp = scenesPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
    await fs.rename(tmp, scenesPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return rows;
}

export async function listSessions(): Promise<RecordingSessionMeta[]> {
  try {
    const raw = JSON.parse(await fs.readFile(sessionsPath(), "utf8"));
    return Array.isArray(raw) ? raw.slice(0, 100) : [];
  } catch {
    return [];
  }
}

export async function appendSession(meta: RecordingSessionMeta) {
  if (
    !meta ||
    meta.version !== 1 ||
    typeof meta.id !== "string" ||
    typeof meta.sceneId !== "string" ||
    typeof meta.separateTracks !== "boolean" ||
    !Array.isArray(meta.bookmarks)
  )
    throw Error("Invalid recording session");
  const tracks = meta.tracks?.map(validateTrackAsset).slice(0, 8);
  const row: RecordingSessionMeta = {
    ...meta,
    tracks,
  };
  const rows = await listSessions();
  rows.unshift(row);
  const tmp = sessionsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(rows.slice(0, 100), null, 2));
    await fs.rename(tmp, sessionsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return row;
}

export function newSession(sceneId: string): RecordingSessionMeta {
  return {
    version: 1,
    id: uuid(),
    startedAt: new Date().toISOString(),
    sceneId,
    bookmarks: [],
    separateTracks: false,
  };
}
