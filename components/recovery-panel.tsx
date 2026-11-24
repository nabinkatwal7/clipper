"use client";
import {studioStorage} from "@/lib/client-storage";
import { browserKeys, browserSettings } from "@/lib/browser-settings";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
export function RecoveryPanel({ projects }: { projects: Project[] }) {
  const [restoreSettings, pendingRestore] = useState<Record<
    string,
    string
  > | null>(null);
  const [project, setP] = useState(""),
    [media, setMedia] = useState(true),
    [rows, setRows] = useState<
      {
        id: string;
        created: string;
        media: boolean;
        projects: number;
        bytes: number;
      }[]
    >([]),
    [busy, setBusy] = useState(false),
    [message, msg] = useState("");
  async function refresh() {
    const r = await fetch("/api/backups");
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setRows(d);
  }
  useEffect(() => {
    void refresh().catch((e) => msg(String(e)));
  }, []);
  async function run(action: string, id?: string) {
    setBusy(true);
    msg("Verifying local files…");
    try {
      const r = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          project,
          media,
          browser:
            action === "create" && !project
              ? Object.fromEntries(
                  studioStorage.keys()
                    .filter(
                      (k) =>
                        browserKeys.some((v) => v === k) ||
                        /^highlight-[a-f0-9-]{36}$/.test(k),
                    )
                    .map((k) => [k, studioStorage.getItem(k)]),
                )
              : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "restore") pendingRestore(d.browser || null);
      msg(
        d.folder
          ? (action === "restore"
              ? "Restored workspace: "
              : "Backup folder: ") + d.folder
          : d.verified + " files verified.",
      );
      await refresh();
    } catch (e) {
      msg(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="tool-layout">
        <section>
          <h2>Local backup</h2>
          <label className="field">
            Scope
            <select value={project} onChange={(e) => setP(e.target.value)}>
              <option value="">Complete filesystem workspace</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={media}
              onChange={(e) => setMedia(e.target.checked)}
            />
            Include source media, rendered clips and asset files
          </label>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => run("create")}
          >
            Create backup
          </button>
        </section>
        <section>
          <h2>Move or recover a workspace</h2>
          <p>
            Copy the backup folder into the destination studio’s storage/backups
            directory. Restore validates its checksums and writes a fresh
            workspace. Set CLIPPER_STORAGE_DIR to the restored folder and
            restart the app.
          </p>
          <p className="hint">
            Metadata-only snapshots require the original media files. Workspace
            backups include this browser’s brand profiles, calendar and studio
            preferences.
          </p>
        </section>
      </div>
      <p role="status">{message}</p>
      {restoreSettings && (
        <button
          className="tool"
          onClick={() => {
            try {
              for (const [k, v] of Object.entries(
                browserSettings(restoreSettings),
              ))
                studioStorage.setItem(k, v);
              pendingRestore(null);
              msg("Preferences restored. Reload to apply them.");
            } catch (e) {
              msg(String(e));
            }
          }}
        >
          Apply restored preferences to this browser
        </button>
      )}
      {rows.map((r) => (
        <div className="schedule-row" key={r.id}>
          <span>
            {new Date(r.created).toLocaleString()} · {r.projects} projects ·{" "}
            {(r.bytes / 1048576).toFixed(1)} MB
          </span>
          <button
            className="tool"
            disabled={busy}
            onClick={() => run("validate", r.id)}
          >
            Validate
          </button>
          <button
            className="tool"
            disabled={busy}
            onClick={() => run("restore", r.id)}
          >
            Restore to new folder
          </button>
        </div>
      ))}
    </>
  );
}
