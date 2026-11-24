"use client";
import { useEffect, useState } from "react";

export function AccountBar({ name, role }: { name: string; role: string }) {
  const [legacy, setLegacy] = useState<{ available: boolean; projects: number; files: number } | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (role !== "owner") return;
    fetch("/api/legacy").then((r) => r.json()).then((s) => s.available && setLegacy(s)).catch(() => {});
  }, [role]);
  async function claim() {
    if (!confirm(`Move ${legacy?.projects} existing project(s) (${legacy?.files} files) into your account? A metadata backup is made first and no media is deleted.`)) return;
    setNote("Claiming…");
    const r = await fetch("/api/legacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "claim" }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) location.reload();
    else setNote(j.error || "Claim failed.");
  }
  return (
    <div className="account-bar">
      {legacy && (
        <button onClick={claim} title="Existing projects from before accounts were added">
          Claim {legacy.projects} existing project{legacy.projects === 1 ? "" : "s"}
        </button>
      )}
      {note && <span role="status">{note}</span>}
      <span>
        {name} · {role}
      </span>
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          location.assign("/login");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
