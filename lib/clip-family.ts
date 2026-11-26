import type { Clip, Project } from "./types";

export type FamilyNodeKind =
  | "source"
  | "highlight"
  | "clip"
  | "edit"
  | "alternate"
  | "language"
  | "branded"
  | "export"
  | "thumbnail"
  | "package";

export type FamilyNode = {
  id: string;
  kind: FamilyNodeKind;
  label: string;
  parentId?: string;
  clipId?: string;
  meta?: string;
};

export type FamilyTree = {
  version: 1;
  projectId: string;
  nodes: FamilyNode[];
  edges: { from: string; to: string }[];
};

/** Build a navigable lineage graph from project clips without duplicating media. */
export function buildClipFamily(project: Project): FamilyTree {
  const nodes: FamilyNode[] = [
    {
      id: "source:" + project.id,
      kind: "source",
      label: project.title || "Source",
      meta: project.duration
        ? `${Math.round(project.duration)}s source`
        : "source",
    },
  ];
  const edges: FamilyTree["edges"] = [];
  const byEditorial = new Map<string, Clip[]>();
  const byFamily = new Map<string, Clip[]>();

  for (const clip of project.clips) {
    const editorial = clip.editorialId || clip.id;
    const family = clip.familyId || editorial;
    if (!byEditorial.has(editorial)) byEditorial.set(editorial, []);
    byEditorial.get(editorial)!.push(clip);
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family)!.push(clip);
  }

  for (const [editorial, clips] of byEditorial) {
    const highlightId = "highlight:" + editorial;
    const primary = clips[0];
    nodes.push({
      id: highlightId,
      kind: "highlight",
      label: primary.title || "Highlight",
      parentId: "source:" + project.id,
      clipId: primary.id,
      meta: `${primary.start.toFixed(1)}–${primary.end.toFixed(1)}s`,
    });
    edges.push({ from: "source:" + project.id, to: highlightId });

    for (const clip of clips) {
      const clipNode = "clip:" + clip.id;
      const isAlt = clip.editorialId && clip.editorialId !== clip.id;
      nodes.push({
        id: clipNode,
        kind: isAlt ? "alternate" : "clip",
        label: clip.title,
        parentId: highlightId,
        clipId: clip.id,
        meta: clip.settings.ratio + " · " + clip.settings.layout,
      });
      edges.push({ from: highlightId, to: clipNode });

      if (clip.settings.overlayText || clip.settings.backgroundAsset) {
        const branded = "branded:" + clip.id;
        nodes.push({
          id: branded,
          kind: "branded",
          label: "Branded variation",
          parentId: clipNode,
          clipId: clip.id,
        });
        edges.push({ from: clipNode, to: branded });
      }

      if (clip.qa) {
        const exp = "export:" + clip.id;
        nodes.push({
          id: exp,
          kind: "export",
          label: "Export",
          parentId: clipNode,
          clipId: clip.id,
          meta: clip.qa.warnings?.length
            ? `${clip.qa.warnings.length} QA warning(s)`
            : "export checked",
        });
        edges.push({ from: clipNode, to: exp });
      }
    }
  }

  // Link familyId siblings under a shared family hub when present
  for (const [familyId, clips] of byFamily) {
    if (clips.length < 2) continue;
    if (clips.every((c) => (c.editorialId || c.id) === familyId)) continue;
    const hub = "family:" + familyId;
    if (nodes.some((n) => n.id === hub)) continue;
    nodes.push({
      id: hub,
      kind: "edit",
      label: "Clip family",
      parentId: "source:" + project.id,
      meta: `${clips.length} related cuts`,
    });
    edges.push({ from: "source:" + project.id, to: hub });
    for (const clip of clips) {
      edges.push({ from: hub, to: "clip:" + clip.id });
    }
  }

  return {
    version: 1,
    projectId: project.id,
    nodes,
    edges,
  };
}

export function familyRoots(tree: FamilyTree) {
  const children = new Set(tree.edges.map((e) => e.to));
  return tree.nodes.filter((n) => !children.has(n.id));
}

export function childrenOf(tree: FamilyTree, id: string) {
  const ids = tree.edges.filter((e) => e.from === id).map((e) => e.to);
  return tree.nodes.filter((n) => ids.includes(n.id));
}
