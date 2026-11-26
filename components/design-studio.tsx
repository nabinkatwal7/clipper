"use client";
import { useEffect, useRef, useState } from "react";
import {
  Palette,
  Plus,
  Save,
  Download,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  AlignCenter,
  AlignLeft,
  AlignRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Layer = {
  id: string;
  type: "text" | "rect" | "ellipse" | "image";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  rotation?: number;
  shadow?: { blur: number; color: string; ox: number; oy: number };
  gradientTo?: string;
};

type AlignMode =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

function alignLayerLocal(layer: Layer, mode: AlignMode): Layer {
  const next = { ...layer };
  switch (mode) {
    case "left":
      next.x = 0;
      break;
    case "center-x":
      next.x = Math.max(0, (1 - layer.w) / 2);
      break;
    case "right":
      next.x = Math.max(0, 1 - layer.w);
      break;
    case "top":
      next.y = 0;
      break;
    case "center-y":
      next.y = Math.max(0, (1 - layer.h) / 2);
      break;
    case "bottom":
      next.y = Math.max(0, 1 - layer.h);
      break;
  }
  return next;
}

type Artboard = {
  version: 1;
  id: string;
  name: string;
  format: string;
  width: number;
  height: number;
  layers: Layer[];
  parentId?: string;
  pageIndex?: number;
};

type DesignDocument = {
  version: 1;
  id: string;
  name: string;
  format: string;
  pages: Artboard[];
};

type Format = { id: string; label: string; width: number; height: number };

function paintBoard(
  ctx: CanvasRenderingContext2D,
  board: Artboard,
  w: number,
  h: number,
  selected?: string | null,
) {
  ctx.clearRect(0, 0, w, h);
  const sx = w / board.width;
  const sy = h / board.height;
  for (const layer of board.layers) {
    if (layer.visible === false) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    const x = layer.x * w;
    const y = layer.y * h;
    const lw = layer.w * w;
    const lh = layer.h * h;
    const cx = x + lw / 2;
    const cy = y + lh / 2;
    ctx.translate(cx, cy);
    ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);
    ctx.translate(-cx, -cy);
    if (layer.shadow) {
      ctx.shadowBlur = layer.shadow.blur * Math.min(sx, sy);
      ctx.shadowColor = layer.shadow.color;
      ctx.shadowOffsetX = layer.shadow.ox * w;
      ctx.shadowOffsetY = layer.shadow.oy * h;
    }
    if (layer.type === "rect") {
      if (layer.gradientTo) {
        const g = ctx.createLinearGradient(x, y, x, y + lh);
        g.addColorStop(0, layer.color || "#111");
        g.addColorStop(1, layer.gradientTo);
        ctx.fillStyle = g;
      } else ctx.fillStyle = layer.color || "#111";
      ctx.fillRect(x, y, lw, lh);
    } else if (layer.type === "ellipse") {
      ctx.fillStyle = layer.color || "#14b8a6";
      ctx.beginPath();
      ctx.ellipse(x + lw / 2, y + lh / 2, lw / 2, lh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (layer.type === "text") {
      ctx.fillStyle = layer.color || "#fff";
      const weight = layer.fontWeight || 700;
      ctx.font = `${weight} ${Math.max(12, (layer.fontSize || 48) * Math.min(sx, sy))}px ui-sans-serif, system-ui`;
      ctx.textBaseline = "top";
      ctx.fillText(layer.text || layer.name, x, y, lw);
    }
    ctx.shadowBlur = 0;
    if (selected === layer.id) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#14b8a6";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, lw, lh);
    }
    ctx.restore();
  }
}

function hitTest(board: Artboard, nx: number, ny: number): string | null {
  for (let i = board.layers.length - 1; i >= 0; i--) {
    const l = board.layers[i];
    if (l.visible === false || l.locked) continue;
    if (nx >= l.x && nx <= l.x + l.w && ny >= l.y && ny <= l.y + l.h)
      return l.id;
  }
  return null;
}

export function DesignStudio() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [doc, setDoc] = useState<DesignDocument | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [bulkCsv, setBulkCsv] = useState(
    "title,creator\nClutch Play,Alex\nBoss Fight,Sam",
  );
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const board = doc?.pages[page] || null;

  useEffect(() => {
    fetch("/api/design-studio")
      .then((r) => r.json())
      .then((data) => {
        setFormats(data.formats || []);
        if (data.documents?.[0]) {
          setDoc(data.documents[0]);
        } else {
          const b = data.boards?.[0] || data.default;
          setDoc({
            version: 1,
            id: crypto.randomUUID(),
            name: b.name || "Untitled",
            format: b.format,
            pages: [b],
          });
        }
      })
      .catch(() => setError("Could not load designs"));
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !board) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(720 / board.width, 420 / board.height);
    c.width = Math.round(board.width * scale);
    c.height = Math.round(board.height * scale);
    paintBoard(ctx, board, c.width, c.height, selected);
  }, [board, selected, page]);

  function patchDoc(next: DesignDocument) {
    setDoc(next);
  }

  function patchPage(updater: (p: Artboard) => Artboard) {
    if (!doc || !board) return;
    const pages = doc.pages.map((p, i) => (i === page ? updater(p) : p));
    patchDoc({ ...doc, pages });
  }

  async function create(format: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/design-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create-doc", format }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Create failed");
      setDoc(data);
      setPage(0);
      setSelected(data.pages?.[0]?.layers?.[1]?.id || null);
      setMsg("New multi-page design");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!doc) return;
    setBusy(true);
    try {
      const r = await fetch("/api/design-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "save-doc", document: doc }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Save failed");
      setDoc(data);
      setMsg("Design document saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportImage(
    mime: "image/png" | "image/jpeg" | "image/webp",
    transparent = false,
  ) {
    if (!board) return;
    setBusy(true);
    setError("");
    try {
      const off = document.createElement("canvas");
      off.width = board.width;
      off.height = board.height;
      const ctx = off.getContext("2d");
      if (!ctx) throw Error("Canvas unavailable");
      if (!transparent || mime !== "image/png") {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, off.width, off.height);
      }
      paintBoard(ctx, board, off.width, off.height, null);
      const blob = await new Promise<Blob | null>((resolve) =>
        off.toBlob(resolve, mime, mime === "image/png" ? undefined : 0.92),
      );
      if (!blob) throw Error("Encode failed");
      const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
      const r = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-file-name": encodeURIComponent(
            `${board.name.replace(/\s+/g, "-").slice(0, 40)}.${ext}`,
          ),
        },
        body: blob,
      });
      const asset = await r.json();
      if (!r.ok) throw Error(asset.error || "Upload failed");
      setMsg(`Exported ${ext.toUpperCase()} asset ${String(asset.id).slice(0, 8)}…`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function bulk() {
    if (!board) return;
    setBusy(true);
    setError("");
    try {
      const lines = bulkCsv.trim().split(/\r?\n/);
      const headers = lines[0]?.split(",").map((h) => h.trim()) || [];
      const rows = lines
        .slice(1)
        .filter(Boolean)
        .map((line) => {
          const cols = line.split(",");
          const row: Record<string, string> = {};
          headers.forEach((h, i) => {
            row[h] = (cols[i] || "").trim();
          });
          return row;
        });
      const r = await fetch("/api/design-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "bulk", template: board, rows }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Bulk failed");
      setMsg(`Generated ${data.length} designs from CSV`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk failed");
    } finally {
      setBusy(false);
    }
  }

  function patchLayer(id: string, patch: Partial<Layer>) {
    if (!board) return;
    const layer = board.layers.find((l) => l.id === id);
    if (layer?.locked && !("locked" in patch) && !("visible" in patch)) return;
    patchPage((p) => ({
      ...p,
      layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function addLayer(type: Layer["type"]) {
    if (!board) return;
    const id = crypto.randomUUID();
    const layer: Layer = {
      id,
      type,
      name: type === "text" ? "Text" : type === "ellipse" ? "Ellipse" : "Shape",
      x: 0.2,
      y: 0.2,
      w: type === "text" ? 0.6 : 0.3,
      h: type === "text" ? 0.15 : 0.2,
      text: type === "text" ? "{{title}}" : undefined,
      color: type === "text" ? "#ffffff" : "#14b8a6",
      fontSize: 48,
      fontWeight: 700,
      opacity: 1,
      visible: true,
      locked: false,
      rotation: 0,
      shadow:
        type === "text"
          ? { blur: 12, color: "#00000099", ox: 0, oy: 0.008 }
          : undefined,
    };
    patchPage((p) => ({
      ...p,
      layers: [...p.layers, layer].slice(0, 48),
    }));
    setSelected(id);
  }

  function moveLayer(dir: "up" | "down") {
    if (!board || !selected) return;
    const layers = [...board.layers];
    const i = layers.findIndex((l) => l.id === selected);
    const j = dir === "up" ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j], layers[i]];
    patchPage((p) => ({ ...p, layers }));
  }

  function doAlign(mode: AlignMode) {
    if (!board || !selected) return;
    patchPage((p) => ({
      ...p,
      layers: p.layers.map((l) =>
        l.id === selected ? alignLayerLocal(l, mode) : l,
      ),
    }));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!board || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const id = hitTest(board, nx, ny);
    if (!id) return;
    const layer = board.layers.find((l) => l.id === id)!;
    setSelected(id);
    drag.current = { id, ox: nx - layer.x, oy: ny - layer.y };
    canvas.current.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !board || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const x = Math.min(1 - 0.02, Math.max(0, nx - drag.current.ox));
    const y = Math.min(1 - 0.02, Math.max(0, ny - drag.current.oy));
    patchLayer(drag.current.id, { x, y });
  }

  function onPointerUp() {
    drag.current = null;
  }

  function addDocPage() {
    if (!doc || !board) return;
    if (doc.pages.length >= 12) {
      setError("At most 12 pages");
      return;
    }
    const pageBoard: Artboard = {
      ...structuredClone(board),
      id: crypto.randomUUID(),
      name: `Page ${doc.pages.length + 1}`,
      layers: board.layers.map((l) => ({ ...l, id: crypto.randomUUID() })),
      pageIndex: doc.pages.length,
      parentId: doc.id,
    };
    setDoc({ ...doc, pages: [...doc.pages, pageBoard] });
    setPage(doc.pages.length);
  }

  const layer = board?.layers.find((l) => l.id === selected);

  return (
    <div className="design-studio">
      <header className="panel-head">
        <div>
          <h2>Design Studio</h2>
          <p>
            Multi-page artboards with drag, align, shadows, rotation, and
            PNG/JPEG/WebP export — closer to Canva workflows, still local-only.
          </p>
        </div>
        <Badge variant="outline">
          <Palette size={12} /> Closer parity
        </Badge>
      </header>

      <div className="reel-grid">
        <label>
          Format
          <select
            value={doc?.format || "youtube-thumb"}
            onChange={(e) => void create(e.target.value)}
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} ({f.width}×{f.height})
              </option>
            ))}
          </select>
        </label>
        <div className="bar-tools">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void create("youtube-thumb")}
          >
            <Plus size={14} /> New doc
          </Button>
          <Button disabled={busy || !doc} onClick={() => void save()}>
            <Save size={14} /> Save
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !board}
            onClick={() => void exportImage("image/png")}
          >
            <Download size={14} /> PNG
          </Button>
          <Button
            variant="outline"
            disabled={busy || !board}
            onClick={() => void exportImage("image/png", true)}
          >
            Transparent
          </Button>
          <Button
            variant="outline"
            disabled={busy || !board}
            onClick={() => void exportImage("image/jpeg")}
          >
            JPEG
          </Button>
          <Button
            variant="outline"
            disabled={busy || !board}
            onClick={() => void exportImage("image/webp")}
          >
            WebP
          </Button>
        </div>
      </div>

      {doc && board && (
        <>
          <div className="bar-tools">
            {doc.pages.map((p, i) => (
              <Button
                key={p.id}
                size="sm"
                variant={i === page ? "default" : "outline"}
                onClick={() => setPage(i)}
              >
                {p.name || `Page ${i + 1}`}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={addDocPage}>
              <Plus size={14} /> Page
            </Button>
          </div>

          <label>
            Document name
            <Input
              value={doc.name}
              onChange={(e) =>
                setDoc({ ...doc, name: e.target.value.slice(0, 80) })
              }
            />
          </label>

          <canvas
            ref={canvas}
            className="design-canvas"
            aria-label="Artboard"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />

          <div className="bar-tools">
            <Button size="sm" variant="outline" onClick={() => addLayer("text")}>
              + Text
            </Button>
            <Button size="sm" variant="outline" onClick={() => addLayer("rect")}>
              + Rect
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addLayer("ellipse")}
            >
              + Ellipse
            </Button>
            <Button size="sm" variant="ghost" disabled={!selected} onClick={() => moveLayer("up")}>
              <ArrowUp size={14} />
            </Button>
            <Button size="sm" variant="ghost" disabled={!selected} onClick={() => moveLayer("down")}>
              <ArrowDown size={14} />
            </Button>
            <Button size="sm" variant="outline" disabled={!selected} onClick={() => doAlign("left")}>
              <AlignLeft size={14} />
            </Button>
            <Button size="sm" variant="outline" disabled={!selected} onClick={() => doAlign("center-x")}>
              <AlignCenter size={14} />
            </Button>
            <Button size="sm" variant="outline" disabled={!selected} onClick={() => doAlign("right")}>
              <AlignRight size={14} />
            </Button>
            <Button size="sm" variant="outline" disabled={!selected} onClick={() => doAlign("center-y")}>
              Middle
            </Button>
          </div>

          <div className="design-layout">
            <ul className="design-layers">
              {[...board.layers].reverse().map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={selected === l.id ? "current" : ""}
                    onClick={() => setSelected(l.id)}
                  >
                    {l.name}
                    <small>
                      {l.type}
                      {l.visible === false ? " · hidden" : ""}
                      {l.locked ? " · locked" : ""}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            <div className="design-inspector">
              {!layer ? (
                <p className="muted">Select or drag a layer</p>
              ) : (
                <>
                  {layer.type === "text" && (
                    <>
                      <label>
                        Text ({`{{title}}`} tokens)
                        <Input
                          value={layer.text || ""}
                          onChange={(e) =>
                            patchLayer(layer.id, {
                              text: e.target.value.slice(0, 200),
                            })
                          }
                        />
                      </label>
                      <label>
                        Font size
                        <Input
                          type="number"
                          min={8}
                          max={200}
                          value={layer.fontSize || 48}
                          onChange={(e) =>
                            patchLayer(layer.id, {
                              fontSize: Number(e.target.value) || 48,
                            })
                          }
                        />
                      </label>
                      <label>
                        Weight
                        <Input
                          type="number"
                          min={100}
                          max={900}
                          step={100}
                          value={layer.fontWeight || 700}
                          onChange={(e) =>
                            patchLayer(layer.id, {
                              fontWeight: Number(e.target.value) || 700,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Color
                    <Input
                      type="color"
                      value={(layer.color || "#ffffff").slice(0, 7)}
                      onChange={(e) =>
                        patchLayer(layer.id, { color: e.target.value })
                      }
                    />
                  </label>
                  {layer.type === "rect" && (
                    <label>
                      Gradient to
                      <Input
                        type="color"
                        value={(layer.gradientTo || layer.color || "#134e4a").slice(0, 7)}
                        onChange={(e) =>
                          patchLayer(layer.id, { gradientTo: e.target.value })
                        }
                      />
                    </label>
                  )}
                  <label>
                    Rotation °
                    <Input
                      type="number"
                      min={-180}
                      max={180}
                      value={layer.rotation || 0}
                      onChange={(e) =>
                        patchLayer(layer.id, {
                          rotation: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    Opacity
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={layer.opacity ?? 1}
                      onChange={(e) =>
                        patchLayer(layer.id, {
                          opacity: Math.min(
                            1,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Shadow blur
                    <Input
                      type="number"
                      min={0}
                      max={80}
                      value={layer.shadow?.blur ?? 0}
                      onChange={(e) =>
                        patchLayer(layer.id, {
                          shadow: {
                            blur: Number(e.target.value) || 0,
                            color: layer.shadow?.color || "#00000099",
                            ox: layer.shadow?.ox || 0,
                            oy: layer.shadow?.oy || 0.01,
                          },
                        })
                      }
                    />
                  </label>
                  <div className="bar-tools">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        patchLayer(layer.id, {
                          visible: layer.visible === false,
                        })
                      }
                    >
                      {layer.visible === false ? (
                        <Eye size={14} />
                      ) : (
                        <EyeOff size={14} />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        patchLayer(layer.id, { locked: !layer.locked })
                      }
                    >
                      {layer.locked ? "Unlock" : "Lock"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <fieldset>
            <legend>Bulk from CSV (max 20)</legend>
            <textarea
              className="ai-lab-area"
              rows={4}
              value={bulkCsv}
              onChange={(e) => setBulkCsv(e.target.value)}
            />
            <Button disabled={busy || !board} onClick={() => void bulk()}>
              Generate designs
            </Button>
          </fieldset>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
