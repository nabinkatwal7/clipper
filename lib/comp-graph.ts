import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { asset, type Asset } from "./assets";
import { bin, run } from "./process";
import { file, workspaceRoot } from "./store";

export type PortType = "image" | "video" | "alpha" | "any";

export type CompNodeKind =
  | "source.video"
  | "source.image"
  | "source.solid"
  | "source.noise"
  | "transform"
  | "transform.crop"
  | "transform.flip"
  | "effect.blur"
  | "effect.sharpen"
  | "effect.vignette"
  | "effect.grain"
  | "effect.glow"
  | "comp.merge"
  | "comp.chroma"
  | "comp.luma"
  | "comp.mask"
  | "output.preview"
  | "output.video";

export type CompPort = {
  id: string;
  label: string;
  type: PortType;
  dir: "in" | "out";
};

export type CompNode = {
  id: string;
  kind: CompNodeKind;
  label: string;
  x: number;
  y: number;
  /** Asset UUID for source nodes */
  assetId?: string;
  /** Hex color for solid */
  color?: string;
  /** Chroma / solid hex */
  keyColor?: string;
  blur?: number;
  amount?: number;
  flip?: "h" | "v" | "both";
  crop?: { x: number; y: number; w: number; h: number };
  ports: CompPort[];
};

export type CompEdge = {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
};

export type CompGraph = {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  nodes: CompNode[];
  edges: CompEdge[];
};

const io1: CompPort[] = [
  { id: "in", label: "In", type: "any", dir: "in" },
  { id: "out", label: "Out", type: "any", dir: "out" },
];

const KIND_PORTS: Record<CompNodeKind, CompPort[]> = {
  "source.video": [{ id: "out", label: "Video", type: "video", dir: "out" }],
  "source.image": [{ id: "out", label: "Image", type: "image", dir: "out" }],
  "source.solid": [{ id: "out", label: "Image", type: "image", dir: "out" }],
  "source.noise": [{ id: "out", label: "Image", type: "image", dir: "out" }],
  transform: io1,
  "transform.crop": io1,
  "transform.flip": io1,
  "effect.blur": io1,
  "effect.sharpen": io1,
  "effect.vignette": io1,
  "effect.grain": io1,
  "effect.glow": io1,
  "comp.merge": [
    { id: "base", label: "Base", type: "any", dir: "in" },
    { id: "over", label: "Over", type: "any", dir: "in" },
    { id: "out", label: "Out", type: "any", dir: "out" },
  ],
  "comp.chroma": [
    { id: "in", label: "In", type: "video", dir: "in" },
    { id: "out", label: "Out", type: "video", dir: "out" },
  ],
  "comp.luma": [
    { id: "in", label: "In", type: "any", dir: "in" },
    { id: "out", label: "Out", type: "any", dir: "out" },
  ],
  "comp.mask": [
    { id: "in", label: "In", type: "any", dir: "in" },
    { id: "mask", label: "Mask", type: "alpha", dir: "in" },
    { id: "out", label: "Out", type: "any", dir: "out" },
  ],
  "output.preview": [{ id: "in", label: "In", type: "any", dir: "in" }],
  "output.video": [{ id: "in", label: "In", type: "any", dir: "in" }],
};

export const NODE_CATALOG: { kind: CompNodeKind; label: string; group: string }[] =
  [
    { kind: "source.video", label: "Video", group: "Sources" },
    { kind: "source.image", label: "Image", group: "Sources" },
    { kind: "source.solid", label: "Solid", group: "Sources" },
    { kind: "source.noise", label: "Noise", group: "Sources" },
    { kind: "transform", label: "Transform", group: "Transform" },
    { kind: "transform.crop", label: "Crop", group: "Transform" },
    { kind: "transform.flip", label: "Flip", group: "Transform" },
    { kind: "effect.blur", label: "Blur", group: "Effects" },
    { kind: "effect.sharpen", label: "Sharpen", group: "Effects" },
    { kind: "effect.vignette", label: "Vignette", group: "Effects" },
    { kind: "effect.grain", label: "Film grain", group: "Effects" },
    { kind: "effect.glow", label: "Glow", group: "Effects" },
    { kind: "comp.merge", label: "Merge", group: "Composite" },
    { kind: "comp.chroma", label: "Chroma key", group: "Composite" },
    { kind: "comp.luma", label: "Luma key", group: "Composite" },
    { kind: "comp.mask", label: "Mask", group: "Composite" },
    { kind: "output.preview", label: "Preview", group: "Output" },
    { kind: "output.video", label: "Video out", group: "Output" },
  ];

