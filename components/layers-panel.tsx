"use client";
import { useState } from "react";
import { AssetLibrary } from "./asset-library";
import type { Asset } from "@/lib/assets";
import type { Track, Ease } from "@/lib/composition";
import type { Settings } from "@/lib/types";
export function LayersPanel({
  s,
  change,
  at,
  length,
  seek,
}: {
  s: Settings;
  change: (s: Settings) => void;
  at: number;
  length: number;
  seek: (n: number) => void;
}) {
  const tracks = s.composition?.tracks || [],
    [id, setId] = useState(""),
    [param, setParam] = useState<"x" | "y" | "volume">("x"),
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
  const keys = t?.keys[param] || [],
    pos = t
      ? Math.round(Math.max(0, Math.min(t.length, at - t.at)) * 1000) / 1000
      : 0;
  return (
    <div className="editor-fields">
      <h3>Composition tracks</h3>
      <details>
        <summary className="inline-link">Add media track</summary>
        <AssetLibrary insert={insert} />
      </details>
      <div className="layer-stack">
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
                      if (k === "length" && ripple)
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
                {["x", "y", "volume"].map((v) => (
                  <option key={v}>{v}</option>
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
              disabled={at < t.at || at > t.at + t.length}
              onClick={() =>
                patch({
                  keys: {
                    ...t.keys,
                    [param]: [
                      ...keys.filter((k) => k.time !== pos),
                      { time: pos, value: t[param], ease },
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
