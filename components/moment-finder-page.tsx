"use client";
import { useRef, useState } from "react";
import type { Project } from "@/lib/types";
import MomentExplorer from "./moment-explorer";

/** Stand-alone page: choose a source, watch it, and find candidate moments from measured signals. */
export function MomentFinderPage({ projects }: { projects: Project[] }) {
  const ready = projects.filter((p) => p.duration > 0);
  const [id, setId] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const project = ready.find((p) => p.id === id) ?? ready[0];
  if (!project) return <p className="studio-empty">Import a source video to find moments in it.</p>;
  return (
    <div className="moment-page">
      <label className="field">
        Source
        <select value={project.id} onChange={(e) => setId(e.target.value)}>
          {ready.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <video
        key={project.id}
        ref={video}
        className="source-monitor"
        controls
        preload="metadata"
        src={`/api/download?project=${project.id}&kind=source`}
        aria-label="Source video"
      />
      <MomentExplorer
        project={project}
        seek={(t) => {
          if (!video.current) return;
          video.current.currentTime = Math.max(0, t);
          video.current.scrollIntoView({ block: "nearest" });
        }}
      />
    </div>
  );
}
