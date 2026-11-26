"use client";
import { useEffect, useRef, useState } from "react";
import { Palette, Plus, Save } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Layer = {
  id: string;
  type: "text" | "rect" | "image";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color?: string;
  fontSize?: number;
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

export function DesignStudio() {
  const [formats, setFormats] = useState<Format[]>([]);
  const [board, setBoard] = useState<Artboard | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
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
    ctx.clearRect(0, 0, c.width, c.height);
    for (const layer of board.layers) {
      const x = layer.x * c.width;
      const y = layer.y * c.height;
      const w = layer.w * c.width;
      const h = layer.h * c.height;
      if (layer.type === "rect") {
        ctx.fillStyle = layer.color || "#111";
        ctx.fillRect(x, y, w, h);
      } else if (layer.type === "text") {
        ctx.fillStyle = layer.color || "#fff";
        ctx.font = `700 ${Math.max(12, (layer.fontSize || 48) * scale * 0.55)}px ui-sans-serif, system-ui`;
        ctx.textBaseline = "top";
        ctx.fillText(layer.text || layer.name, x, y, w);
      }
      if (selected === layer.id) {
        ctx.strokeStyle = "#14b8a6";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }
    }
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

  const layer = board?.layers.find((l) => l.id === selected);

  return (
    <div className="design-studio">
      <header className="panel-head">
        <div>
          <h2>Design Studio</h2>
          <p>
            Lightweight artboards for thumbnails and covers. Layers stay local —
            not a full Canva replacement.
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
            defaultValue="youtube-thumb"
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
          <div className="design-layout">
            <ul className="design-layers">
              {board.layers.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={selected === l.id ? "current" : ""}
                    onClick={() => setSelected(l.id)}
                  >
                    {l.name}
                    <small>{l.type}</small>
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
                      Text
                      <Input
                        value={layer.text || ""}
                        onChange={(e) =>
                          setBoard({
                            ...board,
                            layers: board.layers.map((l) =>
                              l.id === layer.id
                                ? { ...l, text: e.target.value.slice(0, 200) }
                                : l,
                            ),
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
                        setBoard({
                          ...board,
                          layers: board.layers.map((l) =>
                            l.id === layer.id
                              ? { ...l, color: e.target.value }
                              : l,
                          ),
                        })
                      }
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
