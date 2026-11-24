import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter, samples } from "@/components/public-site";
import { webUser, webLocale } from "@/lib/web-session";

type Section = { title: string; lead: string; items: [string, string][] };
const pages: Record<string, Section> = {
  features: {
    title: "Features",
    lead: "Everything runs from one local Next.js application with FFmpeg, yt-dlp and your own Ollama models.",
    items: [
      ["Intelligent clipping", "Highlight discovery from timestamped transcripts, optional activity evidence, scoring and clip plans. Results reference real source timestamps."],
      ["Professional editing", "Timeline editor, layers, audio mixing, colour grading, reframing and B-roll suggestions."],
      ["Multilingual captions", "Import Unicode transcripts, translate timestamped segments with an installed text model, and style captions per clip."],
      ["Automation", "Channel monitoring, saved workflows and a local processing queue."],
      ["Creator tools", "Asset library, branding profiles, content calendar, publishing packages and export checks."],
      ["Local intelligence", "Semantic search and assisted analysis through Ollama. No other AI service is used."],
    ],
  },
  "how-it-works": {
    title: "How it works",
    lead: "A guided path from raw footage to exported clips. AI assists; every step can be done manually.",
    items: [
      ["1 · Import", "Upload a file or import a completed recording by URL within your size and duration limits."],
      ["2 · Analyze", "Use available subtitles or an imported transcript; a model proposes highlights (optional)."],
      ["3 · Generate", "Create vertical clips from suggestions, fixed durations or manual ranges."],
      ["4 · Edit", "Trim, reframe, layer, mix audio and grade in the editor."],
      ["5 · Captions", "Style, correct or translate captions. Review machine translation before export."],
      ["6 · Export", "Render clips and download post copy to publish yourself."],
    ],
  },
  privacy: {
    title: "Privacy",
    lead: "Clipper Studio keeps data on the machine that runs it. This describes behaviour; it is not a compliance certification.",
    items: [
      ["Media", "Stored on the host filesystem under your account's workspace folder."],
      ["Accounts", "Passwords are hashed with Argon2id. Sessions are random tokens stored hashed on disk and sent as HTTP-only cookies."],
      ["AI processing", "Sent to the configured Ollama server. If that server is remote, the content you submit is sent to it."],
      ["Downloads", "URL imports contact the source site. This is the main internet-dependent operation."],
      ["Logs", "Security events are recorded locally without passwords or tokens."],
      ["Deletion", "You can delete projects. Backups you create are yours to manage."],
    ],
  },
  terms: {
    title: "Terms of use",
    lead: "Plain-language terms for a self-hosted tool.",
    items: [
      ["Your content", "Import only media you own or are authorized to use. You are responsible for compliance with platform rules."],
      ["No warranty", "The software is provided as is. Review AI output, transcripts and translations before publishing."],
      ["Self-hosting", "You operate your own instance and are responsible for its security, backups and network exposure."],
    ],
  },
  docs: {
    title: "Documentation",
    lead: "Setup and operation notes.",
    items: [
      ["Install", "Install Node.js, FFmpeg, FFprobe, yt-dlp and Ollama, then run npm install and npm run dev. The app binds to 127.0.0.1:4000."],
      ["First run", "Open /register and paste the setup token from storage/auth/owner-setup-token.txt to create the owner account. Registration is then closed by default."],
      ["Recovery", "Each account gets a one-time recovery code at creation. The owner can also reset access."],
      ["Ollama", "Set OLLAMA_URL and OLLAMA_MODEL in .env.local. Capabilities depend on the installed models."],
      ["Limits", "Single-instance filesystem storage. Not designed for multi-server deployment or direct public internet exposure."],
    ],
  },
};
export function generateStaticParams() {
  return [...Object.keys(pages), "languages"].map((page) => ({ page }));
}
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const [u, l] = await Promise.all([webUser(), webLocale()]);
  if (page === "languages")
    return (
      <main className="public-site">
        <SiteHeader locale={l} logged={!!u} />
        <article className="prose">
          <h1>Languages</h1>
          <p className="lead">Interface, source media, transcripts, captions and metadata are separate concerns. Unicode is supported throughout.</p>
          <ul className="lang-grid">
            {samples.map(([n, t]) => (
              <li key={n}>
                <b>{n}</b>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="note">
            Sample lines are illustrative text, not output from a recording. Speech recognition and translation quality depend on the selected Ollama
            model and the source transcript; speech recognition is not assumed for any language until verified for your installed model. The interface
            is available in English, Nepali and Hindi on the home page; other pages are English for now.
          </p>
        </article>
        <SiteFooter locale={l} />
      </main>
    );
  const s = pages[page];
  if (!s) notFound();
  return (
    <main className="public-site">
      <SiteHeader locale={l} logged={!!u} />
      <article className="prose">
        <h1>{s.title}</h1>
        <p className="lead">{s.lead}</p>
        <dl>
          {s.items.map(([a, b]) => (
            <div key={a}>
              <dt>{a}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </article>
      <SiteFooter locale={l} />
    </main>
  );
}
