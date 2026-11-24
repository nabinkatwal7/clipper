"use client";
import { ClipPlan } from "./clip-plan";
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
  const [notes, setNotes] = useState<Record<string, string>>({}),
    [weekday, setWeekday] = useState(1),
    [brand, setBrand] = useState<Record<string, string>>({}),
    [brands, setBrands] = useState<string[]>([]);
  useEffect(() => {
    try {
      setNotes(
        JSON.parse(localStorage.getItem("studio-publishing-notes") || "{}"),
      );
      setBrand(
        JSON.parse(localStorage.getItem("studio-planned-brands") || "{}"),
      );
      setBrands(
        JSON.parse(localStorage.getItem("clipper-brands") || "[]").map(
          (p: { name: string }) => p.name,
        ),
      );
      setWeekday(Number(localStorage.getItem("studio-weekday") ?? 1));
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
  function mark(id: string, status: string) {
    if (!clips.some(({ c }) => (c.editorialId || c.id) === id)) return;
    const next = { ...publishing, [id]: status };
    setPublishing(next);
    localStorage.setItem("clipper-publishing", JSON.stringify(next));
  }
  function nextSlot(id: string) {
    const used = new Set(Object.values(plan));
    const day = new Date();
    day.setDate(day.getDate() + ((weekday - day.getDay() + 7) % 7));
    while (used.has(dateKey(day))) day.setDate(day.getDate() + 7);
    schedule(id, dateKey(day));
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
    view === "Day"
      ? [month]
      : view === "Week"
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
      view === "Day"
        ? new Date(month.getFullYear(), month.getMonth(), month.getDate() + dir)
        : view === "Week"
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
            {["Month", "Week", "Day", "Kanban", "List"].map((v) => (
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
      {view === "Kanban" && (
        <div className="publishing-board">
          {["Draft", "Ready", "Published"].map((column) => (
            <section
              key={column}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => mark(e.dataTransfer.getData("text/plain"), column)}
            >
              <h3>{column}</h3>
              {visible
                .filter(
                  ({ c }) =>
                    (publishing[c.editorialId || c.id] || "Ready") === column,
                )
                .map(({ c, p }) => (
                  <button
                    className="event-row"
                    key={c.id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "text/plain",
                        c.editorialId || c.id,
                      )
                    }
                    onClick={() => open(p.id, c.id)}
                  >
                    {c.title}
                  </button>
                ))}
            </section>
          ))}
        </div>
      )}
      {view !== "List" && view !== "Kanban" && (
        <div
          className={view === "Day" ? "calendar-grid one-day" : "calendar-grid"}
        >
          {view !== "Day" &&
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
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
        <ClipPlan
          kind="calendar"
          clips={visible
            .filter(
              ({ c }) =>
                !plan[c.editorialId || c.id] &&
                publishing[c.editorialId || c.id] !== "Published",
            )
            .map((v) => v.c)}
          apply={(v) => {
            const next = { ...plan },
              used = new Set(Object.values(next)),
              day = new Date();
            day.setDate(day.getDate() + ((weekday - day.getDay() + 7) % 7));
            for (const id of v.ids) {
              const c = clips.find((v) => v.c.id === id)?.c;
              if (
                !c ||
                next[c.editorialId || id] ||
                publishing[c.editorialId || id] === "Published"
              )
                continue;
              while (used.has(dateKey(day))) day.setDate(day.getDate() + 7);
              next[c.editorialId || id] = dateKey(day);
              used.add(dateKey(day));
            }
            setPlan(next);
            localStorage.setItem("studio-calendar", JSON.stringify(next));
          }}
        />
        <label className="field">
          Weekly publishing slot
          <select
            value={weekday}
            onChange={(e) => {
              setWeekday(+e.target.value);
              localStorage.setItem("studio-weekday", e.target.value);
            }}
          >
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
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
            {plan[c.editorialId || c.id] &&
              plan[c.editorialId || c.id] < dateKey(new Date()) &&
              publishing[c.editorialId || c.id] !== "Published" && (
                <small>Past due</small>
              )}
            <details>
              <summary>Publishing details</summary>
              <label className="field">
                Status
                <select
                  value={publishing[c.editorialId || c.id] || "Ready"}
                  onChange={(e) => mark(c.editorialId || c.id, e.target.value)}
                >
                  {["Draft", "Ready", "Published"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {brands.length > 0 && (
                <label className="field">
                  Brand
                  <select
                    value={brand[c.editorialId || c.id] || ""}
                    onChange={(e) => {
                      const next = {
                        ...brand,
                        [c.editorialId || c.id]: e.target.value,
                      };
                      setBrand(next);
                      localStorage.setItem(
                        "studio-planned-brands",
                        JSON.stringify(next),
                      );
                    }}
                  >
                    <option value="">Choose brand</option>
                    {brands.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field">
                Publishing notes
                <textarea
                  value={notes[c.editorialId || c.id] || ""}
                  onChange={(e) => {
                    const next = {
                      ...notes,
                      [c.editorialId || c.id]: e.target.value,
                    };
                    setNotes(next);
                    localStorage.setItem(
                      "studio-publishing-notes",
                      JSON.stringify(next),
                    );
                  }}
                />
              </label>
              <button
                className="tool"
                onClick={() => nextSlot(c.editorialId || c.id)}
              >
                Use next weekly slot
              </button>
            </details>
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
