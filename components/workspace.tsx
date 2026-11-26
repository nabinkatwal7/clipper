"use client";
import {studioStorage} from "@/lib/client-storage";
import { useCallback, useEffect, useState } from "react";
import {
  Play,
  Plus,
  Download,
  ChevronRight,
  ChevronLeft,
  Ellipsis,
  Scissors,
  Trash2,
  Sparkles,
  Check,
  LoaderCircle,
  Film,
  Search,
  RefreshCw,
  X,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Modal } from "./modal";
import { CreateClips } from "./create-clips";
import { VideoEditor } from "./video-editor";
import { PostCaption } from "./post-caption";
import { JobProgress } from "./job-progress";
import type { Project, Clip } from "@/lib/types";
import { Channels, useChannelMonitor } from "./channels";
import { RecoveryPanel } from "./recovery-panel";
import { LiveClipping } from "./live-clipping";
import { WorkflowPanel } from "./workflow-panel";
import { DiscoverySearch } from "./discovery-search";
import { CompilationBuilder } from "./compilation-builder";
import { AssetLibrary } from "./asset-library";
import { ProductionDesk } from "./production-desk";
import { Branding } from "./brand-profiles";
import { StudioShell, sections } from "./studio-shell";
import { Overview, ProjectRows, MediaLibrary } from "./studio-media";
import { Calendar } from "./content-calendar";
import { StorageUsage } from "./storage-usage";
import { SourceTool } from "./studio-tools";
import { SetupOptions } from "./setup-options";
type Health = { name: string; ok: boolean; detail: string };
const clock = (s: number) => {
  const n = Math.max(0, Math.floor(s));
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Something went wrong. Please retry.");
  return data;
}
const post = (action: string, body: unknown) =>
  api("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export default function Workspace() {
  useChannelMonitor();
  const [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState(""),
    [loaded, setLoaded] = useState(false),
    [composer, setComposer] = useState(false),
    [reuse, setReuse] = useState<Project | undefined>(),
    [library, setLibrary] = useState(false),
    [search, setSearch] = useState(""),
    [health, setHealth] = useState(false),
    [checks, setChecks] = useState<Health[]>([]),
    [review, setReview] = useState<string | null>(null),
    [editing, setEditing] = useState<Clip | null>(null),
    [tab, setTab] = useState("clips"),
    [sort, setSort] = useState("best"),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [notice, setNotice] = useState("");
  const [page, setPage] = useState("Overview"),
    [initialUrl, setInitialUrl] = useState(""),
    [initialUpload, setInitialUpload] = useState(false);
  useEffect(() => {
    if (
      loaded &&
      !projects.length &&
      !error &&
      !studioStorage.getItem("studio-first-run-seen")
    ) {
      studioStorage.setItem("studio-first-run-seen", "1");
      setHealth(true);
    }
  }, [loaded, projects.length, error]);
  function openProject(id: string) {
    select(id);
    go("Project", id);
  }
  function openClip(id: string, clipId: string) {
    select(id);
    setReview(clipId);
  }
  function go(next: string, id?: string) {
    const hash =
      "#" +
      (next === "Project"
        ? "project/" + id
        : next.toLowerCase().replaceAll(" ", "-"));
    if (location.hash !== hash) history.pushState(null, "", hash);
    window.scrollTo(0, 0);
    setPage(next);
    setSearch("");
  }
  const refresh = useCallback(async () => {
    try {
      const next: Project[] = await api("/api/progress");
      setProjects((old) =>
        old.length === next.length &&
        old.every(
          (p, i) => p.id === next[i].id && p.updatedAt === next[i].updatedAt,
        )
          ? old
          : next,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    try {
      setSelected(studioStorage.getItem("clipper-project") || "");
    } catch {}
    const route = () => {
      const hash = location.hash.slice(1);
      if (hash.startsWith("project/")) {
        select(hash.slice(8));
        setPage("Project");
      } else {
        setPage(
          sections
            .flatMap(([, items]) => items.map(([name]) => name))
            .filter((n) => n !== "New project")
            .find((name) => name.toLowerCase().replaceAll(" ", "-") === hash) ||
            "Overview",
        );
      }
      setComposer(false);
      setHealth(false);
      setReview(null);
      setEditing(null);
      setLibrary(false);
      setSearch("");
    };
    route();
    window.addEventListener("popstate", route);
    void refresh().finally(() => setLoaded(true));
    void api("/api/health")
      .then(setChecks)
      .catch(() =>
        setChecks([
          {
            name: "Local engine",
            ok: false,
            detail:
              "Could not reach the dependency check. Use Check again to retry.",
          },
        ]),
      );
    const timer = setInterval(() => void refresh(), 2500);
    return () => {
      clearInterval(timer);
      window.removeEventListener("popstate", route);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const closeMenus = (e: MouseEvent) => {
      if (e.target instanceof Element && !e.target.closest(".project-menu"))
        document
          .querySelectorAll(".project-menu[open]")
          .forEach((node) => node.removeAttribute("open"));
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);
  const project = projects.find((p) => p.id === selected) || projects[0];
  const processing =
    !!project && ["queued", "processing"].includes(project.status);
  const clip = project?.clips.find((c) => c.id === review);
  const clips = project
    ? [...project.clips].sort((a, b) =>
        sort === "best" ? (b.score ?? -1) - (a.score ?? -1) : a.start - b.start,
      )
    : [];
  function select(id: string) {
    setSelected(id);
    try {
      studioStorage.setItem("clipper-project", id);
    } catch {}
    setReview(null);
    setEditing(null);
    setTab("clips");
    setLibrary(false);
    setError("");
  }
  function create(existing?: Project, url = "", upload = false) {
    setInitialUrl(url);
    setInitialUpload(upload);
    setReuse(existing);
    setComposer(true);
  }
  async function action(work: () => Promise<unknown>, message?: string) {
    setError("");
    setWorking(true);
    try {
      await work();
      await refresh();
      if (message) setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  }
  function deleteProject() {
    if (
      !project ||
      !confirm("Delete this project, its source video, and all clips?")
    )
      return;
    void action(
      () => api(`/api/cleanup?project=${project.id}`, { method: "DELETE" }),
      "Project deleted",
    );
  }
  const reviewIndex = clip
    ? project!.clips.findIndex((c) => c.id === clip.id)
    : -1;
  return (
    <StudioShell
      page={page}
      go={go}
      projects={projects}
      onProject={openProject}
      onClip={openClip}
      create={() => create()}
      setup={() => setHealth(true)}
      ollama={checks.find((c) => c.name === "Ollama")?.ok}
    >
      <main className="workspace-main">
        {error && (
          <div className="alert" role="alert">
            <div>
              <strong>Something needs attention</strong>
              <p>{error}</p>
            </div>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {!loaded ? (
          <div
            className="studio-skeleton"
            role="status"
            aria-label="Loading workspace"
          >
            <i />
            <div />
            <span />
            <span />
            <span />
          </div>
        ) : page === "Overview" ? (
          <Overview
            projects={projects}
            open={openClip}
            openProject={openProject}
            go={go}
            create={(url, upload) => create(undefined, url, upload)}
          />
        ) : page !== "Project" ? (
          <>
            <div className="section-title">
              <div>
                <h1>{page}</h1>
                <p>
                  {
                    (
                      {
                        Projects:
                          "Source recordings and their generated clips.",
                        "Clip library":
                          "Browse and review clips across your projects.",
                        "Processing queue":
                          "Track local jobs and review their last reported stages.",
                        "Video editor": "Choose a clip to trim and frame.",
                        "Subtitle studio":
                          "Choose a clip to edit its text and caption style.",
                        "Transcript explorer":
                          "Search dialogue and select highlights in the source video.",
                        "Thumbnail studio":
                          "Choose a source frame and compose a cover image.",
                        "Content calendar":
                          "Drag a clip onto a day or enter a publication date below.",
                        Storage:
                          "Disk usage for local project files and media.",
                      } as Record<string, string>
                    )[page]
                  }
                </p>
              </div>
            </div>
            {page === "Projects" && (
              <>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Find project"
                    placeholder="Find a project"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <ProjectRows
                  projects={projects.filter((p) =>
                    p.title.toLowerCase().includes(search.toLowerCase()),
                  )}
                  open={openProject}
                />
                {!projects.some((p) =>
                  p.title.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <p className="studio-empty">
                    No matching projects. Import a video or try another search.
                  </p>
                )}
              </>
            )}
            {["Clip library", "Video editor", "Subtitle studio"].includes(
              page,
            ) && (
              <MediaLibrary
                projects={projects}
                open={(pid, cid) => {
                  if (page === "Clip library") openClip(pid, cid);
                  else {
                    select(pid);
                    setEditing(
                      projects
                        .find((p) => p.id === pid)
                        ?.clips.find((c) => c.id === cid) || null,
                    );
                  }
                }}
              />
            )}
            {page === "Processing queue" &&
              (projects.length ? (
                projects.map((p) => (
                  <section className="studio-section" key={p.id}>
                    <div className="section-row">
                      <h2>{p.title}</h2>
                      <button onClick={() => openProject(p.id)}>
                        Open project
                      </button>
                    </div>
                    <JobProgress
                      project={p}
                      onRefresh={refresh}
                      onCancel={
                        ["queued", "processing"].includes(p.status)
                          ? () =>
                              void action(
                                () => post("cancel", { project: p.id }),
                                "Processing cancelled",
                              )
                          : undefined
                      }
                    />
                  </section>
                ))
              ) : (
                <p className="studio-empty">
                  No jobs yet. Import a video to start processing.
                </p>
              ))}
            {["Thumbnail studio", "Transcript explorer"].includes(page) &&
              (project ? (
                <>
                  <select
                    className="source-select"
                    aria-label="Source project"
                    value={project.id}
                    onChange={(e) => select(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <SourceTool
                    key={page + project.id}
                    project={project}
                    thumbnail={page === "Thumbnail studio"}
                    generate={(a, b) =>
                      create({
                        ...project,
                        settings: {
                          ...project.settings,
                          mode: "manual",
                          manualStart: a,
                          manualEnd: b,
                        },
                      })
                    }
                  />
                </>
              ) : (
                <p className="studio-empty">
                  Import a source video to use this workspace.
                </p>
              ))}
            {page === "Content calendar" && (
              <Calendar projects={projects} open={openClip} />
            )}
            {page === "Live clipping" && <LiveClipping open={openProject} projects={projects} />}
            {["Streamers", "Automatic clipping"].includes(page) && (
              <Channels
                automation={page === "Automatic clipping"}
                projects={projects}
                open={openProject}
                create={(url) => create(undefined, url)}
              />
            )}
            {page === "Branding" && <Branding />}
            {page === "Backup & recovery" && (
              <RecoveryPanel projects={projects} />
            )}
            {page === "Workflow builder" && (
              <WorkflowPanel projects={projects} />
            )}
            {page === "Discover" && (
              <DiscoverySearch projects={projects} open={openClip} />
            )}
            {page === "Compilations" && (
              <CompilationBuilder
                projects={projects}
                open={async (id) => {
                  await refresh();
                  openProject(id);
                }}
              />
            )}
            {page === "Assets" && <AssetLibrary projects={projects} />}
            {page === "Production desk" && (
              <ProductionDesk projects={projects} />
            )}
            {page === "Storage" && <StorageUsage />}
          </>
        ) : !project ? (
          <section className="welcome">
            <div className="welcome-icon">
              <Scissors size={30} />
            </div>
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h1>Your next clip starts here.</h1>
            <p>
              Add a long video. Find the highlights.
              <br />
              Make them ready to share.
            </p>
            <Button onClick={() => create()}>
              <Plus size={18} />
              Add a video
            </Button>
            <div className="welcome-note">
              <ShieldCheck size={15} />
              Private, local processing · up to 5 GB
            </div>
            <div className="empty-workflow">
              <span>
                <Film size={19} />
                <strong>Add your video</strong>
                <small>Paste a link or upload a file</small>
              </span>
              <ChevronRight size={17} />
              <span>
                <Sparkles size={19} />
                <strong>Find your moments</strong>
                <small>AI picks complete highlights</small>
              </span>
              <ChevronRight size={17} />
              <span>
                <Download size={19} />
                <strong>Make it yours</strong>
                <small>Review, caption, and download</small>
              </span>
            </div>
          </section>
        ) : (
          <>
            <div className="project-heading">
              <div className="project-heading-copy">
                <button
                  className="breadcrumb"
                  onClick={() => {
                    setSearch("");
                    setLibrary(true);
                  }}
                >
                  Your projects
                  <ChevronRight size={13} />
                </button>
                <h1>{project.title}</h1>
                <div className="project-meta">
                  <span>
                    {project.duration
                      ? clock(project.duration) + " source video"
                      : "Preparing source video"}
                  </span>
                  <span className="meta-separator" />
                  <span>
                    {project.settings.resolution}p · {project.settings.ratio}
                  </span>
                  <span className="meta-separator" />
                  <span>
                    {new Date(project.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <div className="project-heading-actions">
                {project.duration > 0 && (
                  <Button variant="secondary" onClick={() => go("Transcript explorer")}>
                    <Scissors size={16} />
                    Quick clips
                  </Button>
                )}
                {!!project.clips.length && (
                  <Button asChild>
                    <a
                      href={`/api/download?project=${project.id}&kind=zip`}
                      title="All videos and post captions in one ZIP"
                    >
                      <Download size={17} />
                      Download all
                    </a>
                  </Button>
                )}
                <details className="project-menu">
                  <summary className="icon-button" aria-label="Project actions">
                    <Ellipsis size={21} />
                  </summary>
                  <div>
                    <button
                      disabled={processing || working}
                      onClick={(e) => {
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        create(project);
                      }}
                    >
                      <Sparkles size={15} />
                      Create more clips
                    </button>
                    <button
                      onClick={(e) => {
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        void refresh();
                      }}
                    >
                      <RefreshCw size={15} />
                      Refresh project
                    </button>
                    <button
                      className="danger-text"
                      disabled={processing || working}
                      onClick={deleteProject}
                    >
                      <Trash2 size={15} />
                      Delete project
                    </button>
                  </div>
                </details>
              </div>
            </div>
            <div className="workspace-toolbar">
              <div
                className="workspace-tabs"
                role="tablist"
                aria-label="Project view"
              >
                <button
                  role="tab"
                  aria-selected={tab === "clips"}
                  className={tab === "clips" ? "selected" : ""}
                  onClick={() => setTab("clips")}
                >
                  Clips <span>{project.clips.length}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "activity"}
                  className={tab === "activity" ? "selected" : ""}
                  onClick={() => setTab("activity")}
                >
                  Activity{processing && <span className="live-dot" />}
                </button>
              </div>
              {tab === "clips" && project.clips.length > 1 && (
                <label className="sort-control">
                  <span>Sort by</span>
                  <select
                    aria-label="Sort clips"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="best">Highest AI score</option>
                    <option value="timeline">Source order</option>
                  </select>
                </label>
              )}
            </div>
            {(processing || tab === "activity") && (
              <JobProgress
                project={project}
                onRefresh={() => void refresh()}
                onCancel={
                  processing
                    ? () =>
                        void action(
                          () => post("cancel", { project: project.id }),
                          "Processing stopped. Your progress is saved.",
                        )
                    : undefined
                }
              />
            )}
            {project.status === "error" && (
              <div className="project-error">
                <div>
                  <strong>We couldn’t finish this video.</strong>
                  <p>
                    Retry from saved progress, or adjust the clipping options.
                  </p>
                  <details>
                    <summary>View error details</summary>
                    <p>{project.error || project.detail}</p>
                  </details>
                </div>
                <div>
                  <Button
                    disabled={working}
                    onClick={() =>
                      void action(
                        () =>
                          post("generate", {
                            project: project.id,
                            settings: project.settings,
                          }),
                        "Processing resumed",
                      )
                    }
                  >
                    <RefreshCw size={16} />
                    Retry
                  </Button>
                  <Button variant="secondary" onClick={() => create(project)}>
                    Options
                  </Button>
                </div>
              </div>
            )}
            {tab === "clips" &&
              (clips.length ? (
                <>
                  <div className="gallery-note">
                    <span>
                      {clips.length} {clips.length === 1 ? "clip" : "clips"}
                      {processing ? " so far" : " ready to share"}
                    </span>
                    <span>Downloads include video + caption TXT</span>
                  </div>
                  <div className="clip-grid">
                    {clips.map((c, index) => (
                      <article className="clip-card" key={c.id}>
                        <button
                          className="clip-preview"
                          style={{
                            aspectRatio: c.settings.ratio.replace(":", "/"),
                          }}
                          aria-label={`Review ${c.title}`}
                          onClick={() => setReview(c.id)}
                        >
                          <img
                            loading="lazy"
                            alt=""
                            src={`/api/download?project=${project.id}&clip=${c.id}&kind=poster`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                          <span className="clip-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="preview-play">
                            <Play size={22} fill="currentColor" />
                          </span>
                          <span className="clip-duration">
                            {clock(c.end - c.start)}
                          </span>
                        </button>
                        <div className="clip-card-body">
                          <div className="clip-category">
                            {c.score !== null ? (
                              <>
                                <Sparkles size={13} />
                                <span>
                                  AI score <strong>{c.score}</strong>
                                </span>
                              </>
                            ) : (
                              <span>
                                {c.reason.startsWith("Fixed")
                                  ? "Fixed segment"
                                  : "Manual clip"}
                              </span>
                            )}
                            <span>{clock(c.start)}</span>
                          </div>
                          <button
                            className="clip-title"
                            onClick={() => setReview(c.id)}
                          >
                            <h2>{c.title}</h2>
                          </button>
                          <div className="clip-card-actions">
                            <Button
                              variant="secondary"
                              onClick={() => setReview(c.id)}
                            >
                              Review clip
                              <ArrowUpRight size={14} />
                            </Button>
                            <Button asChild variant="ghost" size="icon">
                              <a
                                aria-label={`Download ${c.title} with caption`}
                                title="Download MP4 + TXT ZIP"
                                href={`/api/download?project=${project.id}&clip=${c.id}&kind=bundle`}
                              >
                                <Download size={18} />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-results">
                  <span className="empty-result-icon">
                    {processing ? (
                      <LoaderCircle size={27} className="spin" />
                    ) : (
                      <Scissors size={27} />
                    )}
                  </span>
                  <h2>
                    {processing
                      ? "Your clips are on their way."
                      : project.status === "cancelled"
                        ? "Pick up where you left off."
                        : "Ready when you are."}
                  </h2>
                  <p>
                    {processing
                      ? "You can leave this page open. Finished clips will appear here."
                      : project.status === "cancelled"
                        ? "Your video and saved progress are still here."
                        : "Create clips from this video using your preferred settings."}
                  </p>
                  {!processing && project.status !== "error" && (
                    <Button
                      onClick={() =>
                        project.status === "cancelled"
                          ? void action(
                              () =>
                                post("generate", {
                                  project: project.id,
                                  settings: project.settings,
                                }),
                              "Processing resumed",
                            )
                          : create(project)
                      }
                    >
                      {project.status === "cancelled"
                        ? "Resume processing"
                        : "Create clips"}
                    </Button>
                  )}
                </div>
              ))}
          </>
        )}
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {composer && (
        <CreateClips
          initialUrl={initialUrl}
          initialUpload={initialUpload}
          reuse={reuse}
          onClose={() => setComposer(false)}
          onCreated={async (id) => {
            openProject(id);
            await refresh();
            setNotice(
              reuse
                ? "Creating more clips from this video."
                : "Video added. Processing has started.",
            );
          }}
        />
      )}
      {library && (
        <Modal
          title="Your projects"
          description="Choose a video to see its clips."
          onClose={() => setLibrary(false)}
        >
          <div className="library-body">
            <label className="search-field">
              <Search size={17} />
              <input
                autoFocus
                aria-label="Search projects"
                placeholder="Search projects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="project-list">
              {projects
                .filter((p) =>
                  p.title.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    className={`project-list-item ${p.id === project?.id ? "chosen" : ""}`}
                    onClick={() => openProject(p.id)}
                  >
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt="" />
                    ) : (
                      <span className="project-thumbnail">
                        <Film size={22} />
                      </span>
                    )}
                    <span>
                      <strong>{p.title}</strong>
                      <small>
                        {clock(p.duration)} · {p.clips.length} clips ·{" "}
                        {new Date(p.createdAt).toLocaleDateString()}
                      </small>
                    </span>
                    {["processing", "queued"].includes(p.status) ? (
                      <span className="project-state">
                        <LoaderCircle size={14} className="spin" />
                        Processing
                      </span>
                    ) : p.id === project?.id ? (
                      <Check size={18} />
                    ) : (
                      <ChevronRight size={17} />
                    )}
                  </button>
                ))}
              {!projects.length && (
                <p className="empty-search">
                  No projects yet. Start by adding a video.
                </p>
              )}
              {projects.length > 0 &&
                !projects.some((p) =>
                  p.title.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <p className="empty-search">No projects match “{search}”.</p>
                )}
            </div>
          </div>
          <footer className="modal-footer">
            <span className="muted">{projects.length} projects</span>
            <Button
              variant="secondary"
              onClick={() => {
                setLibrary(false);
                create();
              }}
            >
              <Plus size={16} />
              New video
            </Button>
          </footer>
        </Modal>
      )}
      {health && (
        <Modal
          title="Local setup"
          description="Everything runs on this computer."
          onClose={() => setHealth(false)}
        >
          <div className="health-body">
            {checks.length ? (
              checks.map((c) => (
                <div className="health-row" key={c.name}>
                  <span className={c.ok ? "health-ok" : "health-missing"}>
                    {c.ok ? <Check size={17} /> : <X size={17} />}
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <p>{c.detail}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="hint">Checking dependencies…</p>
            )}
            <SetupOptions />
            <p className="hint">
              Installation and model settings are documented in README.md.{" "}
              <a className="inline-link" href="/api/diagnostics?export=1">
                Export sanitized diagnostics
              </a>
            </p>
          </div>
          <footer className="modal-footer">
            <span className="muted">
              {checks.filter((c) => c.ok).length} of {checks.length} tools ready
            </span>
            <Button
              variant="secondary"
              disabled={working}
              onClick={() =>
                void action(async () => setChecks(await api("/api/health")))
              }
            >
              <RefreshCw size={15} />
              Check again
            </Button>
          </footer>
        </Modal>
      )}
      {clip && project && (
        <Modal
          title="Review clip"
          description={`${clock(clip.end - clip.start)} · ${clip.settings.resolution}p · ${clip.settings.ratio}`}
          size="review"
          onClose={() => setReview(null)}
        >
          <div className="review-grid">
            <div className="review-player">
              <video
                key={clip.id}
                controls
                autoPlay
                playsInline
                src={`/api/download?project=${project.id}&clip=${clip.id}`}
              />
              <div className="review-navigation">
                <button
                  className="icon-button"
                  aria-label="Previous clip"
                  disabled={reviewIndex <= 0}
                  onClick={() => setReview(project.clips[reviewIndex - 1].id)}
                >
                  <ChevronLeft size={20} />
                </button>
                <span>
                  {reviewIndex + 1} of {project.clips.length}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next clip"
                  disabled={reviewIndex >= project.clips.length - 1}
                  onClick={() => setReview(project.clips[reviewIndex + 1].id)}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <div className="review-content">
              <h3>{clip.title}</h3>
              <PostCaption
                key={clip.id}
                clip={clip}
                project={project.id}
                disabled={processing}
                onUpdated={refresh}
              />
              {clip.qa && (
                <details className="clip-context">
                  <summary>Export inspection</summary>
                  <p>
                    {clip.qa.width} × {clip.qa.height} ·{" "}
                    {clip.qa.fps.toFixed(2)} fps · {clip.qa.duration.toFixed(2)}{" "}
                    seconds · {(clip.qa.bytes / 1048576).toFixed(1)} MB
                  </p>
                  <p>
                    {clip.qa.audio ? "Audio present" : "Video only"}
                    {clip.qa.peakDb !== undefined
                      ? ` · Peak ${clip.qa.peakDb} dBFS`
                      : ""}
                  </p>
                  {clip.qa.warnings.length ? (
                    clip.qa.warnings.map((w) => <p key={w}>{w}</p>)
                  ) : (
                    <p>Decode and stream checks passed.</p>
                  )}
                </details>
              )}
              <details className="clip-context">
                <summary>About this moment</summary>
                <p>{clip.reason}</p>
                <span>
                  Source: {clock(clip.start)}–{clock(clip.end)}
                  {clip.score !== null ? ` · AI score ${clip.score}/100` : ""}
                </span>
              </details>
              <button
                className="delete-clip-link"
                disabled={processing || working}
                onClick={() => {
                  if (confirm("Delete this clip?"))
                    void action(async () => {
                      await api(
                        `/api/cleanup?project=${project.id}&clip=${clip.id}`,
                        { method: "DELETE" },
                      );
                      setReview(null);
                    }, "Clip deleted");
                }}
              >
                <Trash2 size={14} />
                Delete clip
              </button>
            </div>
          </div>
          <footer className="modal-footer">
            <Button
              variant="secondary"
              disabled={processing}
              onClick={() => {
                setReview(null);
                setEditing(clip);
              }}
            >
              <Scissors size={16} />
              Edit video
            </Button>
            <Button asChild>
              <a
                href={`/api/download?project=${project.id}&clip=${clip.id}&kind=bundle`}
              >
                <Download size={17} />
                Download clip<span className="button-detail">MP4 + TXT</span>
              </a>
            </Button>
          </footer>
        </Modal>
      )}
      {editing && project && (
        <VideoEditor
          subtitleTab={page === "Subtitle studio"}
          key={editing.id}
          clip={editing}
          project={project}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setNotice("Changes saved. Your clip is rendering.");
          }}
        />
      )}
    </StudioShell>
  );
}
