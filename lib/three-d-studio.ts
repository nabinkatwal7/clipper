import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot, file } from "./store";
import { bin, run } from "./process";
import type { Asset } from "./assets";

export type Vec3 = { x: number; y: number; z: number };

export type ThreeObjectKind = "box" | "sphere" | "plane" | "text" | "torus";

export type ThreeObject = {
  id: string;
  kind: ThreeObjectKind;
  name: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  metalness: number;
  roughness: number;
  text?: string;
};

export type ThreeScene = {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  background: string;
  camera: { position: Vec3; lookAt: Vec3 };
  light: { intensity: number; color: string };
  animation: "none" | "turntable" | "orbit" | "bob";
  objects: ThreeObject[];
};

export const THREE_TEMPLATES: { id: string; label: string }[] = [
  { id: "logo-reveal", label: "Logo reveal" },
  { id: "nameplate", label: "Nameplate" },
  { id: "countdown", label: "Countdown block" },
  { id: "geo-bg", label: "Floating geometry" },
];

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function emptyObject(
  kind: ThreeObjectKind,
  name?: string,
): ThreeObject {
  return {
    id: uuid(),
    kind,
    name: name || kind,
    position: v(0, 0.5, 0),
    rotation: v(0, 0, 0),
    scale: v(1, 1, 1),
    color: "#14b8a6",
    metalness: 0.35,
    roughness: 0.4,
    text: kind === "text" ? "CLIP" : undefined,
  };
}

export function sceneFromTemplate(templateId: string): ThreeScene {
  const id = uuid();
  const base: ThreeScene = {
    version: 1,
    id,
    name: THREE_TEMPLATES.find((t) => t.id === templateId)?.label || "Scene",
    updatedAt: new Date().toISOString(),
    background: "#0a1214",
    camera: { position: v(3, 2.2, 4), lookAt: v(0, 0.4, 0) },
    light: { intensity: 1.2, color: "#ffffff" },
    animation: "turntable",
    objects: [],
  };
  switch (templateId) {
    case "nameplate":
      base.objects = [
        { ...emptyObject("box", "Plate"), scale: v(2.4, 0.2, 0.6), position: v(0, 0.2, 0), color: "#0f766e" },
        { ...emptyObject("text", "Name"), text: "CREATOR", position: v(0, 0.55, 0.05), color: "#ecfdf5" },
      ];
      break;
    case "countdown":
      base.objects = [
        { ...emptyObject("box", "Digit"), scale: v(1.2, 1.6, 0.3), color: "#134e4a" },
        { ...emptyObject("text", "3"), text: "3", position: v(0, 0.2, 0.2), color: "#f8fafc", scale: v(1.4, 1.4, 1.4) },
      ];
      base.animation = "bob";
      break;
    case "geo-bg":
      base.objects = [
        { ...emptyObject("torus", "Ring"), position: v(0, 0.8, 0), scale: v(1.2, 1.2, 1.2), color: "#2dd4bf" },
        { ...emptyObject("sphere", "Orb"), position: v(-1.2, 0.4, 0.4), scale: v(0.5, 0.5, 0.5), color: "#99f6e4" },
        { ...emptyObject("box", "Block"), position: v(1.1, 0.35, -0.3), scale: v(0.6, 0.6, 0.6), color: "#0f766e" },
      ];
      base.animation = "orbit";
      break;
    default:
      base.objects = [
        { ...emptyObject("box", "Logo block"), scale: v(1.4, 1.4, 0.35), color: "#14b8a6", metalness: 0.7 },
        { ...emptyObject("text", "Mark"), text: "CS", position: v(0, 0.1, 0.25), color: "#042f2e" },
      ];
  }
  return validateScene(base);
}