function portsCompatible(from: PortType, to: PortType) {
  if (from === "any" || to === "any") return true;
  if (from === to) return true;
  // video can feed image-like consumers in this scaffold
  if (from === "video" && to === "image") return true;
  return false;
}

export function createNode(
  kind: CompNodeKind,
  x = 80,
  y = 80,
  label?: string,
): CompNode {
  const meta = NODE_CATALOG.find((n) => n.kind === kind);
  return {
    id: uuid(),
    kind,
    label: label || meta?.label || kind,
    x,
    y,
    color: kind === "source.solid" ? "#1e293b" : undefined,
    keyColor:
      kind === "comp.chroma" || kind === "comp.luma" ? "#00ff00" : undefined,
    blur: kind === "effect.blur" ? 8 : undefined,
    amount:
      kind === "effect.sharpen" ||
      kind === "effect.grain" ||
      kind === "effect.glow" ||
      kind === "comp.luma"
        ? 0.35
        : undefined,
    flip: kind === "transform.flip" ? "h" : undefined,
    crop:
      kind === "transform.crop"
        ? { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
        : undefined,
    ports: KIND_PORTS[kind].map((p) => ({ ...p })),
  };
}

export function emptyGraph(name = "Comp 1"): CompGraph {
  const source = createNode("source.video", 40, 120);
  const out = createNode("output.preview", 360, 120);
  return {
    version: 1,
    id: uuid(),
    name: name.slice(0, 80),
    updatedAt: new Date().toISOString(),
    nodes: [source, out],
    edges: [],
  };
}

export function validateGraph(input: unknown): CompGraph {
  if (!input || typeof input !== "object") throw Error("Invalid graph");
  const g = input as CompGraph;
  if (
    g.version !== 1 ||
    typeof g.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(g.id) ||
    typeof g.name !== "string" ||
    !g.name.trim() ||
    g.name.length > 80 ||
    !Array.isArray(g.nodes) ||
    !Array.isArray(g.edges) ||
    g.nodes.length > 48 ||
    g.edges.length > 96
  )
    throw Error("Invalid compositing graph");

  const nodes = new Map<string, CompNode>();
  for (const n of g.nodes) {
    if (
      !n ||
      typeof n.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(n.id) ||
      !KIND_PORTS[n.kind] ||
      typeof n.label !== "string" ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      nodes.has(n.id)
    )
      throw Error("Invalid compositing node");
    nodes.set(n.id, n);
  }

  const edgeIds = new Set<string>();
  const incoming = new Map<string, string[]>();
  for (const e of g.edges) {
    if (
      !e ||
      typeof e.id !== "string" ||
      edgeIds.has(e.id) ||
      !nodes.has(e.from) ||
      !nodes.has(e.to) ||
      e.from === e.to
    )
      throw Error("Invalid edge");
    edgeIds.add(e.id);
    const fromNode = nodes.get(e.from)!;
    const toNode = nodes.get(e.to)!;
    const outPort = fromNode.ports.find(
      (p) => p.id === e.fromPort && p.dir === "out",
    );
    const inPort = toNode.ports.find((p) => p.id === e.toPort && p.dir === "in");
    if (!outPort || !inPort) throw Error("Unknown port on edge");
    if (!portsCompatible(outPort.type, inPort.type))
      throw Error(`Incompatible ports ${outPort.type} → ${inPort.type}`);
    // one connection per input port
    const key = `${e.to}:${e.toPort}`;
    if (incoming.has(key)) throw Error("Input port already connected");
    incoming.set(key, [e.from]);
  }

  // cycle check (DFS)
  const adj = new Map<string, string[]>();
  for (const e of g.edges) {
    const list = adj.get(e.from) || [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): boolean => {
    const s = state.get(id) || 0;
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(id, 1);
    for (const next of adj.get(id) || []) if (visit(next)) return true;
    state.set(id, 2);
    return false;
  };
  for (const id of nodes.keys()) if (visit(id)) throw Error("Graph contains a cycle");

  return {
    version: 1,
    id: g.id,
    name: g.name.trim(),
    updatedAt: new Date().toISOString(),
    nodes: g.nodes,
    edges: g.edges,
  };
}

/** Topological order for compile / preview. */
export function topoOrder(graph: CompGraph): string[] {
  const g = validateGraph(graph);
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of g.nodes) indeg.set(n.id, 0);
  for (const e of g.edges) {
    adj.set(e.from, [...(adj.get(e.from) || []), e.to]);
    indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
  }
  const q = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      const d = (indeg.get(next) || 1) - 1;
      indeg.set(next, d);
      if (d === 0) q.push(next);
    }
  }
  if (order.length !== g.nodes.length) throw Error("Graph contains a cycle");
  return order;
}

