"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Project } from "@/lib/types";
type Plan = Record<string, string>;
const dateKey = (d: Date) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
export function Calendar({
  projects,
  open,
}: {
  projects: Project[];
  open: (p: string, c: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date()),
    [plan, setPlan] = useState<Plan>({}),
    [filter, setFilter] = useState("all"),
    [view, setView] = useState("Month");
  useEffect(() => {
    try {
      setPlan(JSON.parse(localStorage.getItem("studio-calendar") || "{}"));
    } catch {}
  }, []);
  const [platform, setPlatform] = useState("All platforms"),
    [status, setStatus] = useState("All statuses"),
    [targets, setTargets] = useState<Record<string, string>>({}),
    [publishing, setPublishing] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      setTargets(JSON.parse(localStorage.getItem("studio-platforms") || "{}"));
      setPublishing(
        JSON.parse(localStorage.getItem("clipper-publishing") || "{}"),
      );
    } catch {}
  }, []);
  const clips = projects.flatMap((p) => p.clips.map((c) => ({ c, p })));
  const visible = clips.filter(
    ({ c }) =>
      (platform === "All platforms" ||
        targets[c.editorialId || c.id] === platform) &&
      (status === "All statuses" ||
        (publishing[c.editorialId || c.id] || "Ready") === status),
  );
  function schedule(id: string, day: string) {
    if (!clips.some(({ c }) => (c.editorialId || c.id) === id)) return;
    const next = { ...plan, [id]: day };
    setPlan(next);
    localStorage.setItem("studio-calendar", JSON.stringify(next));
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthDays = Array.from(
    {
      length:
        Math.ceil(
          (first.getDay() +
            new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
            7,
        ) * 7,
    },
    (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), 1 + i - first.getDay()),
  );
  const days =
    view === "Week"
      ? Array.from(
          { length: 7 },
          (_, i) =>
            new Date(
              month.getFullYear(),
              month.getMonth(),
              month.getDate() - month.getDay() + i,
            ),
        )
      : monthDays;
  function move(dir: number) {
    setMonth(
      view === "Week"
        ? new Date(
            month.getFullYear(),
            month.getMonth(),
            month.getDate() + dir * 7,
          )
        : new Date(month.getFullYear(), month.getMonth() + dir, 1),
    );
  }
  return (
    <>
      <div className="section-row">
        <h2>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div>
          <select
            aria-label="Calendar view"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            {["Month", "Week", "List"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className="tool"
            title="Previous period"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button className="tool" title="Next period" onClick={() => move(1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      {view !== "List" && (
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <b key={d}>{d}</b>
          ))}
          {days.map((d) => (
            <div
              key={dateKey(d)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) =>
                schedule(e.dataTransfer.getData("text/plain"), dateKey(d))
              }
            >
              <small>
                {view === "Week"
                  ? d.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : d.getDate()}
              </small>
              {visible
                .filter(({ c }) => plan[c.editorialId || c.id] === dateKey(d))
                .map(({ p, c }) => (
                  <button
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "text/plain",
                        c.editorialId || c.id,
                      )
                    }
                    onClick={() => open(p.id, c.id)}
                    key={c.id}
                  >
                    {c.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="section-row">
        <h2>Publishing schedule</h2>
        <div className="calendar-filters">
          <select
            aria-label="Filter target platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {[
              "All platforms",
              "YouTube",
              "Instagram",
              "TikTok",
              "Twitch",
              "Other",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Filter publication status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["All statuses", "Draft", "Ready", "Published"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <select
          aria-label="Schedule filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All clips</option>
          <option value="unscheduled">Unscheduled</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>
      {visible
        .filter(
          ({ c }) =>
            view !== "List" ||
            !plan[c.editorialId || c.id] ||
            plan[c.editorialId || c.id].startsWith(dateKey(month).slice(0, 7)),
        )
        .filter(
          ({ c }) =>
            filter === "all" ||
            (filter === "scheduled") === !!plan[c.editorialId || c.id],
        )
        .map(({ c, p }) => (
          <div
            className="schedule-row"
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData("text/plain", c.editorialId || c.id)
            }
            key={c.id}
          >
            <button onClick={() => open(p.id, c.id)}>{c.title}</button>
            <select
              aria-label={"Target platform for " + c.title}
              value={targets[c.editorialId || c.id] || ""}
              onChange={(e) => {
                const next = {
                  ...targets,
                  [c.editorialId || c.id]: e.target.value,
                };
                setTargets(next);
                localStorage.setItem("studio-platforms", JSON.stringify(next));
              }}
            >
              <option value="">Choose platform</option>
              {["YouTube", "Instagram", "TikTok", "Twitch", "Other"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
            <input
              type="date"
              aria-label={"Schedule " + c.title}
              value={plan[c.editorialId || c.id] || ""}
              onChange={(e) => schedule(c.editorialId || c.id, e.target.value)}
            />
          </div>
        ))}
    </>
  );
}
