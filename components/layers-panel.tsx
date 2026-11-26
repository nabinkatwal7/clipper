"use client";
import { useState } from "react";
import { AssetLibrary } from "./asset-library";
import { LayerMaskControls } from "./layer-mask-controls";
import { blendModes, type BlendMode } from "@/lib/layer-blend";
import type { Asset } from "@/lib/assets";
import type { Track, Ease } from "@/lib/composition";
import type { Settings } from "@/lib/types";
export function LayersPanel({
  s,
  change,
  at,
  length,
  seek,
  project,
  clip,
}: {
  project: string;
  clip: string;
  s: Settings;
  change: (s: Settings) => void;
  at: number;
  length: number;
  seek: (n: number) => void;
}) {
  const [suggestions, setSuggestions] = useState<
      { asset: Asset; reason: string }[]
    >([]),
    [message, setMessage] = useState(""),
    [finding, setFinding] = useState(false);
  async function suggest() {
    setFinding(true);
    setMessage("");
    try {
      const r = await fetch("/api/suggest-broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, clip }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setSuggestions(data);
      if (!data.length) setMessage("No matching local footage found.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setFinding(false);
    }
  }
  const [selection, selectMany] = useState<string[]>([]);
  const tracks = s.composition?.tracks || [],
    [id, setId] = useState(""),
    [selectedParam, setParam] = useState<"x" | "y" | "volume" | "rotation">(
      "x",
    ),
    [ease, setEase] = useState<Ease>("linear"),
    [ripple, setRipple] = useState(false);
  const t = tracks.find((t) => t.id === id) || tracks[0],
    save = (tracks: Track[]) =>
      change({ ...s, composition: { version: 1, tracks } }),
    patch = (v: Partial<Track>) =>
      save(tracks.map((a) => (a.id === t.id ? { ...a, ...v } : a)));
  function insert(a: Asset) {
    if (tracks.length >= 16) return;
    const id = crypto.randomUUID(),
      start = Math.min(Math.max(0, at), Math.max(0, length - 0.1));
    save([
      ...tracks,
      {
        id,
        name: a.name,
        type: a.kind,
        asset: a.id,
        at: start,
        length: Math.max(0.05, Math.min(length - start, a.duration || 5)),
        slip: 0,
        x: 0.5,
        y: 0.5,
        size: a.kind === "image" ? 0.3 : 1,
        opacity: 1,
        volume: 1,
        visible: true,
        muted: a.kind !== "audio",
        locked: false,
        solo: false,
        loop: true,
        fade: 0,
        keys: {},
      },
    ]);
    setId(id);
  }
  const param = t?.type === "audio" ? "volume" : selectedParam;
  const keys = t?.keys[param] || [],
    pos = t
      ? Math.round(Math.max(0, Math.min(t.length, at - t.at)) * 1000) / 1000
      : 0;
  return (
    <div className="editor-fields">
      <h3>Composition tracks</h3>
      {tracks.length > 1 && (
        <details>
          <summary>Group tracks</summary>
          {tracks.map((v) => (
            <label className="check-row" key={v.id}>
              <input
                type="checkbox"
                disabled={v.locked}
                checked={selection.includes(v.id)}
                onChange={(e) =>
                  selectMany(
                    e.target.checked
                      ? [...selection, v.id]
                      : selection.filter((id) => id !== v.id),
                  )
                }
              />
              {v.name}
              {v.group ? " · grouped" : ""}
            </label>
          ))}
          <button
            className="tool"
            disabled={selection.length < 2}
            onClick={() => {
              const group = crypto.randomUUID();
              save(
                tracks.map((v) =>
                  selection.includes(v.id) && !v.locked ? { ...v, group } : v,
                ),
              );
              selectMany([]);
            }}
          >
            Group selected
          </button>
          <button
            className="tool"
            disabled={!selection.length}
            onClick={() => {
              save(
                tracks.map((v) =>
                  selection.includes(v.id) && !v.locked
                    ? { ...v, group: undefined }
                    : v,
                ),
              );
              selectMany([]);
            }}
          >
            Ungroup selected
          </button>
        </details>
      )}
      <details>
        <summary className="inline-link">Add media track</summary>
        <AssetLibrary insert={insert} />
        <button className="tool" disabled={finding} onClick={suggest}>
          {finding ? "Checking local assets…" : "Suggest B-roll with Ollama"}
        </button>
        {suggestions.map(({ asset, reason }) => (
          <button
            key={asset.id}
            className="event-row"
            onClick={() => insert(asset)}
          >
            Insert {asset.name}
            <small>{reason}</small>
          </button>
        ))}
      </details>
      {message && <p role="status">{message}</p>}
      <div
        className="layer-stack"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-clipper-asset"))
            e.preventDefault();
        }}
        onDrop={async (e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("application/x-clipper-asset");
          if (!id) return;
          try {
            const r = await fetch("/api/assets");
            if (!r.ok) throw Error("Could not load the asset library");
            const a = ((await r.json()) as Asset[]).find((a) => a.id === id);
            if (!a) throw Error("Asset is unavailable");
            insert(a);
          } catch (err) {
            setMessage(String(err));
          }
        }}
      >
        <small>Drop a library asset here to insert it at the playhead.</small>
        {tracks.map((v, i) => (
          <button
            key={v.id}
            className={"event-row " + (v === t ? "current" : "")}
            onClick={() => setId(v.id)}
          >
            {i + 1}. {v.name}
            <small>
              {v.at.toFixed(1)}–{(v.at + v.length).toFixed(1)} s
            </small>
          </button>
        ))}
      </div>
      {t && (
        <>
          <label className="check-row">
            <input
              type="checkbox"
              checked={t.locked}
              onChange={(e) => patch({ locked: e.target.checked })}
            />
            Lock track
          </label>
          <fieldset disabled={t.locked}>
            {t.type !== "audio" && (
              <details className="clip-context">
                <summary>Layer transform</summary>
                <label className="field">
                  Rotation · {t.rotation ?? 0}°
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={t.rotation ?? 0}
                    onChange={(e) => patch({ rotation: +e.target.value })}
                  />
                </label>
                <div className="candidate-actions">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={!!t.flipX}
                      onChange={(e) => patch({ flipX: e.target.checked })}
                    />{" "}
                    Mirror horizontally
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={!!t.flipY}
                      onChange={(e) => patch({ flipY: e.target.checked })}
                    />{" "}
                    Mirror vertically
                  </label>
                  <button
                    type="button"
                    className="tool"
                    disabled={!t.rotation && !t.flipX && !t.flipY}
                    onClick={() =>
                      patch({
                        rotation: undefined,
                        flipX: undefined,
                        flipY: undefined,
                      })
                    }
                  >
                    Reset transform
                  </button>
                </div>
              </details>
            )}
            {t.type !== "audio" && (
              <label className="field">
                Blend mode
                <select
                  value={t.blendMode ?? "normal"}
                  onChange={(e) =>
                    patch({ blendMode: e.target.value as BlendMode })
                  }
                >
                  {Object.entries(blendModes).map(([mode, label]) => (
                    <option key={mode} value={mode}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {t.type !== "audio" && (
              <LayerMaskControls
                key={t.id}
                mask={t.mask}
                change={(mask) => patch({ mask })}
                time={at - t.at}
                length={t.length}
                seek={(time) => seek(t.at + time)}
              />
            )}
            {t.type !== "audio" && (
              <details className="clip-context">
                <summary>Chroma key</summary>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={!!t.keyColor}
                    onChange={(e) =>
                      patch({
                        keyColor: e.target.checked
                          ? { color: "#00ff00", similarity: 0.2, blend: 0.08 }
                          : undefined,
                      })
                    }
                  />{" "}
                  Remove a background color
                </label>
                {t.keyColor && (
                  <div className="field-grid">
                    <label className="field">
                      Key color
                      <input
                        type="color"
                        value={t.keyColor.color}
                        onChange={(e) =>
                          patch({
                            keyColor: { ...t.keyColor!, color: e.target.value },
                          })
                        }
                      />
                    </label>
                    {(["similarity", "blend"] as const).map((k) => (
                      <label className="field" key={k}>
                        {k === "similarity" ? "Similarity" : "Edge blend"} ·{" "}
                        {t.keyColor![k]}
                        <input
                          type="range"
                          min={k === "similarity" ? ".01" : "0"}
                          max="1"
                          step=".01"
                          value={t.keyColor![k]}
                          onChange={(e) =>
                            patch({
                              keyColor: {
                                ...t.keyColor!,
                                [k]: +e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                <p className="hint">
                  Render the layer preview to inspect the effect.
                </p>
              </details>
            )}
            <label className="field">
              Track name
              <input
                value={t.name}
                maxLength={100}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <div className="candidate-actions">
              {(["muted", "visible", "solo", "loop"] as const).map((k) => (
                <label className="check-row" key={k}>
                  <input
                    type="checkbox"
                    checked={t[k]}
                    onChange={(e) => patch({ [k]: e.target.checked })}
                  />
                  {k}
                </label>
              ))}
            </div>
            <div className="field-grid">
              {(
                [
                  "at",
                  "length",
                  "slip",
                  "x",
                  "y",
                  "size",
                  "opacity",
                  "volume",
                  "fade",
                ] as const
              ).map((k) => (
                <label className="field" key={k}>
                  {k}
                  <input
                    type="number"
                    step=".01"
                    value={t[k]}
                    onChange={(e) => {
                      const n = +e.target.value;
                      if (k === "at" && t.group) {
                        const peers = tracks.filter((v) => v.group === t.group);
                        if (peers.some((v) => v.locked)) {
                          setMessage(
                            "Unlock grouped tracks to move them together.",
                          );
                          return;
                        }
                        const delta = Math.max(
                          -Math.min(...peers.map((v) => v.at)),
                          Math.min(
                            n - t.at,
                            600 - Math.max(...peers.map((v) => v.at)),
                          ),
                        );
                        save(
                          tracks.map((v) =>
                            v.group === t.group
                              ? { ...v, at: v.at + delta }
                              : v,
                          ),
                        );
                      } else if (k === "length" && ripple)
                        save(
                          tracks.map((v) =>
                            v.id === t.id
                              ? { ...v, length: n }
                              : v.at >= t.at + t.length && !v.locked
                                ? { ...v, at: Math.max(0, v.at + n - t.length) }
                                : v,
                          ),
                        );
                      else patch({ [k]: n });
                    }}
                  />
                </label>
              ))}
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={ripple}
                onChange={(e) => setRipple(e.target.checked)}
              />
              Ripple later tracks on trim or delete
            </label>
            <div className="candidate-actions">
              <button
                className="tool"
                disabled={tracks.length >= 16}
                onClick={() => {
                  const id = crypto.randomUUID();
                  save([...tracks, { ...t, id, name: t.name + " copy" }]);
                  setId(id);
                }}
              >
                Duplicate
              </button>
              <button
                className="tool"
                disabled={tracks.indexOf(t) === tracks.length - 1}
                onClick={() => {
                  const list = [...tracks],
                    i = list.indexOf(t);
                  [list[i], list[i + 1]] = [list[i + 1], list[i]];
                  save(list);
                }}
              >
                Raise layer
              </button>
              <button
                className="tool"
                onClick={() =>
                  save(
                    tracks
                      .filter((v) => v.id !== t.id)
                      .map((v) =>
                        ripple && !v.locked && v.at >= t.at + t.length
                          ? { ...v, at: v.at - t.length }
                          : v,
                      ),
                  )
                }
              >
                Remove
              </button>
            </div>
            <h3>Keyframes</h3>
            <label className="field">
              Property
              <select
                value={param}
                onChange={(e) => setParam(e.target.value as typeof param)}
              >
                {(t.type === "audio"
                  ? ["volume"]
                  : ["x", "y", "volume", "rotation"]
                ).map((v) => (
                  <option key={v} value={v}>
                    {v === "rotation" ? "Rotation" : v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Interpolation
              <select
                value={ease}
                onChange={(e) => setEase(e.target.value as Ease)}
              >
                {["linear", "in", "out", "in-out", "hold"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <button
              className="tool"
              disabled={
                at < t.at ||
                at > t.at + t.length ||
                (keys.length >= 48 && !keys.some((key) => key.time === pos))
              }
              onClick={() =>
                patch({
                  keys: {
                    ...t.keys,
                    [param]: [
                      ...keys.filter((k) => k.time !== pos),
                      { time: pos, value: t[param] ?? 0, ease },
                    ].sort((a, b) => a.time - b.time),
                  },
                })
              }
            >
              Set {param} at playhead
            </button>
            {keys.map((k) => (
              <div className="section-row" key={k.time}>
                <button onClick={() => seek(t.at + k.time)}>
                  {k.time}s · {k.value} · {k.ease}
                </button>
                <button
                  onClick={() =>
                    patch({
                      keys: { ...t.keys, [param]: keys.filter((v) => v !== k) },
                    })
                  }
                >
                  Delete
                </button>
              </div>
            ))}
          </fieldset>
        </>
      )}
    </div>
  );
}