/**
 * Compile graph into a deterministic plan of FFmpeg-oriented steps.
 * Scaffold: describes operations; full filter-graph bake is Phase 9 follow-up.
 */
export function compileGraph(graph: CompGraph): {
  ok: true;
  steps: string[];
  outputs: string[];
} {
  const g = validateGraph(graph);
  const order = topoOrder(g);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const steps: string[] = [];
  const outputs: string[] = [];
  for (const id of order) {
    const n = byId.get(id)!;
    switch (n.kind) {
      case "source.video":
        steps.push(
          n.assetId
            ? `read video asset ${n.assetId}`
            : "video source (assign asset)",
        );
        break;
      case "source.image":
        steps.push(
          n.assetId
            ? `read image asset ${n.assetId}`
            : "image source (assign asset)",
        );
        break;
      case "source.solid":
        steps.push(`solid color ${n.color || "#000000"}`);
        break;
      case "source.noise":
        steps.push("procedural noise");
        break;
      case "transform":
        steps.push("transform (position/scale/rotate)");
        break;
      case "transform.crop":
        steps.push("crop");
        break;
      case "transform.flip":
        steps.push(`flip ${n.flip || "h"}`);
        break;
      case "effect.blur":
        steps.push(`gblur=sigma=${n.blur ?? 8}`);
        break;
      case "effect.sharpen":
        steps.push(`unsharp amount=${n.amount ?? 0.35}`);
        break;
      case "effect.vignette":
        steps.push("vignette");
        break;
      case "effect.grain":
        steps.push(`noise strength=${n.amount ?? 0.35}`);
        break;
      case "effect.glow":
        steps.push(`glow amount=${n.amount ?? 0.35}`);
        break;
      case "comp.merge":
        steps.push("overlay merge (base + over)");
        break;
      case "comp.chroma":
        steps.push(
          `chromakey=${n.keyColor || "#00ff00"}:similarity=0.2:blend=0.1`,
        );
        break;
      case "comp.luma":
        steps.push(`lumakey threshold=${n.amount ?? 0.35}`);
        break;
      case "comp.mask":
        steps.push("alphamerge / maskedmerge");
        break;
      case "output.preview":
        steps.push("preview monitor");
        outputs.push(id);
        break;
      case "output.video":
        steps.push("encode intermediate video asset");
        outputs.push(id);
        break;
    }
  }
  if (!outputs.length)
    throw Error("Add a Preview or Video out node and connect the graph");
  return { ok: true, steps, outputs };
}

