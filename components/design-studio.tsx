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
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  gradientTo?: string;
};

type Artboard = {
  version: 1;
  id: string;
  name: string;
  format: string;
  width: number;
  height: number;
  layers: Layer[];
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
      ctx.font = `700 ${Math.max(12, (layer.fontSize || 48) * Math.min(sx, sy))}px ui-sans-serif, system-ui`;
      ctx.textBaseline = "top";
      ctx.fillText(layer.text || layer.name, x, y, lw);
    }
    if (selected === layer.id) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#14b8a6";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, lw, lh);
    }
    ctx.restore();
  }
}

export function DesignStudio() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [board, setBoard] = useState<Artboard | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bulkCsv, setBulkCsv] = useState("title,creator\nClutch Play,Alex\nBoss Fight,Sam");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/design-studio")
      .then((r) => r.json())
      .then((data) => {
        setFormats(data.formats || []);
        setBoard(data.boards?.[0] || data.default);
      })
      .catch(() => setError("Could not load designs"));
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !board) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(640 / board.width, 360 / board.height);
    c.width = Math.round(board.width * scale);
    c.height = Math.round(board.height * scale);
    paintBoard(ctx, board, c.width, c.height, selected);
  }, [board, selected]);

  async function create(format: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/design-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create", format }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Create failed");
      setBoard(data);
      setSelected(data.layers?.[1]?.id || data.layers?.[0]?.id || null);
      setMsg("New artboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!board) return;
    setBusy(true);
    try {
      const r = await fetch("/api/design-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "save", board }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Save failed");
      setBoard(data);
      setMsg("Artboard saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportPng(transparent = false) {
    if (!board) return;
    setBusy(true);
    setError("");
    try {
      const off = document.createElement("canvas");
      off.width = board.width;
      off.height = board.height;
      const ctx = off.getContext("2d");
      if (!ctx) throw Error("Canvas unavailable");
      if (!transparent) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, off.width, off.height);
      }
      paintBoard(ctx, board, off.width, off.height, null);
      const blob = await new Promise<Blob | null>((resolve) =>
        off.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("PNG encode failed");
      const r = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-file-name": encodeURIComponent(
            `${board.name.replace(/\s+/g, "-").slice(0, 40)}.png`,
          ),
        },
        body: blob,
      });
      const asset = await r.json();
      if (!r.ok) throw Error(asset.error || "Upload failed");
      setMsg(`Exported PNG asset ${String(asset.id).slice(0, 8)}…`);
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
      const rows = lines.slice(1).filter(Boolean).map((line) => {
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
      if (data[0]) setBoard(data[0]);
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
    setBoard({
      ...board,
      layers: board.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
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
      opacity: 1,
      visible: true,
      locked: false,
    };
    setBoard({ ...board, layers: [...board.layers, layer].slice(0, 48) });
    setSelected(id);
  }

  function moveLayer(dir: "up" | "down") {
    if (!board || !selected) return;
    const layers = [...board.layers];
    const i = layers.findIndex((l) => l.id === selected);
    const j = dir === "up" ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j], layers[i]];
    setBoard({ ...board, layers });
  }

  const layer = board?.layers.find((l) => l.id === selected);

  return (
    <div className="design-studio">
      <header className="panel-head">
        <div>
          <h2>Design Studio</h2>
          <p>
            Artboards, gradients, bulk CSV variables, and PNG export into Assets.
            Not a full Canva replacement — local and lightweight.
          </p>
        </div>
        <Badge variant="outline">
          <Palette size={12} /> Partial
        </Badge>
      </header>

      <div className="reel-grid">
        <label>
          Format
          <select
            value={board?.format || "youtube-thumb"}
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
            <Plus size={14} /> New
          </Button>
          <Button disabled={busy || !board} onClick={() => void save()}>
            <Save size={14} /> Save
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !board}
            onClick={() => void exportPng(false)}
          >
            <Download size={14} /> Export PNG
          </Button>
          <Button
            variant="outline"
            disabled={busy || !board}
            onClick={() => void exportPng(true)}
          >
            Transparent PNG
          </Button>
        </div>
      </div>

      {board && (
        <>
          <label>
            Name
            <Input
              value={board.name}
              onChange={(e) =>
                setBoard({ ...board, name: e.target.value.slice(0, 80) })
              }
            />
          </label>
          <canvas ref={canvas} className="design-canvas" aria-label="Artboard" />
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
            <Button
              size="sm"
              variant="ghost"
              disabled={!selected}
              onClick={() => moveLayer("up")}
            >
              <ArrowUp size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!selected}
              onClick={() => moveLayer("down")}
            >
              <ArrowDown size={14} />
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
                <p className="muted">Select a layer</p>
              ) : (
                <>
                  {layer.type === "text" && (
                    <label>
                      Text (use {"{{title}}"} tokens)
                      <Input
                        value={layer.text || ""}
                        onChange={(e) =>
                          patchLayer(layer.id, {
                            text: e.target.value.slice(0, 200),
                          })
                        }
                      />
                    </label>
                  )}
                  <label>
                    Color
                    <Input
                      type="color"
                      value={layer.color || "#ffffff"}
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
                        value={layer.gradientTo || layer.color || "#134e4a"}
                        onChange={(e) =>
                          patchLayer(layer.id, { gradientTo: e.target.value })
                        }
                      />
                    </label>
                  )}
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
                      {layer.visible === false ? "Show" : "Hide"}
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
            <p className="muted">
              Template text can include {"{{title}}"}, {"{{creator}}"}, etc.
            </p>
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
