"use client";
import { useEffect, useMemo, useState } from "react";
import {
  GitBranch,
  Plus,
  Save,
  Trash2,
  Play,
  Link2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

type Port = {
  id: string;
  label: string;
  type: string;
  dir: "in" | "out";
};

type Node = {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  assetId?: string;
  color?: string;
  keyColor?: string;
  blur?: number;
  amount?: number;
  hue?: number;
  flip?: "h" | "v" | "both";
  crop?: { x: number; y: number; w: number; h: number };
  ports: Port[];
};

type Edge = {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
};

type Graph = {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  nodes: Node[];
  edges: Edge[];
};

type CatalogItem = { kind: string; label: string; group: string };

type Asset = { id: string; name: string; kind: string };

export function CompositingStudio() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<{
    node: string;
    port: string;
  } | null>(null);
  const [plan, setPlan] = useState<string[]>([]);
  const [bakeW, setBakeW] = useState(1280);
  const [bakeH, setBakeH] = useState(720);
  const [bakeDur, setBakeDur] = useState(5);
  const [bakeFps, setBakeFps] = useState(30);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedNode = graph?.nodes.find((n) => n.id === selected);

  useEffect(() => {
    Promise.all([
      fetch("/api/comp-graph").then((r) => r.json()),
      fetch("/api/assets").then((r) => r.json()),
    ])
      .then(([data, a]) => {
        setCatalog(data.catalog || []);
        const g = data.graphs?.[0] || data.default;
        setGraph(g);
        setAssets(Array.isArray(a) ? a : []);
      })
      .catch(() => setError("Could not load compositing graphs"));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of catalog) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  async function addNode(kind: string) {
    if (!graph) return;
    setError("");
    try {
      const r = await fetch("/api/comp-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "create-node",
          kind,
          x: 60 + graph.nodes.length * 24,
          y: 80 + (graph.nodes.length % 4) * 70,
        }),
      });
      const node = await r.json();
      if (!r.ok) throw Error(node.error || "Could not create node");
      setGraph({ ...graph, nodes: [...graph.nodes, node] });
      setSelected(node.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  function patchNode(id: string, patch: Partial<Node>) {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  }

  function removeNode(id: string) {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.filter((n) => n.id !== id),
      edges: graph.edges.filter((e) => e.from !== id && e.to !== id),
    });
    if (selected === id) setSelected(null);
  }

  function portClick(nodeId: string, port: Port) {
    if (!graph) return;
    if (port.dir === "out") {
      setLinkFrom({ node: nodeId, port: port.id });
      setMsg(`Linking from ${port.label}… click an input`);
      return;
    }
    if (!linkFrom) {
      setError("Select an output port first");
      return;
    }
    if (linkFrom.node === nodeId) {
      setError("Cannot connect a node to itself");
      return;
    }
    const edge: Edge = {
      id: crypto.randomUUID(),
      from: linkFrom.node,
      fromPort: linkFrom.port,
      to: nodeId,
      toPort: port.id,
    };
    setGraph({ ...graph, edges: [...graph.edges, edge] });
    setLinkFrom(null);
    setMsg("Connected");
    setError("");
  }

  async function save() {
    if (!graph) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/comp-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "save", graph }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Save failed");
      setGraph(data);
      setMsg("Graph saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function validateCompile() {
    if (!graph) return;
    setBusy(true);
    setError("");
    setPlan([]);
    try {
      const r = await fetch("/api/comp-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "compile", graph }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Invalid graph");
      setPlan(data.steps || []);
      setMsg(`Valid · ${data.steps?.length || 0} steps`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compile failed");
    } finally {
      setBusy(false);
    }
  }

  async function bake() {
    if (!graph) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/comp-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "bake",
          graph,
          width: bakeW,
          height: bakeH,
          duration: bakeDur,
          fps: bakeFps,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Bake failed");
      setPlan(data.steps || []);
      setMsg(
        `Baked asset ${String(data.id).slice(0, 8)}… (${data.duration}s · ${bakeW}×${bakeH} @ ${bakeFps}fps). Open Assets to use it.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bake failed");
    } finally {
      setBusy(false);
    }
  }

  function edgePath(e: Edge) {
    if (!graph) return "";
    const from = graph.nodes.find((n) => n.id === e.from);
    const to = graph.nodes.find((n) => n.id === e.to);
    if (!from || !to) return "";
    const x1 = from.x + 160;
    const y1 = from.y + 36;
    const x2 = to.x;
    const y2 = to.y + 36;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  return (
    <div className="compositing-studio">
      <header className="panel-head">
        <div>
          <h2>Compositing Studio</h2>
          <p>
            Closer to Fusion-style node compositing: brightness/contrast/hue/
            invert, full param inspectors, and bake size/duration/fps controls
            (60s cap, no audio).
          </p>
        </div>
        <Badge variant="outline">
          <GitBranch size={12} /> Closer parity
        </Badge>
      </header>

      {graph && (
        <>
          <div className="reel-grid">
            <label>
              Graph name
              <Input
                value={graph.name}
                onChange={(e) => setGraph({ ...graph, name: e.target.value })}
              />
            </label>
            <div className="bar-tools">
              <Button variant="secondary" disabled={busy} onClick={() => void save()}>
                <Save size={14} /> Save
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void validateCompile()}
              >
                <Play size={14} /> Validate
              </Button>
              <Button disabled={busy} onClick={() => void bake()}>
                <Play size={14} /> Bake to asset
              </Button>
            </div>
          </div>

          <div className="reel-grid">
            <label>
              Bake W
              <Input
                type="number"
                min={160}
                max={1920}
                step={2}
                value={bakeW}
                onChange={(e) => setBakeW(Number(e.target.value) || 1280)}
              />
            </label>
            <label>
              Bake H
              <Input
                type="number"
                min={90}
                max={1080}
                step={2}
                value={bakeH}
                onChange={(e) => setBakeH(Number(e.target.value) || 720)}
              />
            </label>
            <label>
              Duration (s)
              <Input
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                value={bakeDur}
                onChange={(e) =>
                  setBakeDur(Math.min(60, Math.max(0.5, Number(e.target.value) || 5)))
                }
              />
            </label>
            <label>
              FPS
              <Input
                type="number"
                min={12}
                max={60}
                value={bakeFps}
                onChange={(e) =>
                  setBakeFps(Math.min(60, Math.max(12, Number(e.target.value) || 30)))
                }
              />
            </label>
          </div>

          <div className="comp-layout">
            <aside className="comp-palette">
              <h3>Nodes</h3>
              {groups.map(([group, items]) => (
                <div key={group}>
                  <p className="muted">{group}</p>
                  <div className="comp-palette-list">
                    {items.map((item) => (
                      <Button
                        key={item.kind}
                        variant="outline"
                        onClick={() => void addNode(item.kind)}
                      >
                        <Plus size={12} /> {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </aside>

            <div className="comp-canvas-wrap">
              <svg className="comp-edges" aria-hidden>
                {graph.edges.map((e) => (
                  <path key={e.id} d={edgePath(e)} className="comp-edge" />
                ))}
              </svg>
              <div className="comp-canvas">
                {graph.nodes.map((n) => (
                  <div
                    key={n.id}
                    className={
                      "comp-node" + (selected === n.id ? " current" : "")
                    }
                    style={{ left: n.x, top: n.y }}
                    onClick={() => setSelected(n.id)}
                  >
                    <header>
                      <strong>{n.label}</strong>
                      <button
                        type="button"
                        aria-label="Delete node"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          removeNode(n.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </header>
                    <p className="muted">{n.kind}</p>
                    <div className="comp-ports">
                      {n.ports.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={"comp-port " + p.dir}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            portClick(n.id, p);
                          }}
                        >
                          {p.dir === "in" ? "●" : "○"} {p.label}
                          {linkFrom?.node === n.id &&
                            linkFrom.port === p.id && (
                              <Link2 size={10} />
                            )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="comp-inspector">
              <h3>Inspector</h3>
              {!selectedNode ? (
                <p className="muted">Select a node</p>
              ) : (
                <div className="comp-inspector-fields">
                  <label>
                    Label
                    <Input
                      value={selectedNode.label}
                      onChange={(e) =>
                        patchNode(selectedNode.id, { label: e.target.value })
                      }
                    />
                  </label>
                  {selectedNode.kind.startsWith("source.") &&
                    selectedNode.kind !== "source.solid" && (
                      <label>
                        Asset
                        <select
                          value={selectedNode.assetId || ""}
                          onChange={(e) =>
                            patchNode(selectedNode.id, {
                              assetId: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">Choose…</option>
                          {assets
                            .filter((a) =>
                              selectedNode.kind === "source.image"
                                ? a.kind === "image"
                                : a.kind === "video",
                            )
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  {selectedNode.kind === "source.solid" && (
                    <label>
                      Color
                      <Input
                        type="color"
                        value={selectedNode.color || "#1e293b"}
                        onChange={(e) =>
                          patchNode(selectedNode.id, { color: e.target.value })
                        }
                      />
                    </label>
                  )}
                  {(selectedNode.kind === "comp.chroma" ||
                    selectedNode.kind === "comp.luma") && (
                    <label>
                      Key color
                      <Input
                        type="color"
                        value={selectedNode.keyColor || "#00ff00"}
                        onChange={(e) =>
                          patchNode(selectedNode.id, {
                            keyColor: e.target.value,
                          })
                        }
                      />
                    </label>
                  )}
                  {selectedNode.kind === "effect.blur" && (
                    <label>
                      Blur σ
                      <Input
                        type="number"
                        min={0}
                        max={64}
                        value={selectedNode.blur ?? 8}
                        onChange={(e) =>
                          patchNode(selectedNode.id, {
                            blur: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                  )}
                  {(selectedNode.kind === "effect.sharpen" ||
                    selectedNode.kind === "effect.grain" ||
                    selectedNode.kind === "effect.glow" ||
                    selectedNode.kind === "effect.brightness" ||
                    selectedNode.kind === "effect.contrast" ||
                    selectedNode.kind === "comp.luma") && (
                    <label>
                      Amount
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={selectedNode.amount ?? 0.35}
                        onChange={(e) =>
                          patchNode(selectedNode.id, {
                            amount: Math.min(
                              1,
                              Math.max(0, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                  {selectedNode.kind === "effect.hue" && (
                    <label>
                      Hue °
                      <Input
                        type="number"
                        min={-180}
                        max={180}
                        value={selectedNode.hue ?? 30}
                        onChange={(e) =>
                          patchNode(selectedNode.id, {
                            hue: Math.min(
                              180,
                              Math.max(-180, Number(e.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                  {selectedNode.kind === "transform.flip" && (
                    <label>
                      Flip
                      <select
                        value={selectedNode.flip || "h"}
                        onChange={(e) =>
                          patchNode(selectedNode.id, {
                            flip: e.target.value as Node["flip"],
                          })
                        }
                      >
                        <option value="h">Horizontal</option>
                        <option value="v">Vertical</option>
                        <option value="both">Both</option>
                      </select>
                    </label>
                  )}
                  {selectedNode.kind === "transform.crop" && (
                    <>
                      {(["x", "y", "w", "h"] as const).map((key) => (
                        <label key={key}>
                          Crop {key}
                          <Input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={selectedNode.crop?.[key] ?? 0.1}
                            onChange={(e) =>
                              patchNode(selectedNode.id, {
                                crop: {
                                  x: selectedNode.crop?.x ?? 0.1,
                                  y: selectedNode.crop?.y ?? 0.1,
                                  w: selectedNode.crop?.w ?? 0.8,
                                  h: selectedNode.crop?.h ?? 0.8,
                                  [key]: Math.min(
                                    1,
                                    Math.max(0, Number(e.target.value) || 0),
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
              {!!plan.length && (
                <div className="comp-plan">
                  <h4>Compile plan</h4>
                  <ol>
                    {plan.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
