"use client";
import { useStudioLocale } from "./studio-locale";
import { studioStorage } from "@/lib/client-storage";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
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
  Menu,
  Cpu,
  ListVideo,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { useStudioEvents } from "./use-studio-events";
import { Modal } from "./modal";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "./ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Separator } from "./ui/separator";
import {
  sections,
  navSections,
  sectionForPage,
  type NavSection,
} from "./workspace-nav";
export { sections };
import { loadWorkspaceStyle } from "./workspace-preferences";
export function StudioShell({
  page,
  go,
  projects,
  onProject,
  onClip,
  create,
  setup,
  ollama,
  account,
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
  account: ReactNode;
  children: ReactNode;
}) {
  const { t } = useStudioLocale();
  const [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [light, setLight] = useState(false),
    [dialog, setDialog] = useState(""),
    [activityFilter, filterActivity] = useState("all"),
    [activityMsg, activityNote] = useState(""),
    [query, setQuery] = useState(""),
    [wsOpen, setWsOpen] = useState(false),
    [activeSection, setActiveSection] = useState<NavSection>(
      () => sectionForPage(page) || navSections[0],
    );
  const [shortcut, setShortcut] = useState("k");
  const input = useRef<HTMLInputElement>(null);
  const wsMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const next = sectionForPage(page);
    if (next) setActiveSection(next);
  }, [page]);
  useEffect(() => {
    const restore = () => {
      loadWorkspaceStyle();
      setShortcut(studioStorage.getItem("studio-command-key") || "k");
      setCollapsed(studioStorage.getItem("studio-sidebar") === "compact");
    };
    restore();
    window.addEventListener("studio-arrangement", restore);
    setLight(studioStorage.getItem("studio-theme") === "light");
    return () => window.removeEventListener("studio-arrangement", restore);
  }, []);
  useEffect(() => {
    if (!wsOpen) return;
    function onDoc(e: MouseEvent) {
      if (wsMenu.current && !wsMenu.current.contains(e.target as Node))
        setWsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setWsOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [wsOpen]);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);
  function theme() {
    setLight(!light);
    studioStorage.setItem("studio-theme", light ? "dark" : "light");
  }
  function palette() {
    setQuery("");
    setDialog("search");
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() ===
          (studioStorage.getItem("studio-command-key") || "k") &&
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
          JSON.parse(studioStorage.getItem("studio-channels") || "[]"),
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
      const hay = (
        c.name +
        " " +
        (c.kind === "Page" || c.kind === "Action" ? t(c.name) : "")
      ).toLowerCase();
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
    <TooltipProvider delayDuration={250}>
      <div
        className={`studio ${collapsed ? "compact" : ""} ${drawer ? "drawer-open" : ""}`}
      >
        <a
          className="studio-skip"
          href="#studio-content"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("studio-content")?.focus();
          }}
        >
          Skip to workspace content
        </a>
        {drawer && (
          <button
            className="drawer-shade"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
        )}
        <aside className="studio-side">
          <nav className="primary-workspaces" aria-label="Primary workspaces">
            {navSections.map((group) => {
              const first = group.items[0];
              if (!first) return null;
              return (
                <Tooltip key={group.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={
                        t(group.label) +
                        (t(group.label) === group.label ? " workspace" : "")
                      }
                      aria-current={
                        group.id === activeSection.id ? "true" : undefined
                      }
                      onClick={() => {
                        setActiveSection(group);
                        setWsOpen(false);
                        if (collapsed && !drawer) {
                          setCollapsed(false);
                          studioStorage.setItem("studio-sidebar", "full");
                        }
                        if (group.id !== activeSection.id) go(first.page);
                      }}
                    >
                      <group.Icon size={17} strokeWidth={1.8} />
                      <span>{t(group.label)}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {t(group.description)}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
          <div className="studio-logo">
            <span className="logo-glyph" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {!collapsed && (
              <strong>
                Clipper <b>Studio</b>
              </strong>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="desktop-collapse"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={() => {
                    setCollapsed(!collapsed);
                    setWsOpen(false);
                    studioStorage.setItem(
                      "studio-sidebar",
                      collapsed ? "full" : "compact",
                    );
                  }}
                >
                  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="workspace-picker" ref={wsMenu}>
            {(() => {
              const WsIcon = activeSection.Icon;
              return (
                <button
                  type="button"
                  className="workspace-current"
                  aria-expanded={wsOpen}
                  title={t(activeSection.label)}
                  onClick={() => setWsOpen((o) => !o)}
                >
                  <WsIcon size={16} strokeWidth={1.75} />
                  {!collapsed && (
                    <>
                      <span className="workspace-current-copy">
                        <strong>{t(activeSection.label)}</strong>
                        <small>{t(activeSection.description)}</small>
                      </span>
                      <ChevronDown
                        size={14}
                        className={
                          wsOpen
                            ? "workspace-chevron open"
                            : "workspace-chevron"
                        }
                      />
                    </>
                  )}
                </button>
              );
            })()}
            {wsOpen && (
              <div
                className="workspace-menu"
                role="group"
                aria-label="Workspaces"
              >
                {navSections.map((g) => {
                  const Icon = g.Icon;
                  const current = activeSection.id === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-current={current ? "true" : undefined}
                      className={`workspace-option ${current ? "current" : ""}`}
                      onClick={() => {
                        setActiveSection(g);
                        studioStorage.setItem("studio-workspace", g.id);
                        setWsOpen(false);
                        const first = g.items[0];
                        if (!first) return;
                        if (first.page === "New project") {
                          setDrawer(false);
                          create();
                        } else navigate(first.page);
                      }}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      <span>
                        <strong>{t(g.label)}</strong>
                        <small>{t(g.description)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <nav className="studio-nav" aria-label="Studio pages">
            {!collapsed && (
              <p className="nav-group" id="nav-pages-label">
                {t(activeSection.label)}
              </p>
            )}
            {activeSection.items.map((item) => {
              const { Icon } = item;
              const current = page === item.page;
              const btn = (
                <button
                  type="button"
                  title={t(item.label)}
                  aria-current={current ? "page" : undefined}
                  className={`nav-item ${current ? "current" : ""}`}
                  onClick={() => {
                    if (item.page === "New project") {
                      setDrawer(false);
                      create();
                    } else navigate(item.page);
                  }}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span>{t(item.label)}</span>
                  {item.page === "Processing queue" && active > 0 && (
                    <small>{active}</small>
                  )}
                </button>
              );
              if (collapsed) {
                return (
                  <Tooltip key={item.page}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right">
                      {t(item.label)}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={item.page}>{btn}</div>;
            })}
          </nav>

          <div className="side-foot">
            <button className="nav-item" title="Local settings" onClick={setup}>
              <Settings2 size={16} strokeWidth={1.75} />
              <span>{t("Settings")}</span>
            </button>
            <button
              className="engine"
              title="Check local dependencies"
              onClick={setup}
            >
              <Cpu size={18} strokeWidth={1.75} />
              <span>
                <strong>{t("Local engine")}</strong>
                <small>
                  {ollama === undefined
                    ? t("Checking Ollama…")
                    : ollama
                      ? t("Ollama connected")
                      : t("Ollama unavailable")}
                </small>
              </span>
              <i className={ollama ? "online" : ""} />
            </button>
            {!collapsed && (
              <small className="build-version">Clipper Studio · v1.0</small>
            )}
          </div>
        </aside>
        <div className="studio-body">
          <header className="studio-bar">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label={t("Navigation")}
              onClick={() => setDrawer(!drawer)}
            >
              <Menu size={18} />
            </Button>
            <span className="crumb">
              <Workflow size={15} /> {t(activeSection.label)}{" "}
              <ChevronRight size={13} />
              <strong>
                {t(
                  activeSection.items.find((i) => i.page === page)?.label ||
                    page,
                )}
              </strong>
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
              <Button
                variant="outline"
                size="sm"
                className="command-key"
                onClick={palette}
                title={"Search studio (Ctrl+" + shortcut.toUpperCase() + ")"}
              >
                <Search size={15} />
                <span>{t("Search studio")}</span>
                <kbd>Ctrl {shortcut.toUpperCase()}</kbd>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Activity history"
                    onClick={() => setDialog("history")}
                  >
                    <Bell size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Activity history</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("Change theme")}
                    onClick={theme}
                  >
                    {light ? <Moon size={16} /> : <Sun size={16} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle theme</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="mx-1 h-6" />
              <Button
                size="sm"
                className="primary studio-create"
                aria-label={t("New project")}
                onClick={create}
              >
                <Plus size={15} /> <span>{t("New project")}</span>
              </Button>
              {account}
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
                <Command label="Search studio" shouldFilter={false} loop>
                  <CommandInput
                    ref={input}
                    aria-label="Find command"
                    placeholder={t(
                      "Search pages, commands, projects and clips",
                    )}
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList className="command-results">
                    <CommandEmpty>
                      No matches. Try a project or clip title.
                    </CommandEmpty>
                    {matches.map((command, i) => (
                      <CommandItem
                        key={i}
                        value={command.kind + "-" + i + "-" + command.name}
                        onSelect={() => {
                          setDialog("");
                          command.run();
                        }}
                      >
                        <span>
                          {command.kind === "Page" || command.kind === "Action"
                            ? t(command.name)
                            : command.name}
                        </span>
                        <small>{command.kind}</small>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
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
                        {[
                          "queued",
                          "processing",
                          "error",
                          "cancelled",
                        ].includes(p.status) && (
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
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
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
    </TooltipProvider>
  );
}
