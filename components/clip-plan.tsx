"use client";
import { useState } from "react";
type Proposal = { title: string; reason: string; ids: string[] };
export function ClipPlan({
  clips,
  kind,
  apply,
}: {
  clips: { id: string; title: string }[];
  kind: "calendar" | "compilation";
  apply: (v: Proposal) => void;
}) {
  const [goal, setGoal] = useState(""),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [busy, working] = useState(false),
    [error, note] = useState("");
  return (
    <details>
      <summary>
        {kind === "calendar"
          ? "Suggest a publishing plan"
          : "Suggest a compilation"}
      </summary>
      <label className="field">
        Editorial goal
        <input
          value={goal}
          maxLength={500}
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>
      <button
        className="tool"
        disabled={busy || clips.length < (kind === "calendar" ? 1 : 2)}
        onClick={async () => {
          working(true);
          note("");
          setProposal(null);
          try {
            const r = await fetch("/api/clip-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ids: clips.map((c) => c.id).slice(0, 120),
                goal,
                kind,
              }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setProposal(d);
          } catch (e) {
            note(String(e));
          } finally {
            working(false);
          }
        }}
      >
        {busy ? "Reviewing clips…" : "Suggest with Ollama"}
      </button>
      {error && <p role="alert">{error}</p>}
      {proposal && (
        <>
          <h3>{proposal.title}</h3>
          <p>{proposal.reason}</p>
          <ol>
            {proposal.ids.map((id) => (
              <li key={id}>{clips.find((c) => c.id === id)?.title}</li>
            ))}
          </ol>
          <button
            className="tool"
            onClick={() => {
              apply(proposal);
              setProposal(null);
            }}
          >
            {kind === "calendar"
              ? "Schedule in next weekly slots"
              : "Use this sequence"}
          </button>
        </>
      )}
    </details>
  );
}
