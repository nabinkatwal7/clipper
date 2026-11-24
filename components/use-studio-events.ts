"use client";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
type Event = { project: string; title: string; detail: string; at: string };
export function useStudioEvents(projects: Project[]) {
  const [events, setEvents] = useState<Event[]>([]),
    snapshot = useRef<Record<string, string> | null>(null);
  useEffect(() => {
    if (!projects.length) return;
    let previous = snapshot.current,
      history: Event[] = [];
    try {
      previous ??= JSON.parse(
        localStorage.getItem("studio-event-states") || "{}",
      );
      history = JSON.parse(localStorage.getItem("studio-events") || "[]");
    } catch {}
    const next: Record<string, string> = {};
    const added: Event[] = [];
    for (const p of projects) {
      next[p.id] = p.status + "/" + p.stage;
      if (previous?.[p.id] === next[p.id]) continue;
      const change = previous?.[p.id]?.split("/")[1];
      const detail =
        p.status === "ready"
          ? p.clips.length + " clips available"
          : p.status === "error"
            ? p.error || "Processing failed"
            : p.status === "cancelled"
              ? "Processing cancelled"
              : p.status === "queued"
                ? "Job queued"
                : change === "analyzing"
                  ? "Highlight analysis completed"
                  : change === "importing"
                    ? "Source imported"
                    : "";
      if (detail)
        added.push({ project: p.id, title: p.title, detail, at: p.updatedAt });
    }
    snapshot.current = next;
    localStorage.setItem("studio-event-states", JSON.stringify(next));
    const all = [...added, ...history]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 100);
    localStorage.setItem("studio-events", JSON.stringify(all));
    setEvents(all);
  }, [projects]);
  return events;
}
