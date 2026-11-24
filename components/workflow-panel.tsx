"use client";
import { useEffect, useState } from "react";
import { defaults, type Settings, type Project } from "@/lib/types";
import { workflows, operations, type Workflow, type Op } from "@/lib/workflow";
import { AdvancedSettings, BasicSettings } from "./clip-settings";
export function WorkflowPanel({ projects }: { projects: Project[] }) {
  const [s, set] = useState<Settings>(defaults),
    [nodes, setNodes] = useState<Op[]>([...operations]),
    [proj, choose] = useState<string[]>([]),
    [name, label] = useState(""),
    [saved, setSaved] = useState<Record<string, Workflow>>({}),
    [msg, note] = useState(""),
    [busy, working] = useState(false);
  const workflow: Workflow = {
    version: 1,
    settings: s,
    nodes,
    edges: nodes.slice(1).map((v, i) => [nodes[i], v]),
  };
  useEffect(() => {
    fetch("/api/preferences?group=workflows")
      .then((r) => r.json())
      .then(setSaved)
      .catch(() => {});
  }, []);
  function load(w: Workflow) {
    set(w.settings);
    setNodes(w.nodes);
  }
  async function request(action: string, body: unknown) {
    const r = await fetch("/api/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  return (
    <div className="tool-layout">
      <section>
        <h2>Workflow settings</h2>
        <label className="field">
          Starting preset
          <select
            defaultValue=""
            onChange={(e) => {
              set({ ...defaults, ...workflows[e.target.value] });
              label(e.target.value);
            }}
          >
            <option value="">Choose preset</option>
            {Object.keys(workflows).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <BasicSettings value={s} onChange={set} />
        <details>
          <summary>Configure analysis and render</summary>
          <AdvancedSettings value={s} onChange={set} />
        </details>
        <h3>Operations</h3>
        <div className="workflow-chain">
          {operations.map((n) => (
            <label key={n} className="check-row">
              <input
                type="checkbox"
                disabled={n === "analyze" || n === "render"}
                checked={nodes.includes(n)}
                onChange={(e) =>
                  setNodes(
                    operations.filter((k) =>
                      k === n ? e.target.checked : nodes.includes(k),
                    ),
                  )
                }
              />
              {n}
            </label>
          ))}
        </div>
        <label className="field">
          Preset name
          <input
            value={name}
            maxLength={100}
            onChange={(e) => label(e.target.value)}
          />
        </label>
        <button
          className="tool"
          disabled={!name.trim()}
          onClick={async () => {
            try {
              await request("workflow", { workflow });
              setSaved(
                await request("preferences?group=workflows", {
                  name,
                  value: workflow,
                }),
              );
              note("Saved workflow.");
            } catch (e) {
              note(String(e));
            }
          }}
        >
          Save workflow
        </button>
        <button
          className="tool"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(workflow, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "workflow.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Export JSON
        </button>
        <label className="field">
          Import workflow
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              try {
                const f = e.target.files?.[0];
                if (!f || f.size > 200000)
                  throw Error("Choose a workflow JSON under 200 KB");
                const w = JSON.parse(await f.text());
                await request("workflow", { workflow: w });
                load(w);
                note("Loaded workflow.");
              } catch (e) {
                note(String(e));
              }
            }}
          />
        </label>
        {Object.entries(saved).map(([n, w]) => (
          <button
            className="event-row"
            key={n}
            onClick={() => {
              label(n);
              load(w);
            }}
          >
            {n}
          </button>
        ))}
      </section>
      <section>
        <h2>Run on projects</h2>
        {projects.map((p) => (
          <label className="check-row" key={p.id}>
            <input
              type="checkbox"
              checked={proj.includes(p.id)}
              onChange={(e) =>
                choose(
                  e.target.checked
                    ? [...proj, p.id]
                    : proj.filter((i) => i !== p.id),
                )
              }
            />
            {p.title}
          </label>
        ))}
        <button
          disabled={!proj.length || busy}
          className="button primary"
          onClick={async () => {
            working(true);
            const done: string[] = [];
            try {
              for (const project of proj) {
                await request("workflow", { project, workflow });
                done.push(project);
              }
              note(
                done.length +
                  " workflows queued. Open Processing queue for progress and cancellation.",
              );
            } catch (e) {
              note(done.length + " queued. " + String(e));
            } finally {
              choose(proj.filter((id) => !done.includes(id)));
              working(false);
            }
          }}
        >
          Queue selected projects
        </button>
        <p role="status">{msg}</p>
      </section>
    </div>
  );
}
