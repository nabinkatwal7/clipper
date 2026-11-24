import { PageShell } from "@/components/site-pages";

export const metadata = { title: "How it works · Clipper Studio" };

const steps = [
  ["Import a stream or video", "Upload a file or paste a link to a finished recording. The source is inspected for duration and formats first, and limits on size and length are enforced.", "Manual", "You choose the source and the quality budget."],
  ["Analyze interesting moments", "The recording is transcribed or its subtitles are reused, then a local Ollama model proposes highlights. Audio and scene activity can add supporting evidence.", "AI-assisted", "Suggestions cite real timestamps and reasons. With no transcript, use manual and fixed-length clips instead."],
  ["Generate vertical clips", "Turn suggestions, fixed durations or hand-picked ranges into 9:16 clips with reframing and a consistent look.", "Either", "Choose length, count, format and captions before rendering."],
  ["Edit and customize", "Open any clip in the timeline editor to trim, add layers and B-roll, mix audio, grade colour and apply effects.", "Manual", "Every change is yours, with history and checkpoints."],
  ["Translate or style captions", "Import or correct subtitles, translate with an installed model, and style original, translated or bilingual tracks.", "AI-assisted", "Machine translation is a draft. Review before export."],
  ["Export ready-to-publish videos", "Render MP4s, download ZIPs, and build a publishing package with post copy. You publish it yourself.", "Manual", "Nothing is posted automatically."],
];

export default function How() {
  return (
    <PageShell image="clapper" eyebrow="How it works" title="From recording to ready-to-post" lead="A guided path where AI helps at two steps and every other step is yours to control.">
      <div className="lp-section">
        <ol className="steps">
          {steps.map(([t, d, kind, note], i) => (
            <li key={t}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
                <p className="steps-note"><span className="badge" data-k={kind}>{kind}</span>{note}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </PageShell>
  );
}
