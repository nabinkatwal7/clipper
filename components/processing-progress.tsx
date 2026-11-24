"use client";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  LoaderCircle,
  RefreshCw,
  Square,
} from "lucide-react";
import type { Project, ProcessingStage, StageProgress } from "@/lib/types";
const steps: { id: ProcessingStage; label: string }[] = [
  { id: "importing", label: "Import video" },
  { id: "extracting", label: "Extract audio" },
  { id: "transcribing", label: "Transcribe" },
  { id: "analyzing", label: "Find highlights" },
  { id: "rendering", label: "Render clips" },
];
const time = (n: number) =>
  n >= 3600
    ? `${Math.floor(n / 3600)}h ${Math.floor(n / 60) % 60}m`
    : n >= 60
      ? `${Math.floor(n / 60)}m ${Math.floor(n % 60)}s`
      : `${Math.floor(n)}s`;
function amount(n: number, unit: StageProgress["unit"]) {
  return unit === "bytes"
    ? n >= 1024 ** 3
      ? `${(n / 1024 ** 3).toFixed(1)} GB`
      : `${Math.round(n / 1024 ** 2)} MB`
    : unit === "seconds"
      ? time(n)
      : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
          n,
        );
}
const percent = (data?: StageProgress) =>
  data?.state === "complete"
    ? 100
    : data && data.total > 0
      ? Math.min(100, Math.floor((data.current / data.total) * 100))
      : undefined;
export function JobProgress({
  project,
  onRefresh,
  onCancel,
}: {
  project: Project;
  onRefresh: () => void;
  onCancel?: () => void;
}) {
  const running = ["queued", "processing"].includes(project.status);
  const active = steps.some((s) => s.id === project.stage)
    ? (project.stage as ProcessingStage)
    : project.status === "ready"
      ? "rendering"
      : undefined;
  const data = active ? project.progress?.[active] : undefined;
  const [expanded, setExpanded] = useState(false),
    [selected, setSelected] = useState<ProcessingStage>(active || "importing"),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (active) setSelected(active);
  }, [active]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const value = percent(data),
    age = Math.max(
      0,
      Math.floor(
        (now - Date.parse(data?.updatedAt || project.updatedAt)) / 1000,
      ),
    ),
    history = project.progress?.[selected];
  const label =
    project.status === "queued"
      ? "Waiting for the local worker"
      : project.status === "ready"
        ? "All done"
        : project.status === "error"
          ? "Processing stopped"
          : project.status === "cancelled"
            ? "Progress saved"
            : active
              ? steps.find((s) => s.id === active)!.label
              : "Processing";
  return (
    <section
      className={`job-progress ${running ? "is-running" : ""}`}
      aria-label="Processing progress"
    >
      <div className="progress-top">
        <div className="progress-stage-icon">
          {running ? (
            <LoaderCircle size={20} className="spin" />
          ) : project.status === "ready" ? (
            <Check size={20} />
          ) : (
            <Square size={18} />
          )}
        </div>
        <div className="progress-heading">
          <strong>{label}</strong>
          <span>
            {running
              ? age < 15
                ? "Live updates"
                : `Last update ${age}s ago`
              : "Your video and completed work are saved."}
          </span>
        </div>
        <span className="progress-percentage">
          {value !== undefined && project.status !== "queued"
            ? `${value}%`
            : project.status === "queued"
              ? "Queued"
              : ""}
        </span>
        {onCancel && (
          <button className="text-button progress-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <div
        className={`actual-progress-track ${value === undefined && running ? "unmeasured" : ""}`}
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={project.status === "queued" ? undefined : value}
        aria-valuetext={
          data && data.total
            ? `${amount(data.current, data.unit)} of ${amount(data.total, data.unit)}`
            : project.detail
        }
      >
        <div
          style={{
            width: `${project.status === "queued" ? 0 : (value ?? 0)}%`,
          }}
        />
      </div>
      <div className="progress-bottom">
        <p aria-live="polite">
          {running ? project.detail : data?.detail || project.detail}
        </p>
        <button
          className="text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide steps" : "Show steps"}
          <ChevronDown size={14} className={expanded ? "rotate" : ""} />
        </button>
      </div>
      {expanded && (
        <div className="progress-expanded">
          <div
            className="stage-tabs"
            role="tablist"
            aria-label="Processing steps"
          >
            {steps.map((step) => {
              const item = project.progress?.[step.id];
              return (
                <button
                  key={step.id}
                  role="tab"
                  aria-selected={selected === step.id}
                  className={`stage-tab ${selected === step.id ? "chosen" : ""}`}
                  onClick={() => setSelected(step.id)}
                >
                  <span>
                    {item?.state === "complete" ? (
                      <Check size={14} />
                    ) : step.id === active && running ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <span className="stage-dot" />
                    )}
                    {step.label}
                  </span>
                  <small>
                    {item?.state === "complete"
                      ? "Complete"
                      : item?.state === "active"
                        ? percent(item) !== undefined
                          ? percent(item) + "%"
                          : "Working"
                        : "Waiting"}
                  </small>
                </button>
              );
            })}
          </div>
          <div className="stage-history" role="tabpanel">
            <div>
              <strong>{steps.find((s) => s.id === selected)?.label}</strong>
              <span>
                {history && history.total > 0
                  ? `${amount(history.current, history.unit)} / ${amount(history.total, history.unit)} ${["clips", "chunks"].includes(history.unit) ? history.unit : ""}`
                  : "Not started"}
              </span>
            </div>
            <p>
              {history?.detail || "This step will start when it is needed."}
            </p>
            {history && (
              <small>
                Elapsed{" "}
                {time(
                  Math.max(
                    0,
                    ((running && history.state === "active"
                      ? now
                      : Date.parse(history.updatedAt)) -
                      Date.parse(history.startedAt)) /
                      1000,
                  ),
                )}{" "}
                · Last report{" "}
                {Math.max(
                  0,
                  Math.floor((now - Date.parse(history.updatedAt)) / 1000),
                )}
                s ago
              </small>
            )}
            <button className="text-button" onClick={onRefresh}>
              <RefreshCw size={13} />
              Refresh status
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
