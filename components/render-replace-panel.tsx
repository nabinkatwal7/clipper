"use client";
import { useEffect, useState } from "react";
import { Replace, Undo2 } from "lucide-react";
import type { Settings } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function RenderReplacePanel({
  projectId,
  clipId,
  settings,
  length,
  onApply,
}: {
  projectId: string;
  clipId: string;
  settings: Settings;
  length: number;
  onApply: (s: Settings) => void;
}) {
  const [active, setActive] = useState(false);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function refresh() {
    fetch(
      `/api/render-replace?project=${encodeURIComponent(projectId)}&clip=${encodeURIComponent(clipId)}`,
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Status failed");
        setActive(!!data.record?.active);
        setStale(!!data.stale);
      })
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, [projectId, clipId, settings.composition]);

  async function run(op?: "restore") {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await fetch("/api/render-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: projectId,
          clip: clipId,
          settings,
          length,
          op,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Render replace failed");
      onApply(data.settings);
      setMsg(
        op === "restore"
          ? "Original composition restored."
          : "Composition baked to an intermediate asset.",
      );
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="render-replace">
      <header className="panel-head">
        <div>
          <h3>Render and replace</h3>
          <p>
            Bake complex layers into an intermediate video. The editable
            composition is preserved for restore. Invalidated if dependencies
            change.
          </p>
        </div>
        {active && (
          <Badge variant={stale ? "warning" : "success"}>
            {stale ? "Stale bake" : "Active bake"}
          </Badge>
        )}
      </header>
      <div className="bar-tools">
        <Button
          size="sm"
          disabled={busy || active || !(settings.composition?.tracks?.length)}
          onClick={() => void run()}
        >
          <Replace size={14} /> {busy ? "Baking…" : "Render & replace"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !active}
          onClick={() => void run("restore")}
        >
          <Undo2 size={14} /> Restore original
        </Button>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
