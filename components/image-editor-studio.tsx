"use client";
import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Download,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  defaultAdjustments,
  defaultTransform,
  applyPixelAdjustments,
  type ImageAdjustments,
  type ImageTransform,
} from "@/lib/image-editor";

type Asset = { id: string; name: string; kind: string; ext: string };

export function ImageEditorStudio() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [adj, setAdj] = useState<ImageAdjustments>({ ...defaultAdjustments });
  const [xf, setXf] = useState<ImageTransform>({ ...defaultTransform });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLImageElement | null>(null);

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
      redraw();
    };
    img.onerror = () => setError("Could not decode image");
    img.src = "/api/assets?id=" + assetId;
  }, [assetId]);

  useEffect(() => {
    redraw();
  }, [adj, xf]);

  function redraw() {
    const img = source.current;
    const c = canvas.current;
    if (!img || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const cropW = img.naturalWidth * xf.crop.w;
    const cropH = img.naturalHeight * xf.crop.h;
    const sx = img.naturalWidth * xf.crop.x;
    const sy = img.naturalHeight * xf.crop.y;
    const rotated = xf.rotation === 90 || xf.rotation === 270;
    const outW = Math.max(1, Math.round(rotated ? cropH : cropW));
    const outH = Math.max(1, Math.round(rotated ? cropW : cropH));
    const scale = Math.min(1, 720 / Math.max(outW, outH));
    c.width = Math.round(outW * scale);
    c.height = Math.round(outH * scale);

    const off = document.createElement("canvas");
    off.width = outW;
    off.height = outH;
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.save();
    octx.translate(outW / 2, outH / 2);
    octx.rotate((xf.rotation * Math.PI) / 180);
    octx.scale(xf.flipX ? -1 : 1, xf.flipY ? -1 : 1);
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

    const raw = octx.getImageData(0, 0, outW, outH);
    const pixels = applyPixelAdjustments(raw, {
      ...adj,
      blur: 0,
      sharpen: 0,
    });
    octx.putImageData(
      new ImageData(pixels.data, pixels.width, pixels.height),
      0,
      0,
    );
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, c.width, c.height);
  }

  async function exportPng() {
    const img = source.current;
    if (!img || !assetId) return;
    setBusy(true);
    setError("");
    try {
      const cropW = img.naturalWidth * xf.crop.w;
      const cropH = img.naturalHeight * xf.crop.h;
      const sx = img.naturalWidth * xf.crop.x;
      const sy = img.naturalHeight * xf.crop.y;
      const rotated = xf.rotation === 90 || xf.rotation === 270;
      const outW = Math.max(1, Math.round(rotated ? cropH : cropW));
      const outH = Math.max(1, Math.round(rotated ? cropW : cropH));
      const off = document.createElement("canvas");
      off.width = outW;
      off.height = outH;
      const octx = off.getContext("2d");
      if (!octx) throw Error("Canvas unavailable");
      octx.translate(outW / 2, outH / 2);
      octx.rotate((xf.rotation * Math.PI) / 180);
      octx.scale(xf.flipX ? -1 : 1, xf.flipY ? -1 : 1);
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
      octx.setTransform(1, 0, 0, 1, 0, 0);
      const raw = octx.getImageData(0, 0, outW, outH);
      const pixels = applyPixelAdjustments(raw, {
        ...adj,
        blur: 0,
        sharpen: 0,
      });
      octx.putImageData(
        new ImageData(pixels.data, pixels.width, pixels.height),
        0,
        0,
      );
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

  return (
    <div className="image-editor-studio">
      <header className="panel-head">
        <div>
          <h2>Image editor</h2>
          <p>
            Lightweight raster corrections on local image assets — crop, flip,
            rotate, brightness/contrast/saturation/hue. Blur is preview-only.
          </p>
        </div>
        <Badge variant="outline">
          <ImageIcon size={12} /> Partial
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

          <canvas ref={canvas} className="image-editor-canvas" />

          <div className="bar-tools">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setXf((t) => ({
                  ...t,
                  rotation: ((t.rotation + 90) % 360) as ImageTransform["rotation"],
                }))
              }
            >
              <RotateCw size={14} /> Rotate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setXf((t) => ({ ...t, flipX: !t.flipX }))}
            >
              <FlipHorizontal size={14} /> Flip H
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setXf((t) => ({ ...t, flipY: !t.flipY }))}
            >
              <FlipVertical size={14} /> Flip V
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void exportPng()}
            >
              <Download size={14} /> Export PNG
            </Button>
          </div>

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
                    setAdj((a) => ({
                      ...a,
                      [key]: Number(e.target.value) || 0,
                    }))
                  }
                />
              </label>
            ))}
            <label>
              Crop X
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={xf.crop.x}
                onChange={(e) =>
                  setXf((t) => ({
                    ...t,
                    crop: {
                      ...t.crop,
                      x: Math.min(1, Math.max(0, Number(e.target.value) || 0)),
                    },
                  }))
                }
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
                onChange={(e) =>
                  setXf((t) => ({
                    ...t,
                    crop: {
                      ...t.crop,
                      w: Math.min(1, Math.max(0.05, Number(e.target.value) || 0.05)),
                    },
                  }))
                }
              />
            </label>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAdj({ ...defaultAdjustments });
              setXf({ ...defaultTransform });
            }}
          >
            Reset
          </Button>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
