"use client";
import { useEffect, useState } from "react";
import { Bot, Play, Save } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Prompt = {
  id: string;
  name: string;
  system: string;
  user: string;
  model?: string;
};

type Run = {
  id: string;
  model: string;
  output: string;
  createdAt: string;
};

export function AiLabPanel() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [model, setModel] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/ai-lab")
      .then((r) => r.json())
      .then((data) => {
        setPrompt(data.prompts?.[0] || null);
        setRuns(data.runs || []);
        setModel(data.prompts?.[0]?.model || "");
      })
      .catch(() => setError("Could not load AI lab"));
  }, []);

  async function save() {
    if (!prompt) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/ai-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "save",
          prompt: { ...prompt, model: model || undefined },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Save failed");
      setPrompt(data);
      setMsg("Prompt saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!prompt) return;
    setBusy(true);
    setError("");
    setOutput("");
    try {
      const r = await fetch("/api/ai-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "run",
          prompt: { ...prompt, model: model || undefined },
          model,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Run failed");
      setOutput(data.output || "");
      setRuns((rows) => [data, ...rows].slice(0, 20));
      setMsg(`Ran on ${data.model}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-lab">
      <header className="panel-head">
        <div>
          <h2>AI Laboratory</h2>
          <p>
            Ollama-only prompt playground for editing experiments. Outputs stay
            on this machine and are not auto-applied to projects.
          </p>
        </div>
        <Badge variant="outline">
          <Bot size={12} /> Ollama
        </Badge>
      </header>

      {!prompt ? (
        <p className="empty">Loading…</p>
      ) : (
        <>
          <div className="reel-grid">
            <label>
              Name
              <Input
                value={prompt.name}
                onChange={(e) =>
                  setPrompt({ ...prompt, name: e.target.value.slice(0, 80) })
                }
              />
            </label>
            <label>
              Model override
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="llama3.2"
              />
            </label>
          </div>
          <label>
            System
            <textarea
              className="ai-lab-area"
              rows={4}
              value={prompt.system}
              onChange={(e) =>
                setPrompt({ ...prompt, system: e.target.value.slice(0, 4000) })
              }
            />
          </label>
          <label>
            User
            <textarea
              className="ai-lab-area"
              rows={5}
              value={prompt.user}
              onChange={(e) =>
                setPrompt({ ...prompt, user: e.target.value.slice(0, 8000) })
              }
            />
          </label>
          <div className="bar-tools">
            <Button variant="secondary" disabled={busy} onClick={() => void save()}>
              <Save size={14} /> Save prompt
            </Button>
            <Button disabled={busy} onClick={() => void run()}>
              <Play size={14} /> {busy ? "Running…" : "Run with Ollama"}
            </Button>
          </div>
          {(output || runs[0]) && (
            <pre className="ai-lab-output">{output || runs[0]?.output}</pre>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}
      {msg && <p className="notice">{msg}</p>}
    </div>
  );
}
