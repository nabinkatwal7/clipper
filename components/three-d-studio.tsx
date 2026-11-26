"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Download, Play, Save } from "lucide-react";
import * as THREE from "three";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Vec3 = { x: number; y: number; z: number };
type ThreeObject = {
  id: string;
  kind: "box" | "sphere" | "plane" | "text" | "torus";
  name: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  metalness: number;
  roughness: number;
  text?: string;
};
type ThreeScene = {
  version: 1;
  id: string;
  name: string;
  background: string;
  camera: { position: Vec3; lookAt: Vec3 };
  light: { intensity: number; color: string };
  animation: "none" | "turntable" | "orbit" | "bob";
  objects: ThreeObject[];
};

type Template = { id: string; label: string };

export function ThreeDStudio() {
  const mount = useRef<HTMLDivElement>(null);
  const [sceneDoc, setSceneDoc] = useState<ThreeScene | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const raf = useRef<number | null>(null);
  const t0 = useRef(performance.now());

  useEffect(() => {
    fetch("/api/three-d")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        setSceneDoc(data.scenes?.[0] || data.default);
      })
      .catch(() => setError("Could not load 3D scenes"));
  }, []);

  useEffect(() => {
    if (!mount.current || !sceneDoc) return;
    const width = mount.current.clientWidth || 640;
    const height = 360;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    mount.current.innerHTML = "";
    mount.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sceneDoc.background || "#0a1214");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(
      sceneDoc.camera.position.x,
      sceneDoc.camera.position.y,
      sceneDoc.camera.position.z,
    );
    camera.lookAt(
      sceneDoc.camera.lookAt.x,
      sceneDoc.camera.lookAt.y,
      sceneDoc.camera.lookAt.z,
    );
    cameraRef.current = camera;

    const hemi = new THREE.HemisphereLight("#e2e8f0", "#0f172a", 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(
      sceneDoc.light.color || "#ffffff",
      sceneDoc.light.intensity || 1,
    );
    key.position.set(3, 5, 2);
    scene.add(key);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshStandardMaterial({
        color: "#111827",
        metalness: 0.1,
        roughness: 0.9,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const root = new THREE.Group();
    rootRef.current = root;
    scene.add(root);

    for (const obj of sceneDoc.objects) {
      const mat = new THREE.MeshStandardMaterial({
        color: obj.color || "#14b8a6",
        metalness: obj.metalness ?? 0.3,
        roughness: obj.roughness ?? 0.4,
      });
      let mesh: THREE.Object3D;
      if (obj.kind === "sphere")
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), mat);
      else if (obj.kind === "torus")
        mesh = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 16, 48), mat);
      else if (obj.kind === "plane")
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      else if (obj.kind === "text") {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "transparent";
        ctx.clearRect(0, 0, 512, 256);
        ctx.fillStyle = obj.color || "#fff";
        ctx.font = "700 120px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((obj.text || "3D").slice(0, 12), 256, 128);
        const tex = new THREE.CanvasTexture(canvas);
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.8),
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
          }),
        );
      } else mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);

      mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
      mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
      mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
      root.add(mesh);
    }

    const tick = (now: number) => {
      const t = (now - t0.current) / 1000;
      if (playing && rootRef.current) {
        if (sceneDoc.animation === "turntable")
          rootRef.current.rotation.y = t * 0.7;
        else if (sceneDoc.animation === "orbit") {
          rootRef.current.rotation.y = t * 0.45;
          rootRef.current.rotation.x = Math.sin(t * 0.6) * 0.15;
        } else if (sceneDoc.animation === "bob") {
          rootRef.current.position.y = Math.sin(t * 2) * 0.15;
        }
      }
      renderer.render(scene, camera);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
    };
  }, [sceneDoc, playing]);

  async function create(template: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/three-d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create", template }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Create failed");
      setSceneDoc(data);
      setMsg("Loaded template");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!sceneDoc) return;
    setBusy(true);
    try {
      const r = await fetch("/api/three-d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "save", scene: sceneDoc }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Save failed");
      setSceneDoc(data);
      setMsg("Scene saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportStill() {
    const renderer = rendererRef.current;
    if (!renderer) return;
    setBusy(true);
    setError("");
    try {
      renderer.render(sceneRef.current!, cameraRef.current!);
      const blob = await new Promise<Blob | null>((resolve) =>
        renderer.domElement.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("Capture failed — WebGL required");
      const r = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-file-name": encodeURIComponent(
            `3d-${(sceneDoc?.name || "scene").replace(/\s+/g, "-").slice(0, 30)}.png`,
          ),
        },
        body: blob,
      });
      const asset = await r.json();
      if (!r.ok) throw Error(asset.error || "Upload failed");
      setMsg(
        `Exported still ${String(asset.id).slice(0, 8)}… Use as overlay asset. Needs WebGL.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="three-d-studio">
      <header className="panel-head">
        <div>
          <h2>3D Studio</h2>
          <p>
            Optional Three.js overlays for logos, nameplates and turntables —
            not Blender. Requires WebGL; exports still PNG overlays into Assets.
          </p>
        </div>
        <Badge variant="outline">
          <Box size={12} /> Optional
        </Badge>
      </header>

      <div className="reel-grid">
        <label>
          Template
          <select
            defaultValue="logo-reveal"
            onChange={(e) => void create(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className="bar-tools">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPlaying((p) => !p)}
          >
            <Play size={14} /> {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" disabled={busy || !sceneDoc} onClick={() => void save()}>
            <Save size={14} /> Save
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void exportStill()}
          >
            <Download size={14} /> Export PNG
          </Button>
        </div>
      </div>

      {sceneDoc && (
        <label>
          Name
          <Input
            value={sceneDoc.name}
            onChange={(e) =>
              setSceneDoc({ ...sceneDoc, name: e.target.value.slice(0, 80) })
            }
          />
        </label>
      )}

      <div ref={mount} className="three-d-viewport" />

      {sceneDoc && (
        <p className="muted">
          {sceneDoc.objects.length} objects · animation {sceneDoc.animation}.
          Frame sequences / video bake can follow via FFmpeg from stills.
        </p>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
