"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Download, Play, Plus, Save, Film } from "lucide-react";
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

function applyAnim(
  root: THREE.Group,
  animation: ThreeScene["animation"],
  t: number,
) {
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  if (animation === "turntable") root.rotation.y = t * 0.7;
  else if (animation === "orbit") {
    root.rotation.y = t * 0.45;
    root.rotation.x = Math.sin(t * 0.6) * 0.15;
  } else if (animation === "bob") {
    root.position.y = Math.sin(t * 2) * 0.15;
  }
}

export function ThreeDStudio() {
  const mount = useRef<HTMLDivElement>(null);
  const [sceneDoc, setSceneDoc] = useState<ThreeScene | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [bakeFrames, setBakeFrames] = useState(24);
  const [bakeFps, setBakeFps] = useState(24);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const animRef = useRef<ThreeScene["animation"]>("turntable");
  const raf = useRef<number | null>(null);
  const t0 = useRef(performance.now());

  const selectedObj = sceneDoc?.objects.find((o) => o.id === selected);

  useEffect(() => {
    fetch("/api/three-d")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        const scene = data.scenes?.[0] || data.default;
        setSceneDoc(scene);
        setSelected(scene?.objects?.[0]?.id || null);
      })
      .catch(() => setError("Could not load 3D scenes"));
  }, []);

  useEffect(() => {
    if (!mount.current || !sceneDoc) return;
    animRef.current = sceneDoc.animation;
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
        ctx.clearRect(0, 0, 512, 256);
        ctx.fillStyle = obj.color || "#fff";
        ctx.font = "700 120px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((obj.text || "3D").slice(0, 12), 256, 128);
        const tex = new THREE.CanvasTexture(canvas);
        mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.8),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
        );
      } else mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);

      mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
      mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
      mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
      root.add(mesh);
    }

    const tick = (now: number) => {
      const t = (now - t0.current) / 1000;
      if (playing && rootRef.current)
        applyAnim(rootRef.current, animRef.current, t);
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
      setSelected(data.objects?.[0]?.id || null);
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

  async function addObject(kind: ThreeObject["kind"]) {
    if (!sceneDoc) return;
    if (sceneDoc.objects.length >= 24) {
      setError("At most 24 objects");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/three-d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create-object", kind }),
      });
      const obj = await r.json();
      if (!r.ok) throw Error(obj.error || "Could not add object");
      setSceneDoc({
        ...sceneDoc,
        objects: [...sceneDoc.objects, obj],
      });
      setSelected(obj.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  function patchObject(id: string, patch: Partial<ThreeObject>) {
    if (!sceneDoc) return;
    setSceneDoc({
      ...sceneDoc,
      objects: sceneDoc.objects.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    });
  }

  function patchVec(
    id: string,
    key: "position" | "rotation" | "scale",
    axis: keyof Vec3,
    value: number,
  ) {
    if (!sceneDoc) return;
    const obj = sceneDoc.objects.find((o) => o.id === id);
    if (!obj) return;
    patchObject(id, {
      [key]: { ...obj[key], [axis]: value },
    });
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
      setMsg(`Exported still ${String(asset.id).slice(0, 8)}…`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function bakeVideo() {
    const renderer = rendererRef.current;
    const root = rootRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !root || !scene || !camera || !sceneDoc) return;
    setBusy(true);
    setError("");
    setPlaying(false);
    try {
      const frames: string[] = [];
      const n = Math.min(48, Math.max(2, bakeFrames));
      const fps = Math.min(30, Math.max(12, bakeFps));
      for (let i = 0; i < n; i++) {
        applyAnim(root, sceneDoc.animation, i / fps);
        renderer.render(scene, camera);
        const blob = await new Promise<Blob | null>((resolve) =>
          renderer.domElement.toBlob(resolve, "image/png"),
        );
        if (!blob) throw Error("Frame capture failed");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(Error("Read failed"));
          reader.readAsDataURL(blob);
        });
        frames.push(dataUrl);
      }
      const r = await fetch("/api/three-d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "bake-frames",
          frames,
          fps,
          name: sceneDoc.name,
        }),
      });
      const asset = await r.json();
      if (!r.ok) throw Error(asset.error || "Bake failed");
      setMsg(
        `Baked ${n}-frame video ${String(asset.id).slice(0, 8)}… (${(n / fps).toFixed(1)}s). Open Assets.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bake failed");
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
            Closer to Blender-lite overlays: edit objects, bake short frame
            sequences to MP4. Not Blender — no GLB/glTF import, WebGL required.
          </p>
        </div>
        <Badge variant="outline">
          <Box size={12} /> Closer parity
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
          <Button size="sm" disabled={busy} onClick={() => void exportStill()}>
            <Download size={14} /> PNG
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void bakeVideo()}>
            <Film size={14} /> Bake video
          </Button>
        </div>
      </div>

      {sceneDoc && (
        <>
          <div className="reel-grid">
            <label>
              Name
              <Input
                value={sceneDoc.name}
                onChange={(e) =>
                  setSceneDoc({
                    ...sceneDoc,
                    name: e.target.value.slice(0, 80),
                  })
                }
              />
            </label>
            <label>
              Animation
              <select
                value={sceneDoc.animation}
                onChange={(e) =>
                  setSceneDoc({
                    ...sceneDoc,
                    animation: e.target.value as ThreeScene["animation"],
                  })
                }
              >
                <option value="none">None</option>
                <option value="turntable">Turntable</option>
                <option value="orbit">Orbit</option>
                <option value="bob">Bob</option>
              </select>
            </label>
            <label>
              Bake frames
              <Input
                type="number"
                min={2}
                max={48}
                value={bakeFrames}
                onChange={(e) =>
                  setBakeFrames(
                    Math.min(48, Math.max(2, Number(e.target.value) || 24)),
                  )
                }
              />
            </label>
            <label>
              Bake FPS
              <Input
                type="number"
                min={12}
                max={30}
                value={bakeFps}
                onChange={(e) =>
                  setBakeFps(
                    Math.min(30, Math.max(12, Number(e.target.value) || 24)),
                  )
                }
              />
            </label>
          </div>

          <div ref={mount} className="three-d-viewport" />

          <div className="design-layout">
            <ul className="design-layers">
              {sceneDoc.objects.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className={selected === o.id ? "current" : ""}
                    onClick={() => setSelected(o.id)}
                  >
                    {o.name}
                    <small>{o.kind}</small>
                  </button>
                </li>
              ))}
            </ul>
            <div className="design-inspector">
              <div className="bar-tools">
                {(
                  ["box", "sphere", "torus", "plane", "text"] as const
                ).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void addObject(k)}
                  >
                    <Plus size={12} /> {k}
                  </Button>
                ))}
              </div>
              {!selectedObj ? (
                <p className="muted">Select an object</p>
              ) : (
                <>
                  <label>
                    Name
                    <Input
                      value={selectedObj.name}
                      onChange={(e) =>
                        patchObject(selectedObj.id, {
                          name: e.target.value.slice(0, 80),
                        })
                      }
                    />
                  </label>
                  {selectedObj.kind === "text" && (
                    <label>
                      Text
                      <Input
                        value={selectedObj.text || ""}
                        onChange={(e) =>
                          patchObject(selectedObj.id, {
                            text: e.target.value.slice(0, 24),
                          })
                        }
                      />
                    </label>
                  )}
                  <label>
                    Color
                    <Input
                      type="color"
                      value={(selectedObj.color || "#14b8a6").slice(0, 7)}
                      onChange={(e) =>
                        patchObject(selectedObj.id, { color: e.target.value })
                      }
                    />
                  </label>
                  {(["position", "rotation", "scale"] as const).map((key) => (
                    <div key={key} className="reel-grid">
                      {(["x", "y", "z"] as const).map((axis) => (
                        <label key={axis}>
                          {key} {axis}
                          <Input
                            type="number"
                            step={0.05}
                            value={selectedObj[key][axis]}
                            onChange={(e) =>
                              patchVec(
                                selectedObj.id,
                                key,
                                axis,
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                  <label>
                    Metalness
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={selectedObj.metalness}
                      onChange={(e) =>
                        patchObject(selectedObj.id, {
                          metalness: Math.min(
                            1,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Roughness
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={selectedObj.roughness}
                      onChange={(e) =>
                        patchObject(selectedObj.id, {
                          roughness: Math.min(
                            1,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSceneDoc({
                        ...sceneDoc,
                        objects: sceneDoc.objects.filter(
                          (o) => o.id !== selectedObj.id,
                        ),
                      });
                      setSelected(null);
                    }}
                  >
                    Remove object
                  </Button>
                </>
              )}
            </div>
          </div>

          <p className="muted">
            GLB/glTF mesh import is not supported in this local stack — use
            primitive objects or export stills/video overlays into Assets.
          </p>
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
