"use client";
import { RenderPreview } from "./render-preview";
import { useState } from "react";
import type { Settings } from "@/lib/types";
import { dry, neutral, effects, looks, gradeRanges, type StackedEffect } from "@/lib/grading";
export function GradePanel({
  settings: s,
  change,
  project,
  clip,
  start,
  end,
  playhead,
  audio,
}: {
  settings: Settings;
  change: (s: Settings) => void;
  project: string;
  clip: string;
  start: number;
  end: number;
  playhead: number;
  audio: boolean;
}) {
  const [error, setError] = useState("");
  const grade = { ...neutral, ...s.grade },
    mix = { ...dry, ...s.mix };
  return (
    <div className="editor-fields">
      <h3>{audio ? "Audio mixer" : "Color & effects"}</h3>
      {audio && (
        <a href={`/api/audio-export?project=${project}&clip=${clip}`}>
          Export saved audio (M4A)
        </a>
      )}
      {audio ? (
        <>
          <label className="field">
            Master gain
            <input
              type="range"
              min="0"
              max="2"
              step=".01"
              value={s.volume ?? 1}
              onChange={(e) => change({ ...s, volume: +e.target.value })}
            />
          </label>
          {(["duck", "normalize", "noise", "compress", "limit"] as const).map(
            (k) => (
              <label key={k} className="check-row">
                <input
                  type="checkbox"
                  checked={mix[k]}
                  onChange={(e) =>
                    change({ ...s, mix: { ...mix, [k]: e.target.checked } })
                  }
                />
                {
                  {
                    duck: "Duck added audio under source activity",
                    normalize: "Normalize loudness",
                    noise: "Reduce noise",
                    compress: "Compress dynamics",
                    limit: "Peak limiter",
                  }[k]
                }
              </label>
            ),
          )}
          {(
            [
              "bass",
              "treble",
              "balance",
              "highpass",
              "lowpass",
              "fadeIn",
              "fadeOut",
            ] as const
          ).map((k) => (
            <label className="field" key={k}>
              {k}{" "}
              <input
                type="number"
                step="any"
                value={mix[k]}
                onChange={(e) =>
                  change({ ...s, mix: { ...mix, [k]: +e.target.value } })
                }
              />
            </label>
          ))}
        </>
      ) : (
        <>
          <label className="field">
            Import 3D LUT (.cube)
            <input
              type="file"
              accept=".cube"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const r = await fetch("/api/lut", {
                    method: "POST",
                    body: f,
                  });
                  const data = await r.json();
                  if (!r.ok) throw Error(data.error);
                  change({
                    ...s,
                    grade: {
                      ...grade,
                      lut: data.id,
                      lutName: f.name,
                      lutIntensity: 1,
                    },
                  });
                } catch (e) {
                  setError(String(e));
                }
              }}
            />
          </label>
          {grade.lut && (
            <label className="field">
              {grade.lutName || "LUT"} intensity
              <input
                type="range"
                min="0"
                max="1"
                step=".01"
                value={grade.lutIntensity ?? 1}
                onChange={(e) =>
                  change({
                    ...s,
                    grade: { ...grade, lutIntensity: +e.target.value },
                  })
                }
              />
              <button
                className="tool"
                onClick={() =>
                  change({
                    ...s,
                    grade: { ...grade, lut: undefined, lutName: undefined },
                  })
                }
              >
                Remove LUT
              </button>
            </label>
          )}
          <label className="field">
            Look
            <select
              defaultValue=""
              onChange={(e) =>
                change({
                  ...s,
                  grade: { ...neutral, ...looks[e.target.value] },
                })
              }
            >
              <option disabled value="">
                Apply preset
              </option>
              {Object.keys(looks).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <h4>Effect stack</h4>
          <p className="hint">
            Stacked effects replace the single effect below when present. Up to
            eight enabled layers render in order.
          </p>
          <div className="candidate-actions">
            <button
              type="button"
              className="tool"
              disabled={(s.effectStack?.length || 0) >= 8}
              onClick={() =>
                change({
                  ...s,
                  effectStack: [
                    ...(s.effectStack || []),
                    {
                      id: crypto.randomUUID(),
                      effect: "blur",
                      amount: 0.5,
                      enabled: true,
                    } satisfies StackedEffect,
                  ],
                })
              }
            >
              Add effect
            </button>
          </div>
          {(s.effectStack || []).map((item, index) => (
            <div className="clip-context" key={item.id}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) =>
                    change({
                      ...s,
                      effectStack: (s.effectStack || []).map((entry, i) =>
                        i === index
                          ? { ...entry, enabled: e.target.checked }
                          : entry,
                      ),
                    })
                  }
                />
                Enabled
              </label>
              <label className="field">
                Effect
                <select
                  value={item.effect}
                  onChange={(e) =>
                    change({
                      ...s,
                      effectStack: (s.effectStack || []).map((entry, i) =>
                        i === index
                          ? {
                              ...entry,
                              effect: e.target.value as StackedEffect["effect"],
                            }
                          : entry,
                      ),
                    })
                  }
                >
                  {effects
                    .filter((v) => v !== "none")
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              </label>
              <label className="field">
                Amount · {item.amount}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={item.amount}
                  onChange={(e) =>
                    change({
                      ...s,
                      effectStack: (s.effectStack || []).map((entry, i) =>
                        i === index
                          ? { ...entry, amount: +e.target.value }
                          : entry,
                      ),
                    })
                  }
                />
              </label>
              <div className="field-grid">
                {(["from", "to"] as const).map((k) => (
                  <label className="field" key={k}>
                    {k} (s)
                    <input
                      type="number"
                      min="0"
                      max="600"
                      value={item[k] ?? ""}
                      onChange={(e) =>
                        change({
                          ...s,
                          effectStack: (s.effectStack || []).map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  [k]:
                                    e.target.value === ""
                                      ? undefined
                                      : +e.target.value,
                                }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="candidate-actions">
                <button
                  type="button"
                  className="tool"
                  disabled={index === 0}
                  onClick={() => {
                    const list = [...(s.effectStack || [])];
                    [list[index - 1], list[index]] = [list[index], list[index - 1]];
                    change({ ...s, effectStack: list });
                  }}
                >
                  Raise
                </button>
                <button
                  type="button"
                  className="tool"
                  onClick={() =>
                    change({
                      ...s,
                      effectStack: (s.effectStack || []).filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <label className="field">
            Legacy single effect
            <select
              value={grade.effect}
              onChange={(e) =>
                change({
                  ...s,
                  grade: {
                    ...grade,
                    effect: e.target.value as typeof grade.effect,
                  },
                })
              }
            >
              {effects.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="field-grid">
            {(["from", "to"] as const).map((k) => (
              <label className="field" key={k}>
                Effect {k} (s)
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={grade[k] ?? ""}
                  onChange={(e) =>
                    change({
                      ...s,
                      grade: {
                        ...grade,
                        [k]:
                          e.target.value === "" ? undefined : +e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          {(Object.keys(gradeRanges) as (keyof typeof gradeRanges)[]).map(
            (k) => (
              <label className="field" key={k}>
                {k} · {grade[k]}
                <input
                  type="range"
                  min={gradeRanges[k][0]}
                  max={gradeRanges[k][1]}
                  step={k === "hue" ? 1 : 0.01}
                  value={grade[k]}
                  onChange={(e) =>
                    change({ ...s, grade: { ...grade, [k]: +e.target.value } })
                  }
                />
              </label>
            ),
          )}
        </>
      )}
      <RenderPreview
        settings={s}
        project={project}
        clip={clip}
        start={start}
        end={end}
        playhead={playhead}
        compare
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
