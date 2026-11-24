import { PageShell, DocLayout } from "@/components/site-pages";

export const metadata = { title: "Privacy · Clipper Studio" };

export default function Privacy() {
  return (
    <PageShell image="circuit" cta={false} eyebrow="Privacy" title="Privacy notes" lead="Clipper Studio is software you run yourself. These notes describe what it does with data; they are not a compliance certification.">
      <DocLayout updated="2026-11-24" sections={[
        { id: "overview", title: "Overview", body: <p>Your media, transcripts and projects are stored on the machine that runs Clipper Studio. The software includes no analytics or advertising, and does not upload your media to a Clipper-operated service.</p> },
        { id: "accounts", title: "Accounts and sessions", body: <p>Name, email and username are stored in a local file. Passwords are hashed with Argon2id and are never stored in plain text. Session tokens are random, stored hashed, and sent in HTTP-only cookies. Security events are written to a local log without passwords or tokens.</p> },
        { id: "media", title: "Media and projects", body: <p>Each account has its own workspace folder, and other accounts cannot read it through the app. The server operator, who controls the machine, can access the underlying files.</p> },
        { id: "ai", title: "AI processing", body: <p>AI features call the Ollama server you configure. When it runs on the same machine, content stays there. If you point the studio at a remote Ollama server, transcripts and prompts you submit are sent to it.</p> },
        { id: "network", title: "Network requests", body: <p>URL imports contact the source website. Model downloads contact the Ollama registry. The public pages (home, features, docs and similar) load stock photos from Unsplash&apos;s image servers, which can see your IP address; the studio itself does not. Editing local files does not need the internet once dependencies are installed.</p> },
        { id: "deletion", title: "Deleting your data", body: <p>Deleting a project removes its source, transcript, thumbnails and renders. Backups are separate files you control. The operator can remove an account&apos;s workspace folder.</p> },
        { id: "cookies", title: "Cookies and storage", body: <p>One session cookie keeps you signed in and a language cookie remembers your interface language. Preferences such as theme are kept in your browser&apos;s local storage.</p> },
        { id: "contact", title: "Questions", body: <p>Because you run your own instance, contact the person operating it for questions about data on that server.</p> },
      ]} />
    </PageShell>
  );
}