export type BakePlan = {
  inputArgs: string[];
  filterComplex: string;
  mapLabel: string;
  duration: number;
  width: number;
  height: number;
  steps: string[];
};

type ResolvedSource = {
  path: string;
  duration: number;
  kind: "video" | "image";
};

function hexColor(c: string | undefined, fallback: string) {
  const v = (c || fallback).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw Error("Invalid color " + v);
  return "0x" + v.slice(1);
}

function edgeInto(
  graph: CompGraph,
  nodeId: string,
  portId: string,
): CompEdge | undefined {
  return graph.edges.find((e) => e.to === nodeId && e.toPort === portId);
}

/**
 * Build an FFmpeg filter_complex for a validated graph.
 * Caps duration at 60s. Requires a connected Preview or Video out.
 */
export function buildBakePlan(
  graph: CompGraph,
  sources: Map<string, ResolvedSource>,
  opts?: { width?: number; height?: number; duration?: number },
): BakePlan {
  const g = validateGraph(graph);
  const order = topoOrder(g);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const w = opts?.width && opts.width >= 16 ? Math.round(opts.width / 2) * 2 : 1280;
  const h =
    opts?.height && opts.height >= 16 ? Math.round(opts.height / 2) * 2 : 720;
  let duration = opts?.duration && opts.duration > 0 ? opts.duration : 0;

  const inputArgs: string[] = [];
  const filters: string[] = [];
  const steps: string[] = [];
  const labels = new Map<string, string>();
  let inputIndex = 0;
  let outLabel = "";

  const requireIn = (nodeId: string, port: string) => {
    const e = edgeInto(g, nodeId, port);
    if (!e) throw Error(`Node ${byId.get(nodeId)?.label} missing ${port} input`);
    const lab = labels.get(e.from);
    if (!lab) throw Error("Upstream not resolved");
    return lab;
  };

  for (const id of order) {
    const n = byId.get(id)!;
    const tag = "n" + id.replace(/-/g, "").slice(0, 8);

    switch (n.kind) {
      case "source.video":
      case "source.image": {
        if (!n.assetId) throw Error(`${n.label} needs an asset`);
        const src = sources.get(n.assetId);
        if (!src) throw Error(`Missing media for ${n.label}`);
        if (n.kind === "source.image") {
          inputArgs.push(
            "-loop",
            "1",
            "-framerate",
            "30",
            "-t",
            String(Math.min(60, duration || src.duration || 5)),
            "-i",
            src.path,
          );
        } else {
          inputArgs.push("-i", src.path);
        }
        if (!duration) duration = Math.min(60, src.duration || 5);
        else duration = Math.min(60, Math.max(duration, src.duration || 0));
        filters.push(
          `[${inputIndex}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=rgba[${tag}]`,
        );
        labels.set(id, tag);
        inputIndex++;
        steps.push(`input ${n.kind} ${n.assetId}`);
        break;
      }
      case "source.solid": {
        const d = Math.min(60, duration || 5);
        if (!duration) duration = d;
        const c = hexColor(n.color, "#1e293b");
        filters.push(
          `color=c=${c}:s=${w}x${h}:d=${d},format=rgba,setsar=1[${tag}]`,
        );
        labels.set(id, tag);
        steps.push(`solid ${n.color || "#1e293b"}`);
        break;
      }
      case "source.noise": {
        const d = Math.min(60, duration || 5);
        if (!duration) duration = d;
        filters.push(
          `nullsrc=s=${w}x${h}:d=${d},geq=random(1)*255:128:128,format=rgba,setsar=1[${tag}]`,
        );
        labels.set(id, tag);
        steps.push("noise");
        break;
      }
      case "transform": {
        const inn = requireIn(id, "in");
        filters.push(`[${inn}]scale=iw:ih,setsar=1[${tag}]`);
        labels.set(id, tag);
        steps.push("transform");
        break;
      }
      case "transform.crop": {
        const inn = requireIn(id, "in");
        const c = n.crop || { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
        filters.push(
          `[${inn}]crop=iw*${c.w}:ih*${c.h}:iw*${c.x}:ih*${c.y},scale=${w}:${h},setsar=1[${tag}]`,
        );
        labels.set(id, tag);
        steps.push("crop");
        break;
      }
      case "transform.flip": {
        const inn = requireIn(id, "in");
        const flip =
          n.flip === "v"
            ? "vflip"
            : n.flip === "both"
              ? "hflip,vflip"
              : "hflip";
        filters.push(`[${inn}]${flip}[${tag}]`);
        labels.set(id, tag);
        steps.push(`flip ${n.flip || "h"}`);
        break;
      }
      case "effect.blur": {
        const inn = requireIn(id, "in");
        const sigma = Math.min(64, Math.max(0, n.blur ?? 8));
        filters.push(`[${inn}]gblur=sigma=${sigma}[${tag}]`);
        labels.set(id, tag);
        steps.push(`gblur=${sigma}`);
        break;
      }
      case "effect.sharpen": {
        const inn = requireIn(id, "in");
        const amt = Math.min(5, Math.max(0.1, (n.amount ?? 0.35) * 5));
        filters.push(`[${inn}]unsharp=5:5:${amt}:5:5:0[${tag}]`);
        labels.set(id, tag);
        steps.push(`unsharp ${amt}`);
        break;
      }
      case "effect.vignette": {
        const inn = requireIn(id, "in");
        filters.push(`[${inn}]vignette=angle=PI/4[${tag}]`);
        labels.set(id, tag);
        steps.push("vignette");
        break;
      }
      case "effect.grain": {
        const inn = requireIn(id, "in");
        const strength = Math.min(100, Math.max(1, (n.amount ?? 0.35) * 40));
        filters.push(
          `[${inn}]noise=alls=${strength}:allf=t[${tag}]`,
        );
        labels.set(id, tag);
        steps.push(`grain ${strength}`);
        break;
      }
      case "effect.glow": {
        const inn = requireIn(id, "in");
        const sigma = Math.min(24, Math.max(2, (n.amount ?? 0.35) * 20));
        filters.push(
          `[${inn}]split[${tag}a][${tag}b];[${tag}b]gblur=sigma=${sigma}[${tag}g];[${tag}a][${tag}g]blend=all_mode=screen:all_opacity=0.45[${tag}]`,
        );
        labels.set(id, tag);
        steps.push(`glow ${sigma}`);
        break;
      }
      case "comp.merge": {
        const base = requireIn(id, "base");
        const over = requireIn(id, "over");
        filters.push(
          `[${base}][${over}]overlay=x=(W-w)/2:y=(H-h)/2:format=auto[${tag}]`,
        );
        labels.set(id, tag);
        steps.push("overlay merge");
        break;
      }
      case "comp.chroma": {
        const inn = requireIn(id, "in");
        const key = hexColor(n.keyColor, "#00ff00");
        filters.push(
          `[${inn}]chromakey=${key}:similarity=0.2:blend=0.1[${tag}]`,
        );
        labels.set(id, tag);
        steps.push(`chromakey ${n.keyColor || "#00ff00"}`);
        break;
      }
      case "comp.luma": {
        const inn = requireIn(id, "in");
        const thr = Math.min(1, Math.max(0, n.amount ?? 0.35));
        filters.push(
          `[${inn}]lumakey=threshold=${thr}:tolerance=0.1:softness=0.1[${tag}]`,
        );
        labels.set(id, tag);
        steps.push(`lumakey ${thr}`);
        break;
      }
      case "comp.mask": {
        const inn = requireIn(id, "in");
        const mask = requireIn(id, "mask");
        filters.push(
          `[${inn}]format=rgba[${tag}i];[${mask}]format=gray,scale=${w}:${h}[${tag}m];[${tag}i][${tag}m]alphamerge[${tag}]`,
        );
        labels.set(id, tag);
        steps.push("alphamerge mask");
        break;
      }
      case "output.preview":
      case "output.video": {
        const inn = requireIn(id, "in");
        filters.push(`[${inn}]format=yuv420p[${tag}]`);
        labels.set(id, tag);
        outLabel = tag;
        steps.push(n.kind === "output.video" ? "video out" : "preview out");
        break;
      }
    }
  }

  if (!outLabel) throw Error("Connect a Preview or Video out node");
  if (!duration || duration <= 0) duration = 5;
  duration = Math.min(60, duration);

  return {
    inputArgs,
    filterComplex: filters.join(";"),
    mapLabel: outLabel,
    duration,
    width: w,
    height: h,
    steps,
  };
}

/** Bake graph to a new video asset (max 60s). */
export async function bakeGraph(
  graph: CompGraph,
  signal?: AbortSignal,
  opts?: { width?: number; height?: number; duration?: number },
): Promise<Asset & { steps: string[] }> {
  const g = validateGraph(graph);
  const sources = new Map<string, ResolvedSource>();
  for (const n of g.nodes) {
    if (
      (n.kind === "source.video" || n.kind === "source.image") &&
      n.assetId &&
      !sources.has(n.assetId)
    ) {
      const a = await asset(n.assetId);
      if (n.kind === "source.video" && a.kind !== "video")
        throw Error("Video source requires a video asset");
      if (n.kind === "source.image" && a.kind !== "image")
        throw Error("Image source requires an image asset");
      sources.set(n.assetId, {
        path: file("assets", a.id, a.ext),
        duration: a.duration || 5,
        kind: a.kind === "image" ? "image" : "video",
      });
    }
  }

  const plan = buildBakePlan(g, sources, opts);
  if (!plan.filterComplex) throw Error("Nothing to bake");

  const id = uuid();
  const target = file("assets", id, "mp4");
  try {
    await run(
      bin.ffmpeg,
      [
        "-y",
        ...plan.inputArgs,
        "-filter_complex",
        plan.filterComplex,
        "-map",
        `[${plan.mapLabel}]`,
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-t",
        String(plan.duration),
        "-movflags",
        "+faststart",
        target,
      ],
      signal,
    );
    const stat = await fs.stat(target);
    const a: Asset = {
      id,
      name: `Comp bake · ${g.name}`.slice(0, 180),
      description: `Compositing bake (${plan.duration}s ${plan.width}x${plan.height})`,
      folder: "",
      tags: ["compositing", "bake"],
      favorite: false,
      kind: "video",
      duration: plan.duration,
      ext: "mp4",
      audio: false,
      bytes: stat.size,
      usedBy: [],
      collections: [],
    };
    await fs.writeFile(file("assets", id, "json"), JSON.stringify(a));
    return { ...a, steps: plan.steps };
  } catch (e) {
    await fs.rm(target, { force: true });
    throw e;
  }
}

function graphsPath() {
  return path.join(workspaceRoot(), "comp-graphs.json");
}

export async function listGraphs(): Promise<CompGraph[]> {
  try {
    const raw = JSON.parse(await fs.readFile(graphsPath(), "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw.map((g) => validateGraph(g)).slice(0, 32);
  } catch {
    return [];
  }
}

export async function saveGraph(graph: CompGraph) {
  const g = validateGraph(graph);
  const rows = await listGraphs();
  const next = [g, ...rows.filter((r) => r.id !== g.id)].slice(0, 32);
  const tmp = graphsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(next, null, 2));
    await fs.rename(tmp, graphsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return g;
}

export async function deleteGraph(id: string) {
  const rows = (await listGraphs()).filter((g) => g.id !== id);
  const tmp = graphsPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
    await fs.rename(tmp, graphsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return { ok: true as const };
}
