"use client";
import { useEffect, useRef, useState } from "react";
import { Music2, Play, Square, Save } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

type Pad = {
  id: string;
  label: string;
  assetId: string;
  key?: string;
  volume: number;
  loop: boolean;
};

type Profile = {
  version: 1;
  id: string;
  name: string;
  pads: Pad[];
};

type Pattern = {
  id: string;
  name: string;
  steps: number;
  lanes: Record<string, boolean[]>;
};

type Sequencer = {
  version: 1;
  tempo: number;
  swing: number;
  patterns: Pattern[];
  activePattern?: string;
};

type Asset = { id: string; name: string; kind: string };

export function SoundboardStudio() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [seq, setSeq] = useState<Sequencer | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/soundboard").then((r) => r.json()),
      fetch("/api/soundboard?kind=sequencer").then((r) => r.json()),
      fetch("/api/assets").then((r) => r.json()),
    ])
      .then(([p, s, a]) => {
        setProfile(p);
        setSeq(s);
        setAssets(
          (Array.isArray(a) ? a : []).filter(
            (x: Asset) => x.kind === "audio",
          ),
        );
      })
      .catch(() => setError("Could not load soundboard"));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!profile || e.target instanceof HTMLInputElement) return;
      const pad = profile.pads.find((p) => p.key === e.key.toLowerCase());
      if (pad) void trigger(pad);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile]);

  useEffect(() => {
    if (!running || !seq || !profile) return;
    const pat =
      seq.patterns.find((p) => p.id === seq.activePattern) || seq.patterns[0];
    if (!pat) return;
    const ms = (60_000 / seq.tempo) / (pat.steps / 4);
    timer.current = window.setInterval(() => {
      setStep((s) => {
        const next = (s + 1) % pat.steps;
        for (const pad of profile.pads) {
          const lane = pat.lanes[pad.id];
          if (lane?.[next]) void trigger(pad, true);
        }
        return next;
      });
    }, ms);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [running, seq?.tempo, seq?.activePattern, profile]);

  async function trigger(pad: Pad, fromSeq = false) {
    try {
      if (audio.current) {
        audio.current.pause();
        audio.current = null;
      }
      const el = new Audio("/api/assets?id=" + pad.assetId);
      el.volume = pad.volume;
      el.loop = pad.loop && !fromSeq;
      audio.current = el;
      setPlaying(pad.id);
      await el.play();
      el.onended = () => setPlaying((id) => (id === pad.id ? null : id));
    } catch {
      setError("Could not play pad — check the audio asset.");
    }
  }

  async function saveAll() {
    if (!profile || !seq) return;
    setError("");
    try {
      await Promise.all([
        fetch("/api/soundboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile }),
        }),
        fetch("/api/soundboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "sequencer", doc: seq }),
        }),
      ]);
    } catch {
      setError("Save failed");
    }
  }

  function addPad(assetId: string) {
    if (!profile) return;
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setProfile({
      ...profile,
      pads: [
        ...profile.pads,
        {
          id: crypto.randomUUID(),
          label: asset.name.slice(0, 40),
          assetId,
          volume: 0.85,
          loop: false,
          key: String(profile.pads.length + 1).slice(-1),
        },
      ].slice(0, 64),
    });
  }

  const pattern =
    seq?.patterns.find((p) => p.id === seq.activePattern) || seq?.patterns[0];

  return (
    <div className="soundboard-studio">
      <header className="panel-head">
        <div>
          <h2>Soundboard</h2>
          <p>
            Trigger pads with keys, insert SFX into creator workflows, and
            sketch short patterns. Not a full DAW.
          </p>
        </div>
        <Badge variant="outline">
          <Music2 size={12} /> Local
        </Badge>
      </header>

      <div className="bar-tools">
        <select
          aria-label="Add audio asset"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) addPad(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">Add pad from assets…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => void saveAll()}>
          <Save size={14} /> Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (audio.current) audio.current.pause();
            setPlaying(null);
            setRunning(false);
          }}
        >
          <Square size={14} /> Stop
        </Button>
      </div>

      <div className="sound-pads">
        {(profile?.pads || []).map((pad) => (
          <button
            key={pad.id}
            type="button"
            className={`sound-pad ${playing === pad.id ? "current" : ""}`}
            onClick={() => void trigger(pad)}
          >
            <strong>{pad.label}</strong>
            <small>{pad.key ? `Key ${pad.key}` : "Click"}</small>
            <Input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={pad.volume}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                setProfile((p) =>
                  p
                    ? {
                        ...p,
                        pads: p.pads.map((x) =>
                          x.id === pad.id
                            ? { ...x, volume: Number(e.target.value) }
                            : x,
                        ),
                      }
                    : p,
                )
              }
            />
          </button>
        ))}
        {!profile?.pads.length && (
          <p className="empty">Import audio assets, then add pads.</p>
        )}
      </div>

      {seq && pattern && (
        <section className="sequencer">
          <header className="panel-head">
            <div>
              <h3>Step sequencer</h3>
              <p>Tempo-based pattern sketch for short-form SFX.</p>
            </div>
            <div className="bar-tools">
              <label>
                BPM
                <Input
                  type="number"
                  min={40}
                  max={240}
                  value={seq.tempo}
                  onChange={(e) =>
                    setSeq({ ...seq, tempo: Number(e.target.value) || 120 })
                  }
                />
              </label>
              <Button
                size="sm"
                variant={running ? "default" : "outline"}
                onClick={() => setRunning((v) => !v)}
              >
                <Play size={14} /> {running ? "Playing" : "Run"}
              </Button>
            </div>
          </header>
          <div className="seq-grid">
            {(profile?.pads || []).map((pad) => {
              const lane =
                pattern.lanes[pad.id] ||
                Array.from({ length: pattern.steps }, () => false);
              return (
                <div key={pad.id} className="seq-lane">
                  <span>{pad.label}</span>
                  <div className="seq-steps">
                    {lane.map((on, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`seq-step ${on ? "on" : ""} ${step === i && running ? "playhead" : ""}`}
                        onClick={() => {
                          const next = [...lane];
                          next[i] = !next[i];
                          setSeq({
                            ...seq,
                            patterns: seq.patterns.map((p) =>
                              p.id === pattern.id
                                ? {
                                    ...p,
                                    lanes: { ...p.lanes, [pad.id]: next },
                                  }
                                : p,
                            ),
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