export function validateScene(input: unknown): ThreeScene {
  const s = input as ThreeScene;
  if (
    !s ||
    s.version !== 1 ||
    typeof s.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(s.id) ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    !["none", "turntable", "orbit", "bob"].includes(s.animation) ||
    !Array.isArray(s.objects) ||
    s.objects.length > 24
  )
    throw Error("Invalid 3D scene");
  for (const o of s.objects) {
    if (
      !o ||
      !["box", "sphere", "plane", "text", "torus"].includes(o.kind) ||
      typeof o.name !== "string" ||
      !Number.isFinite(o.metalness) ||
      !Number.isFinite(o.roughness)
    )
      throw Error("Invalid 3D object");
  }
  return {
    ...s,
    name: s.name.trim().slice(0, 80),
    updatedAt: new Date().toISOString(),
    objects: s.objects,
  };
}

function scenesPath() {
  return path.join(workspaceRoot(), "three-d-scenes.json");
}

export async function listScenes(): Promise<ThreeScene[]> {
  try {
    const raw = JSON.parse(await fs.readFile(scenesPath(), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => validateScene(s)).slice(0, 32);
  } catch {
    return [];
  }
}

export async function saveScene(scene: ThreeScene) {
  const row = validateScene(scene);
  const rows = await listScenes();
  const next = [row, ...rows.filter((r) => r.id !== row.id)].slice(0, 32);
  const tmp = scenesPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, scenesPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return row;
}

export type FrameBakeOpts = {
  fps: number;
  /** Number of PNG frames (2–48). */
  frames: number;
};

export function validateFrameBakeOpts(input: unknown): FrameBakeOpts {
  const o = input as FrameBakeOpts;
  if (
    !o ||
    !Number.isFinite(o.fps) ||
    o.fps < 12 ||
    o.fps > 30 ||
    !Number.isFinite(o.frames) ||
    o.frames < 2 ||
    o.frames > 48
  )
    throw Error("Invalid frame bake options (fps 12–30, frames 2–48)");
  return { fps: Math.round(o.fps), frames: Math.round(o.frames) };
}

/**
 * Encode a short PNG frame sequence into an MP4 asset.
 * GLB/glTF import is not supported — document honestly in the UI.
 */
export async function bakePngSequence(
  pngBuffers: Buffer[],
  opts: FrameBakeOpts,
  sceneName: string,
  signal?: AbortSignal,
): Promise<Asset> {
  const bake = validateFrameBakeOpts(opts);
  if (!Array.isArray(pngBuffers) || pngBuffers.length < 2)
    throw Error("Need at least 2 PNG frames");
  if (pngBuffers.length > 48) throw Error("At most 48 frames");
  if (pngBuffers.length !== bake.frames)
    throw Error(`Expected ${bake.frames} frames, got ${pngBuffers.length}`);
  for (const buf of pngBuffers) {
    if (!Buffer.isBuffer(buf) || buf.length < 32 || buf.length > 8_000_000)
      throw Error("Invalid PNG frame payload");
    if (buf[0] !== 0x89 || buf[1] !== 0x50) throw Error("Frame is not PNG");
  }

  const job = uuid();
  const dir = path.join(workspaceRoot(), "tmp", `three-d-${job}`);
  await fs.mkdir(dir, { recursive: true });
  const id = uuid();
  const target = file("assets", id, "mp4");
  try {
    for (let i = 0; i < pngBuffers.length; i++) {
      const name = `frame-${String(i).padStart(4, "0")}.png`;
      await fs.writeFile(path.join(dir, name), pngBuffers[i]);
    }
    await run(
      bin.ffmpeg,
      [
        "-y",
        "-framerate",
        String(bake.fps),
        "-i",
        path.join(dir, "frame-%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        target,
      ],
      signal,
    );
    const stat = await fs.stat(target);
    const a: Asset = {
      id,
      name: `3D bake · ${sceneName}`.slice(0, 180),
      description: `Three.js frame sequence (${pngBuffers.length} frames @ ${bake.fps}fps)`,
      folder: "",
      tags: ["3d", "bake"],
      favorite: false,
      kind: "video",
      duration: pngBuffers.length / bake.fps,
      ext: "mp4",
      audio: false,
      bytes: stat.size,
      usedBy: [],
      collections: [],
    };
    await fs.writeFile(file("assets", id, "json"), JSON.stringify(a));
    return a;
  } catch (e) {
    await fs.rm(target, { force: true });
    throw e;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
