"use client";
import { useState, useEffect } from "react";
import { defaults, type Settings } from "@/lib/types";
import { SubtitleSettings } from "./clip-settings";
type Profile = { name: string; style: Partial<Settings> };
function profiles(): Profile[] {
  try {
    return JSON.parse(localStorage.getItem("clipper-brands") || "[]");
  } catch {
    return [];
  }
}
export function ProfilePicker({
  apply,
}: {
  apply: (s: Partial<Settings>) => void;
}) {
  const [data, setData] = useState<Profile[]>([]);
  useEffect(() => setData(profiles()), []);
  return data.length ? (
    <label className="field">
      Branding profile
      <select
        defaultValue=""
        onChange={(e) => {
          const p = data.find((p) => p.name === e.target.value);
          if (p) apply(p.style);
        }}
      >
        <option value="">Choose a saved profile</option>
        {data.map((p) => (
          <option key={p.name}>{p.name}</option>
        ))}
      </select>
    </label>
  ) : null;
}
export function Branding() {
  const [s, set] = useState(defaults),
    [name, setName] = useState(""),
    [data, setData] = useState<Profile[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => setData(profiles()), []);
  function save() {
    const {
      captions,
      style,
      font,
      fontSize,
      captionColor,
      captionPosition,
      outline,
      shadow,
    } = s;
    const next = [
      ...data.filter((p) => p.name !== name.trim()),
      {
        name: name.trim(),
        style: {
          captions,
          style,
          font,
          fontSize,
          captionColor,
          captionPosition,
          outline,
          shadow,
        },
      },
    ];
    localStorage.setItem("clipper-brands", JSON.stringify(next));
    setData(next);
    setMessage("Profile saved. It is available in new project options.");
  }
  return (
    <div className="tool-layout">
      <section>
        <h2>Caption profile</h2>
        <label className="field">
          Profile name
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <SubtitleSettings value={s} onChange={set} />
        <button
          className="button primary"
          disabled={!name.trim()}
          onClick={save}
        >
          Save profile
        </button>
        <p role="status">{message}</p>
      </section>
      <section>
        <h2>Saved profiles</h2>
        {data.length ? (
          data.map((p) => (
            <button
              className="event-row"
              key={p.name}
              onClick={() => {
                setName(p.name);
                set({ ...defaults, ...p.style });
              }}
            >
              {p.name}
            </button>
          ))
        ) : (
          <p className="hint">
            Save a profile to reuse subtitle styling across projects.
          </p>
        )}
        <div
          className="caption-sample"
          style={{
            fontFamily: s.font || "Arial",
            color: s.captionColor || "white",
            fontSize: s.fontSize / 2,
            fontWeight: s.style === "minimal" ? 400 : 700,
            textShadow: "0 1px 3px black",
          }}
        >
          This is your caption style
        </div>
      </section>
    </div>
  );
}
