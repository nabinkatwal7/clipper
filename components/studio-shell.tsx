"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PanelsTopLeft,
  FolderClosed,
  Library,
  Scissors,
  Captions,
  ScanText,
  Image as ImageIcon,
  ListVideo,
  CalendarDays,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  Workflow,
  SlidersHorizontal,
  Menu,
  HardDrive,
  Cpu,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { useStudioEvents } from "./use-studio-events";
import { Modal } from "./modal";
export const sections = [
  [
    "Workspace",
    [
      ["Overview", PanelsTopLeft],
      ["New project", Plus],
      ["Projects", FolderClosed],
      ["Clip library", Library],
      ["Assets", FolderClosed],
      ["Discover", Search],
    ],
  ],
  [
    "Creation",
    [
      ["Video editor", Scissors],
      ["Compilations", ListVideo],
      ["Transcript explorer", ScanText],
      ["Subtitle studio", Captions],
      ["Thumbnail studio", ImageIcon],
    ],
  ],
  [
    "Automation",
    [
      ["Streamers", Cpu],
      ["Processing queue", ListVideo],
      ["Automatic clipping", Workflow],
      ["Workflow builder", Workflow],
    ],
  ],
  [
    "Management",
    [
      ["Production desk", SlidersHorizontal],
      ["Content calendar", CalendarDays],
      ["Branding", SlidersHorizontal],
      ["Storage", HardDrive],
      ["Backup & recovery", HardDrive],
    ],
  ],
] as const;
import {loadWorkspaceStyle} from "./workspace-preferences";
export function StudioShell({
  page,
  go,
  projects,
  onProject,
  onClip,
  create,
  setup,
  ollama,
  children,
}: {
  page: string;
  go: (p: string) => void;
  projects: Project[];
  onProject: (id: string) => void;
  onClip: (p: string, c: string) => void;
  create: () => void;
  setup: () => void;
  ollama?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [light, setLight] = useState(false),
    [dialog, setDialog] = useState(""),
    [activityFilter, filterActivity] = useState("all"),
    [activityMsg, activityNote] = useState(""),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0),
    [hidden, setHidden] = useState<string[]>([]);
  const [shortcut,setShortcut]=useState("k");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const restore=()=>{loadWorkspaceStyle();setShortcut(localStorage.getItem("studio-command-key")||"k");setCollapsed(localStorage.getItem("studio-sidebar")==="compact")};
    restore();window.addEventListener("studio-arrangement",restore);
    setLight(localStorage.getItem("studio-theme") === "light");return()=>window.removeEventListener("studio-arrangement",restore);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);
  function theme() {
    setLight(!light);
    localStorage.setItem("studio-theme", light ? "dark" : "light");
  }
  function palette() {
    setQuery("");
    setIndex(0);
    setDialog("search");
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === (localStorage.getItem("studio-command-key")||"k") &&
        !document.querySelector("[aria-modal=true]")
      ) {
        e.preventDefault();
        palette();
      }
      if (e.key === "Escape") setDrawer(false);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (dialog === "search") input.current?.focus();
  }, [dialog]);
  const navigate = (p: string) => {
    go(p);
    setDrawer(false);
  };
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (dialog === "search")
      try {
        setChannels(
          JSON.parse(localStorage.getItem("studio-channels") || "[]"),
        );
      } catch {}
  }, [dialog]);
  const commands = [
    ...channels.map((c) => ({
      name: c.name,
      kind: "Streamer",
      run: () => {
        sessionStorage.setItem("studio-channel", c.id);
        navigate("Streamers");
      },
    })),
    {
      name: "Search transcripts",
      kind: "Action",
      run: () => navigate("Transcript explorer"),
    },
    { name: "Ollama settings", kind: "Settings", run: setup },
    { name: "New project", kind: "Action", run: create },
    { name: "Change theme", kind: "Action", run: theme },
    { name: "Local settings", kind: "Settings", run: setup },
    ...sections.flatMap(([, items]) =>
      items.map(([name]) => ({
        name,
        kind: "Page",
        run: () => (name === "New project" ? create() : navigate(name)),
      })),
    ),
    ...projects.flatMap((p) => [
      { name: p.title, kind: "Project", run: () => onProject(p.id) },
      ...p.clips.map((c) => ({
        name: c.title,
        kind: "Clip",
        run: () => onClip(p.id, c.id),
      })),
    ]),
  ];
  const matches = commands
    .filter((c) => {
      const hay = c.name.toLowerCase();
      let at = -1;
      return [...query.trim().toLowerCase()].every(
        (ch) => (at = hay.indexOf(ch, at + 1)) >= 0,
      );
    })
    .slice(0, 40);
  const active = projects.filter((p) =>
    ["processing", "queued"].includes(p.status),
  ).length;
  const events = useStudioEvents(projects);
  return (
    <div
      className={`studio ${collapsed ? "compact" : ""} ${drawer ? "drawer-open" : ""}`}
    >
      {drawer && (
        <button
          className="drawer-shade"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className="studio-side">
        <div className="studio-logo">
          <span className="logo-glyph">
            <i />
            <i />
            <i />
          </span>
          <strong>
            Clipper <b>AI</b>
          </strong>
          <button
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="desktop-collapse"
            onClick={() => {
              setCollapsed(!collapsed);
              localStorage.setItem(
                "studio-sidebar",
                collapsed ? "full" : "compact",
              );
            }}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
        </div>
        <nav aria-label="Studio navigation">
          {sections.map(([group, items]) => (
            <section key={group}>
              <button
                className="nav-group"
                aria-expanded={!hidden.includes(group)}
                onClick={() =>
                  setHidden(
                    hidden.includes(group)
                      ? hidden.filter((g) => g !== group)
                      : [...hidden, group],
                  )
                }
              >
                {group}
                <ChevronDown size={12} />
              </button>
              {(!hidden.includes(group) || collapsed) &&
                items.map(([label, Icon]) => (
                  <button
                    title={label}
                    key={label}
                    aria-current={page === label ? "page" : undefined}
                    className={`nav-item ${page === label ? "current" : ""}`}
                    onClick={() => {
                      if (label === "New project") {
                        setDrawer(false);
                        create();
                      } else navigate(label);
                    }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                    {label === "Processing queue" && active > 0 && (
                      <small>{active}</small>
                    )}
                  </button>
                ))}
            </section>
          ))}
        </nav>
        <div className="side-foot">
          <button className="nav-item" title="Local settings" onClick={setup}>
            <Settings2 size={16} />
            <span>Settings</span>
          </button>
          <button
            className="engine"
            title="Check local dependencies"
            onClick={setup}
          >
            <Cpu size={18} />
            <span>
              <strong>Local engine</strong>
              <small>
                {ollama === undefined
                  ? "Checking Ollama…"
                  : ollama
                    ? "Ollama connected"
                    : "Ollama unavailable"}
              </small>
            </span>
            <i className={ollama ? "online" : ""} />
          </button>
          <small className="build-version">Clipper Studio · v1.0</small>
        </div>
      </aside>
      <div className="studio-body">
        <header className="studio-bar">
          <button
            className="mobile-menu icon-button"
            title="Navigation"
            aria-label="Navigation"
            onClick={() => setDrawer(!drawer)}
          >
            <Menu size={18} />
          </button>
          <span className="crumb">
            <Workflow size={15} /> Studio <ChevronRight size={13} />
            <strong>{page}</strong>
          </span>
          <div className="bar-tools">
            {active > 0 && (
              <button
                className="queue-indicator"
                title="Open processing queue"
                onClick={() => navigate("Processing queue")}
              >
                <ListVideo size={14} />
                {active} active
              </button>
            )}
            <button
              className="command-key"
              onClick={palette}
              title={"Search studio (Ctrl+"+shortcut.toUpperCase()+")"}
            >
              <Search size={15} />
              <span>Search studio</span>
              <kbd>Ctrl {shortcut.toUpperCase()}</kbd>
            </button>
            <button
              title="Activity history"
              aria-label="Activity history"
              onClick={() => setDialog("history")}
            >
              <Bell size={16} />
            </button>
            <button
              title="Change theme"
              aria-label="Change theme"
              onClick={theme}
            >
              {light ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="button primary" onClick={create}>
              <Plus size={15} /> New project
            </button>
          </div>
        </header>
        {children}
      </div>
      {dialog && (
        <Modal
          title={dialog === "search" ? "Search studio" : "Activity history"}
          onClose={() => setDialog("")}
        >
          <div className="library-body">
            {dialog === "search" ? (
              <>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    ref={input}
                    placeholder="Search pages, commands, projects and clips"
                    aria-label="Find command"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        const n = Math.max(
                          0,
                          Math.min(
                            matches.length - 1,
                            index + (e.key === "ArrowDown" ? 1 : -1),
                          ),
                        );
                        setIndex(n);
                        document
                          .getElementById("command-" + n)
                          ?.scrollIntoView({ block: "nearest" });
                      }
                      if (e.key === "Enter" && matches[index]) {
                        e.preventDefault();
                        setDialog("");
                        matches[index].run();
                      }
                    }}
                  />
                </label>
                <div className="command-results">
                  {matches.map((c, i) => (
                    <button
                      key={i}
                      id={"command-" + i}
                      className={i === index ? "current" : ""}
                      onClick={() => {
                        setDialog("");
                        c.run();
                      }}
                    >
                      <span>{c.name}</span>
                      <small>{c.kind}</small>
                    </button>
                  ))}
                  {!matches.length && (
                    <p>No matches. Try a project or clip title.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <label className="field">
                  Show jobs
                  <select
                    value={activityFilter}
                    onChange={(e) => filterActivity(e.target.value)}
                  >
                    {[
                      "all",
                      "processing",
                      "queued",
                      "ready",
                      "cancelled",
                      "error",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                {projects
                  .filter(
                    (p) =>
                      activityFilter === "all" || p.status === activityFilter,
                  )
                  .map((p) => (
                    <details className="clip-context" key={p.id}>
                      <summary>
                        {p.title} · {p.status}
                      </summary>
                      <p>
                        {p.stage} · {p.detail}
                      </p>
                      {p.error && <p role="alert">{p.error}</p>}
                      {Object.entries(p.progress || {}).map(([key, step]) => (
                        <p key={key}>
                          {key} · {step.detail}
                        </p>
                      ))}
                      {["queued", "processing", "error", "cancelled"].includes(
                        p.status,
                      ) && (
                        <button
                          className="tool"
                          onClick={async () => {
                            const action = ["queued", "processing"].includes(
                              p.status,
                            )
                              ? "cancel"
                              : "generate";
                            try {
                              const resp = await fetch("/api/" + action, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  project: p.id,
                                  settings: p.settings,
                                }),
                              });
                              if (!resp.ok)
                                throw Error((await resp.json()).error);
                              activityNote(
                                action === "cancel"
                                  ? "Cancellation requested."
                                  : "Generation queued.",
                              );
                            } catch (e) {
                              activityNote(String(e));
                            }
                          }}
                        >
                          {["queued", "processing"].includes(p.status)
                            ? "Cancel job"
                            : "Retry generation"}
                        </button>
                      )}
                    </details>
                  ))}
                <p role="status">{activityMsg}</p>
                <h3>Recent activity</h3>
                {events.length ? (
                  events.map((event, i) => (
                    <button
                      className="event-row"
                      key={i}
                      disabled={!projects.some((p) => p.id === event.project)}
                      onClick={() => {
                        setDialog("");
                        onProject(event.project);
                      }}
                    >
                      <strong>{event.title}</strong>
                      <small>
                        {event.detail} · {new Date(event.at).toLocaleString()}
                      </small>
                    </button>
                  ))
                ) : (
                  <p>Import a video to see project activity here.</p>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
