import { Photo } from "./landing";
import type { PhotoKey } from "@/lib/photos";
import { Cpu, HardDrive, Globe2, Lock } from "lucide-react";

const audiences: [PhotoKey, string, string][] = [
  ["streamDesk", "Streamers", "Turn long broadcasts into a week of shorts. Watch channels for new recordings and review suggested highlights."],
  ["mic", "Podcasters", "Find the quotable minute in a two-hour conversation, caption it and export a vertical teaser."],
  ["lecture", "Talks and education", "Cut a keynote or lecture into short explainers with accurate, editable captions."],
  ["gamer", "Gaming channels", "Surface reactions and clutch moments from long sessions, then compile the best ones."],
  ["camera", "Video makers", "Reframe landscape footage to 9:16 with layouts, grading and audio mixing on a real timeline."],
  ["studioRoom", "Music and creative", "Bring your own recordings and keep full control over trims, captions and branding."],
];
export function Audiences() {
  return (
    <section className="lp-section" id="who">
      <p className="eyebrow">Who it is for</p>
      <h2>Made for people who record a lot</h2>
      <div className="aud">
        {audiences.map(([k, t, d]) => (
          <article key={t}>
            <Photo k={k} w={640} h={420} />
            <div><h3>{t}</h3><p>{d}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Journey() {
  const steps: [PhotoKey, string, string][] = [
    ["streamDesk", "Record", "Stream or record as you already do. Clipper Studio works with completed recordings and files you own."],
    ["timeline", "Clip", "Analyze the transcript for highlights, or place cuts by hand on the timeline."],
    ["earth", "Localize", "Caption in the original language or translate lines, and style every track."],
  ];
  return (
    <section className="lp-section" id="journey">
      <p className="eyebrow">Workflow</p>
      <h2>From stream to short, without leaving your machine</h2>
      <div className="journey">
        {steps.map(([k, t, d], i) => (
          <div key={t}>
            <Photo k={k} w={720} h={480} />
            <span>0{i + 1}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SelfHost() {
  const cards = [
    [Cpu, "Runs on your hardware", "CPU works out of the box. An NVIDIA GPU speeds up transcription, and Ollama uses supported GPUs automatically."],
    [HardDrive, "Files, not a database", "Projects, transcripts and clips are plain files in a storage folder you can back up or move."],
    [Lock, "Accounts built in", "Sign-in with Argon2id password hashing, hashed sessions, per-user workspaces and recovery codes."],
    [Globe2, "Windows, macOS and Linux", "Needs Node.js, FFmpeg, yt-dlp and Ollama, plus Python for local transcription."],
  ] as const;
  return (
    <section className="lp-section selfhost" id="self-host">
      <div className="sh-img"><Photo k="servers" w={900} h={900} /></div>
      <div>
        <p className="eyebrow">Self-hosted</p>
        <h2>Your machine is the cloud</h2>
        <p className="lead">There is nothing to subscribe to. Install it, create an account and start clipping.</p>
        <ul className="sh-list">
          {cards.map(([Icon, t, d]) => (
            <li key={t}><Icon size={20} /><div><b>{t}</b><span>{d}</span></div></li>
          ))}
        </ul>
        <a className="more" href="/docs">Read the setup guide →</a>
      </div>
    </section>
  );
}

export function TechStrip() {
  const items = ["Next.js", "FFmpeg", "Ollama", "yt-dlp", "Faster Whisper", "Argon2id"];
  return (
    <section className="tech" aria-label="Built with">
      <p>Built on open tools</p>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}
