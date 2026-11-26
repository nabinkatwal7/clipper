import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workspaceRoot } from "./store";

export type BinItemRef = {
  kind: "project" | "clip" | "asset";
  id: string;
  projectId?: string;
};

export type ProjectBin = {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  smart?: {
    kind: "unused" | "favorites" | "video" | "audio" | "image" | "tag";
    tag?: string;
  };
  items: BinItemRef[];
  createdAt: string;
  updatedAt: string;
};

export type BinTree = {
  version: 1;
  bins: ProjectBin[];
};

function binsPath() {
  return path.join(workspaceRoot(), "project-bins.json");
}

export function emptyBinTree(): BinTree {
  return { version: 1, bins: [] };
}

export function validateBinTree(input: unknown): BinTree {
  if (!input || typeof input !== "object") return emptyBinTree();
  const doc = input as BinTree;
  if (doc.version !== 1 || !Array.isArray(doc.bins) || doc.bins.length > 200)
    throw Error("Unsupported bin tree");
  const ids = new Set<string>();
  for (const b of doc.bins) {
    if (
      !b ||
      typeof b.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(b.id) ||
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 80 ||
      (b.parentId && !/^[0-9a-f-]{36}$/i.test(b.parentId)) ||
      (b.color && !/^#[0-9a-f]{6}$/i.test(b.color)) ||
      !Array.isArray(b.items) ||
      b.items.length > 500
    )
      throw Error("Invalid bin");
    if (ids.has(b.id)) throw Error("Duplicate bin id");
    ids.add(b.id);
    for (const item of b.items) {
      if (
        !item ||
        !["project", "clip", "asset"].includes(item.kind) ||
        typeof item.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(item.id)
      )
        throw Error("Invalid bin item");
    }
    if (b.smart) {
      if (
        !["unused", "favorites", "video", "audio", "image", "tag"].includes(
          b.smart.kind,
        )
      )
        throw Error("Invalid smart bin");
      if (
        b.smart.kind === "tag" &&
        (typeof b.smart.tag !== "string" || !b.smart.tag.trim())
      )
        throw Error("Smart tag bin needs a tag");
    }
  }
  // Cycle check on parent chain
  for (const b of doc.bins) {
    let cursor = b.parentId,
      guard = 0;
    while (cursor) {
      if (cursor === b.id) throw Error("Cyclic bin hierarchy");
      cursor = doc.bins.find((x) => x.id === cursor)?.parentId;
      if (++guard > doc.bins.length) throw Error("Cyclic bin hierarchy");
    }
  }
  return {
    version: 1,
    bins: doc.bins.map((b) => ({
      ...b,
      name: b.name.trim(),
      items: b.items.slice(0, 500),
    })),
  };
}

export async function readBins(): Promise<BinTree> {
  try {
    return validateBinTree(
      JSON.parse(await fs.readFile(binsPath(), "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyBinTree();
    throw e;
  }
}

export async function writeBins(tree: BinTree) {
  const doc = validateBinTree(tree);
  const tmp = binsPath() + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(doc, null, 2));
    await fs.rename(tmp, binsPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return doc;
}

export function createBin(
  tree: BinTree,
  name: string,
  parentId?: string,
  smart?: ProjectBin["smart"],
): BinTree {
  const now = new Date().toISOString();
  const bin: ProjectBin = {
    id: randomUUID(),
    name: name.trim().slice(0, 80) || "Bin",
    parentId,
    smart,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  return validateBinTree({ version: 1, bins: [...tree.bins, bin] });
}

export function childrenOf(tree: BinTree, parentId?: string) {
  return tree.bins.filter((b) => (b.parentId || undefined) === parentId);
}
