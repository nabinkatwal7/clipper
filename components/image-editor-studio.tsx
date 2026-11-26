"use client";
import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Download,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Undo2,
  Redo2,
  Paintbrush,
  Eraser,
  SquareDashed,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  defaultAdjustments,
  defaultLevels,
  defaultTransform,
  applyPixelAdjustments,
  applyLevels,
  applyInSelection,
  stampBrush,
  historyPush,
  historyUndo,
  historyRedo,
  type ImageAdjustments,
  type ImageLevels,
  type ImageTransform,
  type ImageSelection,
  type EditorTool,
  type HistoryStack,
  type PixelBuffer,
} from "@/lib/image-editor";

type Asset = { id: string; name: string; kind: string; ext: string };

type Snapshot = {
  adj: ImageAdjustments;
  levels: ImageLevels;
  xf: ImageTransform;
  selection: ImageSelection;
  paint: PixelBuffer | null;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ImageEditorStudio() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [adj, setAdj] = useState<ImageAdjustments>({ ...defaultAdjustments });
  const [levels, setLevels] = useState<ImageLevels>({ ...defaultLevels });
  const [xf, setXf] = useState<ImageTransform>({ ...defaultTransform });
  const [selection, setSelection] = useState<ImageSelection>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [brushSize, setBrushSize] = useState(0.04);
  const [brushColor, setBrushColor] = useState("#14b8a6");
  const [brushOpacity, setBrushOpacity] = useState(0.85);
  const [paint, setPaint] = useState<PixelBuffer | null>(null);
  const [history, setHistory] = useState<HistoryStack<Snapshot> | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLImageElement | null>(null);
  const dragSel = useRef<{ x0: number; y0: number } | null>(null);
  const painting = useRef(false);

  function snapshot(): Snapshot {
    return {
      adj: { ...adj },
      levels: { ...levels },
      xf: { ...xf, crop: { ...xf.crop } },
      selection,
      paint: paint
        ? {
            width: paint.width,
            height: paint.height,
            data: new Uint8ClampedArray(paint.data),
          }
        : null,
    };
  }

  function applySnapshot(s: Snapshot) {
    setAdj(s.adj);
    setLevels(s.levels);
    setXf(s.xf);
    setSelection(s.selection);
    setPaint(s.paint);
  }

  function commitHistory() {
    const snap = snapshot();
    setHistory((h) =>
      h ? historyPush(h, snap) : { past: [], present: snap, future: [] },
    );
  }

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((rows: Asset[]) => {
        const images = (Array.isArray(rows) ? rows : []).filter(
          (a) => a.kind === "image",
        );
        setAssets(images);
        setAssetId(images[0]?.id || "");
      })
      .catch(() => setError("Could not load image assets"));
  }, []);

  useEffect(() => {
    if (!assetId) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      source.current = img;
      setPaint(null);
      setSelection(null);
      setAdj({ ...defaultAdjustments });
      setLevels({ ...defaultLevels });
      setXf({ ...defaultTransform });
      const snap: Snapshot = {
        adj: { ...defaultAdjustments },
        levels: { ...defaultLevels },
        xf: { ...defaultTransform },
        selection: null,
        paint: null,
      };
      setHistory({ past: [], present: snap, future: [] });
      redraw(snap);
    };
    img.onerror = () => setError("Could not decode image");
    img.src = "/api/assets?id=" + assetId;
  }, [assetId]);

  useEffect(() => {
    redraw();
  }, [adj, levels, xf, selection, paint]);

  function buildWorking(
    img: HTMLImageElement,
    state: Snapshot,
  ): { canvas: HTMLCanvasElement; w: number; h: number } {
    const cropW = img.naturalWidth * state.xf.crop.w;
    const cropH = img.naturalHeight * state.xf.crop.h;
    const sx = img.naturalWidth * state.xf.crop.x;
    const sy = img.naturalHeight * state.xf.crop.y;
    const rotated = state.xf.rotation === 90 || state.xf.rotation === 270;
    const outW = Math.max(1, Math.round(rotated ? cropH : cropW));
    const outH = Math.max(1, Math.round(rotated ? cropW : cropH));
    const off = document.createElement("canvas");
    off.width = outW;
    off.height = outH;
    const octx = off.getContext("2d");
    if (!octx) throw Error("Canvas unavailable");
    octx.save();
    octx.translate(outW / 2, outH / 2);
    octx.rotate((state.xf.rotation * Math.PI) / 180);
    octx.scale(state.xf.flipX ? -1 : 1, state.xf.flipY ? -1 : 1);
    octx.drawImage(
      img,
      sx,
      sy,
      cropW,
      cropH,
      -cropW / 2,
      -cropH / 2,
      cropW,
      cropH,
    );
    octx.restore();

    let pixels: PixelBuffer = {
      width: outW,
      height: outH,
      data: new Uint8ClampedArray(octx.getImageData(0, 0, outW, outH).data),
    };
    if (state.paint && state.paint.width === outW && state.paint.height === outH) {
      pixels = state.paint;
    }
    const adjusted = applyPixelAdjustments(pixels, {
      ...state.adj,
      blur: 0,
      sharpen: 0,
    });
    const leveled = applyLevels(adjusted, state.levels);
    const merged = state.selection
      ? applyInSelection(pixels, leveled, state.selection)
      : leveled;
    octx.putImageData(
      new ImageData(
        new Uint8ClampedArray(merged.data),
        merged.width,
        merged.height,
      ),
      0,
      0,
    );
    return { canvas: off, w: outW, h: outH };
  }

  function redraw(override?: Snapshot) {
    const img = source.current;
    const c = canvas.current;
    if (!img || !c) return;
    const state = override || snapshot();
    try {
      const { canvas: off, w, h } = buildWorking(img, state);
      const scale = Math.min(1, 720 / Math.max(w, h));
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, c.width, c.height);
      if (state.selection) {
        ctx.strokeStyle = "#14b8a6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          state.selection.x * c.width,
          state.selection.y * c.height,
          state.selection.w * c.width,
          state.selection.h * c.height,
        );
        ctx.setLineDash([]);
      }
    } catch {
      /* ignore redraw race */
    }
  }

  function canvasNorm(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    return {
      nx: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      ny: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function ensurePaintBuffer(): PixelBuffer | null {
    const img = source.current;
    if (!img) return null;
    if (paint) return paint;
    try {
      const { canvas: off, w, h } = buildWorking(img, {
        adj: { ...defaultAdjustments },
        levels: { ...defaultLevels },
        xf,
        selection: null,
        paint: null,
      });
      const ctx = off.getContext("2d")!;
      const raw = ctx.getImageData(0, 0, w, h);
      return { width: w, height: h, data: new Uint8ClampedArray(raw.data) };
    } catch {
      return null;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canvas.current) return;
    const { nx, ny } = canvasNorm(e);
    canvas.current.setPointerCapture(e.pointerId);
    if (tool === "select") {
      dragSel.current = { x0: nx, y0: ny };
      setSelection({ x: nx, y: ny, w: 0.01, h: 0.01 });
      return;
    }
    painting.current = true;
    commitHistory();
    let buf = ensurePaintBuffer();
    if (!buf) return;
    buf = stampBrush(buf, {
      nx,
      ny,
      radius: brushSize,
      color: hexToRgb(brushColor),
      opacity: brushOpacity,
      erase: tool === "eraser",
      selection,
    });
    setPaint(buf);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const { nx, ny } = canvasNorm(e);
    if (tool === "select" && dragSel.current) {
      const x = Math.min(dragSel.current.x0, nx);
      const y = Math.min(dragSel.current.y0, ny);
      const w = Math.abs(nx - dragSel.current.x0) || 0.01;
      const h = Math.abs(ny - dragSel.current.y0) || 0.01;
      setSelection({
        x,
        y,
        w: Math.min(1 - x, w),
        h: Math.min(1 - y, h),
      });
      return;
    }
    if (!painting.current || (tool !== "brush" && tool !== "eraser")) return;
    let buf = paint || ensurePaintBuffer();
    if (!buf) return;
    buf = stampBrush(buf, {
      nx,
      ny,
      radius: brushSize,
      color: hexToRgb(brushColor),
      opacity: brushOpacity,
      erase: tool === "eraser",
      selection,
    });
    setPaint(buf);
  }

  function onPointerUp() {
    if (tool === "select" && dragSel.current) {
      commitHistory();
    }
    dragSel.current = null;
    painting.current = false;
  }

  function undo() {
    if (!history || !history.past.length) return;
    const next = historyUndo(history);
    setHistory(next);
    applySnapshot(next.present);
  }

  function redo() {
    if (!history || !history.future.length) return;
    const next = historyRedo(history);
    setHistory(next);
    applySnapshot(next.present);
  }

  async function exportPng() {
    const img = source.current;
    if (!img || !assetId) return;
    setBusy(true);
    setError("");
    try {
      const { canvas: off } = buildWorking(img, snapshot());
      const blob = await new Promise<Blob | null>((resolve) =>
        off.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("Encode failed");
      const r = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-file-name": encodeURIComponent(`edited-${Date.now()}.png`),
        },
        body: blob,
      });
      const asset = await r.json();
      if (!r.ok) throw Error(asset.error || "Upload failed");
      setMsg(`Saved edited image ${String(asset.id).slice(0, 8)}…`);
      setAssets((rows) => [asset, ...rows]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  function patchAdj(key: keyof ImageAdjustments, value: number) {
    commitHistory();
    setAdj((a) => ({ ...a, [key]: value }));
  }

  return (
    <div className="image-editor-studio">
      <header className="panel-head">
        <div>
          <h2>Image editor</h2>
          <p>
            Closer to Photoshop basics: undo/redo, marquee selection, levels,
            brush/eraser, plus crop/flip/rotate and tone. Blur stays preview-only.
          </p>
        </div>
        <Badge variant="outline">
          <ImageIcon size={12} /> Closer parity
        </Badge>
      </header>

      {!assets.length ? (
        <p className="empty">Import an image into Assets first.</p>
      ) : (
        <>
          <label>
            Image asset
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <canvas
            ref={canvas}
            className="image-editor-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />

          <div className="bar-tools">
            <Button
              size="sm"
              variant={tool === "select" ? "default" : "outline"}
              onClick={() => setTool("select")}
            >
              <SquareDashed size={14} /> Select
            </Button>
            <Button
              size="sm"
              variant={tool === "brush" ? "default" : "outline"}
              onClick={() => setTool("brush")}
            >
              <Paintbrush size={14} /> Brush
            </Button>
            <Button
              size="sm"
              variant={tool === "eraser" ? "default" : "outline"}
              onClick={() => setTool("eraser")}
            >
              <Eraser size={14} /> Eraser
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!history?.past.length}
              onClick={undo}
            >
              <Undo2 size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!history?.future.length}
              onClick={redo}
            >
              <Redo2 size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                commitHistory();
                setXf((t) => ({
                  ...t,
                  rotation: ((t.rotation + 90) % 360) as ImageTransform["rotation"],
                }));
                setPaint(null);
              }}
            >
              <RotateCw size={14} /> Rotate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                commitHistory();
                setXf((t) => ({ ...t, flipX: !t.flipX }));
                setPaint(null);
              }}
            >
              <FlipHorizontal size={14} /> Flip H
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                commitHistory();
                setXf((t) => ({ ...t, flipY: !t.flipY }));
                setPaint(null);
              }}
            >
              <FlipVertical size={14} /> Flip V
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void exportPng()}>
              <Download size={14} /> Export PNG
            </Button>
          </div>

          {(tool === "brush" || tool === "eraser") && (
            <div className="reel-grid">
              <label>
                Brush size
                <Input
                  type="number"
                  min={0.005}
                  max={0.15}
                  step={0.005}
                  value={brushSize}
                  onChange={(e) =>
                    setBrushSize(
                      Math.min(0.15, Math.max(0.005, Number(e.target.value) || 0.04)),
                    )
                  }
                />
              </label>
              <label>
                Opacity
                <Input
                  type="number"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={brushOpacity}
                  onChange={(e) =>
                    setBrushOpacity(
                      Math.min(1, Math.max(0.05, Number(e.target.value) || 0.85)),
                    )
                  }
                />
              </label>
              {tool === "brush" && (
                <label>
                  Color
                  <Input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          <div className="reel-grid">
            {(
              [
                ["brightness", -1, 1, 0.05],
                ["contrast", -1, 1, 0.05],
                ["saturation", -1, 1, 0.05],
                ["hue", -180, 180, 1],
              ] as const
            ).map(([key, min, max, step]) => (
              <label key={key}>
                {key}
                <Input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={adj[key]}
                  onChange={(e) =>
                    patchAdj(key, Number(e.target.value) || 0)
                  }
                />
              </label>
            ))}
            <label>
              Levels black
              <Input
                type="number"
                min={0}
                max={254}
                value={levels.black}
                onChange={(e) => {
                  commitHistory();
                  setLevels((l) => ({
                    ...l,
                    black: Math.min(254, Math.max(0, Number(e.target.value) || 0)),
                  }));
                }}
              />
            </label>
            <label>
              Levels mid (γ)
              <Input
                type="number"
                min={0.1}
                max={9.9}
                step={0.1}
                value={levels.mid}
                onChange={(e) => {
                  commitHistory();
                  setLevels((l) => ({
                    ...l,
                    mid: Math.min(9.9, Math.max(0.1, Number(e.target.value) || 1)),
                  }));
                }}
              />
            </label>
            <label>
              Levels white
              <Input
                type="number"
                min={1}
                max={255}
                value={levels.white}
                onChange={(e) => {
                  commitHistory();
                  setLevels((l) => ({
                    ...l,
                    white: Math.min(255, Math.max(1, Number(e.target.value) || 255)),
                  }));
                }}
              />
            </label>
            <label>
              Crop X
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={xf.crop.x}
                onChange={(e) => {
                  commitHistory();
                  setXf((t) => ({
                    ...t,
                    crop: {
                      ...t.crop,
                      x: Math.min(1, Math.max(0, Number(e.target.value) || 0)),
                    },
                  }));
                  setPaint(null);
                }}
              />
            </label>
            <label>
              Crop W
              <Input
                type="number"
                min={0.05}
                max={1}
                step={0.01}
                value={xf.crop.w}
                onChange={(e) => {
                  commitHistory();
                  setXf((t) => ({
                    ...t,
                    crop: {
                      ...t.crop,
                      w: Math.min(
                        1,
                        Math.max(0.05, Number(e.target.value) || 0.05),
                      ),
                    },
                  }));
                  setPaint(null);
                }}
              />
            </label>
          </div>
          <div className="bar-tools">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                commitHistory();
                setSelection(null);
              }}
            >
              Clear selection
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                commitHistory();
                setAdj({ ...defaultAdjustments });
                setLevels({ ...defaultLevels });
                setXf({ ...defaultTransform });
                setSelection(null);
                setPaint(null);
              }}
            >
              Reset
            </Button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
