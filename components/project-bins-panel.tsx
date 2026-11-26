"use client";
import { useEffect, useState, type ReactNode } from "react";
import { FolderPlus, Folder, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Bin = {
  id: string;
  name: string;
  parentId?: string;
  smart?: { kind: string; tag?: string };
  items: { kind: string; id: string }[];
};

type Tree = { version: 1; bins: Bin[] };

export function ProjectBinsPanel() {
  const [tree, setTree] = useState<Tree>({ version: 1, bins: [] });
  const [name, setName] = useState("Unused footage");
  const [parentId, setParentId] = useState("");
  const [smart, setSmart] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/project-bins");
    const data = await r.json();
    setTree(data);
  }

  useEffect(() => {
    void load().catch(() => setError("Could not load bins"));
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/project-bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "create",
          name,
          parentId: parentId || undefined,
          smart: smart
            ? {
                kind: smart,
                tag: smart === "tag" ? name : undefined,
              }
            : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Create failed");
      setTree(data);
      setName("New bin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const next = {
      version: 1 as const,
      bins: tree.bins.filter((b) => b.id !== id && b.parentId !== id),
    };
    setBusy(true);
    try {
      const r = await fetch("/api/project-bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree: next }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Delete failed");
      setTree(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const roots = tree.bins.filter((b) => !b.parentId);

  function renderBranch(parent?: string, depth = 0): ReactNode {
    return tree.bins
      .filter((b) => (b.parentId || undefined) === parent)
      .map((b) => (
        <li key={b.id} style={{ marginLeft: depth * 14 }}>
          <div className="bin-row">
            <Folder size={14} />
            <strong>{b.name}</strong>
            {b.smart && <Badge variant="secondary">smart:{b.smart.kind}</Badge>}
            <Badge variant="outline">{b.items.length}</Badge>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label="Delete bin"
              onClick={() => void remove(b.id)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <ul>{renderBranch(b.id, depth + 1)}</ul>
        </li>
      ));
  }

  return (
    <div className="project-bins">
      <header className="panel-head">
        <div>
          <h2>Project bins</h2>
          <p>
            Hierarchical media organization with optional smart bins. Drag assets
            into studios from the asset library; bins store references only.
          </p>
        </div>
      </header>
      <div className="instant-add">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bin name"
        />
        <select
          aria-label="Parent bin"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">Top level</option>
          {tree.bins.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Smart bin type"
          value={smart}
          onChange={(e) => setSmart(e.target.value)}
        >
          <option value="">Manual bin</option>
          <option value="unused">Unused</option>
          <option value="favorites">Favorites</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="image">Image</option>
          <option value="tag">Tag</option>
        </select>
        <Button size="sm" disabled={busy || !name.trim()} onClick={() => void create()}>
          <FolderPlus size={14} /> Create
        </Button>
      </div>
      <ul className="bin-tree">{renderBranch()}</ul>
      {!roots.length && <p className="empty">No bins yet.</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
