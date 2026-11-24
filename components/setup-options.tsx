"use client";
import {studioStorage} from "@/lib/client-storage";
import {WorkspacePreferences} from "./workspace-preferences";
import { useEffect, useState } from "react";
import type { diagnostics } from "@/lib/diagnostics";
export function SetupOptions() {
  const [info, setInfo] = useState<Awaited<
      ReturnType<typeof diagnostics>
    > | null>(null),
    [model, select] = useState(""),
    [vision, setVision] = useState(""),
    [embedding, choose] = useState(""),
    [message, note] = useState(""),
    [busy, working] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/diagnostics", { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("Diagnostics unavailable");
        setInfo(await r.json());
        select(studioStorage.getItem("studio-text-model") || "");
        setVision(studioStorage.getItem("studio-vision-model") || "");
        choose(studioStorage.getItem("studio-embedding-model") || "");
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) note(String(e));
      });
    return () => ctrl.abort();
  }, []);
  async function testPipeline() {
    working(true);
    try {
      const r = await fetch("/api/pipeline-test", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      note(
        "Encoded and decoded " +
          d.width +
          " × " +
          d.height +
          " video with audio.",
      );
    } catch (e) {
      note(String(e));
    } finally {
      working(false);
    }
  }
  return (
    <section>
      <WorkspacePreferences/><h3>Processing setup</h3>
      {info && (
        <>
          <p>
            {info.diskFreeBytes === null
              ? "Storage information unavailable"
              : (info.diskFreeBytes / 1024 ** 3).toFixed(1) +
                " GiB available"}{" "}
            · {info.encoders.join(", ") || "No supported encoder detected"}
          </p>
          <label className="field">
            Default text model
            <select
              value={model}
              onChange={(e) => {
                select(e.target.value);
                studioStorage.setItem("studio-text-model", e.target.value);
              }}
            >
              <option value="">Application default</option>
              {info.models
                .filter((m: { capabilities: string[] }) =>
                  m.capabilities.includes("completion"),
                )
                .map((m: { name: string }) => (
                  <option key={m.name}>{m.name}</option>
                ))}
            </select>
          </label>
          <label className="field">
            Default vision model
            <select
              value={vision}
              onChange={(e) => {
                setVision(e.target.value);
                studioStorage.setItem("studio-vision-model", e.target.value);
              }}
            >
              <option value="">Skip vision setup</option>
              {info.models
                .filter((m: { capabilities: string[] }) =>
                  m.capabilities.includes("vision"),
                )
                .map((m: { name: string }) => (
                  <option key={m.name}>{m.name}</option>
                ))}
            </select>
          </label>
          <label className="field">
            Default embedding model
            <select
              value={embedding}
              onChange={(e) => {
                choose(e.target.value);
                studioStorage.setItem("studio-embedding-model", e.target.value);
              }}
            >
              <option value="">Skip semantic search setup</option>
              {info.models
                .filter((m: { capabilities: string[] }) =>
                  m.capabilities.includes("embedding"),
                )
                .map((m: { name: string }) => (
                  <option key={m.name}>{m.name}</option>
                ))}
            </select>
          </label>
        </>
      )}
      <button className="tool" disabled={busy} onClick={testPipeline}>
        {busy ? "Testing encode and decode…" : "Test processing pipeline"}
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
