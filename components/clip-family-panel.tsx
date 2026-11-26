"use client";
import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import type { Project } from "@/lib/types";
import { buildClipFamily, childrenOf, type FamilyTree } from "@/lib/clip-family";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

function Node({
  tree,
  id,
  depth,
  onOpen,
}: {
  tree: FamilyTree;
  id: string;
  depth: number;
  onOpen?: (clipId: string) => void;
}) {
  const node = tree.nodes.find((n) => n.id === id);
  if (!node) return null;
  const kids = childrenOf(tree, id);
  return (
    <li style={{ marginLeft: depth * 14 }}>
      <div className="bin-row">
        <GitBranch size={14} />
        <strong>{node.label}</strong>
        <Badge variant="outline">{node.kind}</Badge>
        {node.meta && <small className="muted">{node.meta}</small>}
        {node.clipId && onOpen && (
          <Button size="sm" variant="ghost" onClick={() => onOpen(node.clipId!)}>
            Open
          </Button>
        )}
      </div>
      {!!kids.length && (
        <ul>
          {kids.map((k) => (
            <Node
              key={k.id}
              tree={tree}
              id={k.id}
              depth={depth + 1}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ClipFamilyPanel({
  project,
  onOpenClip,
}: {
  project: Project;
  onOpenClip?: (clipId: string) => void;
}) {
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Prefer local build for instant UI; refresh from API for consistency
    setTree(buildClipFamily(project));
    fetch("/api/clip-family?project=" + project.id)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Could not load family tree");
        setTree(data);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load family tree"),
      );
  }, [project]);

  if (!tree) return <p className="empty">Building lineage…</p>;
  const root = tree.nodes.find((n) => n.kind === "source");

  return (
    <div className="clip-family">
      <header className="panel-head">
        <div>
          <h2>Clip Family Tree</h2>
          <p>
            Provenance from source → highlights → edits → exports. Media files
            are not duplicated.
          </p>
        </div>
        <Badge variant="outline">{tree.nodes.length} nodes</Badge>
      </header>
      {error && <p className="error">{error}</p>}
      <ul className="bin-tree">
        {root ? (
          <Node
            tree={tree}
            id={root.id}
            depth={0}
            onOpen={onOpenClip}
          />
        ) : (
          <li className="empty">No lineage yet.</li>
        )}
      </ul>
    </div>
  );
}
