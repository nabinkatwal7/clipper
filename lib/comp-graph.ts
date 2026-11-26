import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot } from "./store";

export type PortType = "image" | "video" | "alpha" | "any";

export type CompNodeKind =
  | "source.video"
  | "source.image"
  | "source.solid"
  | "transform"
  | "effect.blur"
  | "effect.vignette"
  | "comp.merge"
  | "comp.chroma"
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
  /** Chroma key hex */
  keyColor?: string;
  blur?: number;
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

const KIND_PORTS: Record<CompNodeKind, CompPort[]> = {
  "source.video": [{ id: "out", label: "Video", type: "video", dir: "out" }],
  "source.image": [{ id: "out", label: "Image", type: "image", dir: "out" }],
  "source.solid": [{ id: "out", label: "Image", type: "image", dir: "out" }],
  transform: [
    { id: "in", label: "In", type: "any", dir: "in" },
    { id: "out", label: "Out", type: "any", dir: "out" },
  ],
  "effect.blur": [
    { id: "in", label: "In", type: "any", dir: "in" },
    { id: "out", label: "Out", type: "any", dir: "out" },
  ],
  "effect.vignette": [
    { id: "in", label: "In", type: "any", dir: "in" },
    { id: "out", label: "Out", type: "any", dir: "out" },
  ],
  "comp.merge": [
    { id: "base", label: "Base", type: "any", dir: "in" },
    { id: "over", label: "Over", type: "any", dir: "in" },
    { id: "out", label: "Out", type: "any", dir: "out" },
  ],
  "comp.chroma": [
    { id: "in", label: "In", type: "video", dir: "in" },
    { id: "out", label: "Out", type: "video", dir: "out" },
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
    { kind: "transform", label: "Transform", group: "Transform" },
    { kind: "effect.blur", label: "Blur", group: "Effects" },
    { kind: "effect.vignette", label: "Vignette", group: "Effects" },
    { kind: "comp.merge", label: "Merge", group: "Composite" },
    { kind: "comp.chroma", label: "Chroma key", group: "Composite" },
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
    keyColor: kind === "comp.chroma" ? "#00ff00" : undefined,
    blur: kind === "effect.blur" ? 8 : undefined,
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
      case "transform":
        steps.push("transform (position/scale/rotate)");
        break;
      case "effect.blur":
        steps.push(`gblur=sigma=${n.blur ?? 8}`);
        break;
      case "effect.vignette":
        steps.push("vignette");
        break;
      case "comp.merge":
        steps.push("overlay merge (base + over)");
        break;
      case "comp.chroma":
        steps.push(
          `chromakey=${n.keyColor || "#00ff00"}:similarity=0.2:blend=0.1`,
        );
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
