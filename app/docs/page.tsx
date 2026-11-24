import { PageShell, DocLayout } from "@/components/site-pages";

export const metadata = { title: "Documentation · Clipper Studio" };

const code = (s: string) => <pre><code>{s}</code></pre>;
const note = (c: React.ReactNode) => <div className="callout"><p>{c}</p></div>;
const table = (head: string[], rows: React.ReactNode[][]) => (
  <div className="table"><table>
    <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
  </table></div>
);

export default function Docs() {
  return (
    <PageShell image="code" cta={false} eyebrow="Documentation" title="Install, run and operate Clipper Studio" lead="Everything needed to get a working instance: requirements, installation per operating system, configuration, daily use and troubleshooting.">
      <DocLayout sections={[
        { id: "overview", title: "Overview", body: <>
          <p>Clipper Studio is a self-hosted Next.js application. It imports a recording, reads its subtitles (published with the video, or a file you import), asks a local Ollama model for highlight candidates, and renders vertical clips with FFmpeg. Projects and media are stored as files on your machine; there is no database or paid API.</p>
          {note(<>AI output is a suggestion. Highlights are based on the transcript, so purely visual moments can be missed, and scores are model estimates rather than measured engagement. Built-in speech recognition is not included: without a transcript you can still make fixed-length and manual clips.</>)}
        </> },
        { id: "requirements", title: "Requirements", body: <>
          {table(["Component", "Needed for", "Notes"], [
            ["Node.js 22 or 24 LTS", "The application", "Required"],
            ["FFmpeg + FFprobe", "Probing, rendering, thumbnails", "Must include the libass subtitle filter"],
            ["yt-dlp", "Importing from a URL", "Keep current; platform support changes"],
            ["Ollama", "Highlights, translation, search", "Studio still works manually without it"],
          ])}
          <p>Python is not required. A GPU is optional: CPU encoding works, and Ollama uses supported GPUs automatically.</p>
        </> },
        { id: "install", title: "Install", body: <>
          <p>Install the system tools first and make sure each command is on your PATH <b>before</b> starting Next.js.</p>
          <div className="os-tabs">
            <details open><summary>Windows (PowerShell)</summary><div>
              {code("winget install Gyan.FFmpeg\nwinget install yt-dlp.yt-dlp\nwinget install Ollama.Ollama\nollama pull qwen2.5:3b")}
              <p>Open a new terminal after installing so the new commands are on your PATH.</p>
            </div></details>
            <details><summary>macOS (Homebrew)</summary><div>
              {code("brew install node@22 ffmpeg yt-dlp ollama\nollama serve\n# in another terminal\nollama pull qwen2.5:3b")}
            </div></details>
            <details><summary>Linux (Ubuntu / Debian)</summary><div>
              {code("sudo apt update\nsudo apt install ffmpeg pipx\npipx install yt-dlp\n# install Ollama from ollama.com/download/linux, then\nollama serve\nollama pull qwen2.5:3b")}
            </div></details>
          </div>
        </> },
        { id: "start", title: "Start the studio", body: <>
          {code("npm install\nnpm run dev")}
          <p>Open <code>http://127.0.0.1:4000</code> and keep Ollama running while you work. Use the same address every time: browsers keep sign-in cookies per host, so <code>localhost</code> and <code>127.0.0.1</code> are separate sessions.</p>
          <p>Copy <code>.env.example</code> to <code>.env.local</code> to change settings, then run <code>npm run health</code> to check every tool. For a production run use <code>npm run build</code> then <code>npm start</code> on a persistent Node server; do not deploy to serverless platforms.</p>
        </> },
        { id: "account", title: "Create your account", body: <>
          <p>Open <code>/register</code> and sign up with your name, email and a password of at least 12 characters. The first account becomes the workspace owner; later sign-ups are members unless the owner switches registration to invitation-only or closed.</p>
          <p>Each account receives a one-time recovery code. Save it: there is no email service, so the code is how you reset a forgotten password at <code>/recover</code>.</p>
          {note(<>If you reach the server through anything other than localhost, the very first account also needs the setup token from <code>CLIPPER_SETUP_TOKEN</code> or <code>storage/auth/owner-setup-token.txt</code>. This stops strangers claiming a new install.</>)}
        </> },
        { id: "existing", title: "Projects from before accounts", body: <p>Earlier projects live directly in the storage folder. After signing in as the owner, select <b>Claim existing projects</b> in the studio. A metadata backup is written to <code>storage/backups/</code>, then files are moved into your workspace. Nothing is deleted, and members never see unclaimed projects.</p> },
        { id: "use", title: "Using the studio", body: <>
          <ol>
            <li>Choose <b>New project</b>, paste a public YouTube, Twitch, Kick or direct video URL, or upload a file.</li>
            <li>Set clip length, count, ratio, resolution, layout and captions. Defaults are 30–60 seconds, 9:16, 720 × 1280 with captions.</li>
            <li>Generate. Real stages appear as the worker downloads, analyzes and renders.</li>
            <li>Preview clips, adjust trims, captions and crop, and re-render.</li>
            <li>Download an MP4, an MP4 with caption text, or a ZIP of a whole project.</li>
          </ol>
          <h3>Transcripts</h3>
          <p>If the video publishes subtitles, they are imported automatically. Otherwise import an SRT or VTT file in <b>Transcript explorer</b>. With no transcript, AI highlights and captions are skipped: the studio falls back to fixed-length clips and says so on each clip.</p>
          <p>Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd> to jump to any project, clip, channel, page or command. Live broadcasts are rejected; use completed recordings.</p>
        </> },
        { id: "config", title: "Configuration", body: <>
          <p>Set these in <code>.env.local</code>:</p>
          {table(["Variable", "Default", "Purpose"], [
            [<code key="a">OLLAMA_URL</code>, "http://127.0.0.1:11434", "Ollama server. A remote URL receives your transcripts."],
            [<code key="b">OLLAMA_MODEL</code>, "qwen2.5:3b", "Model used for analysis and translation"],
            [<code key="c">FFMPEG_BIN / FFPROBE_BIN / YTDLP_BIN</code>, "from PATH", "Absolute paths if the tools are not on PATH"],
            [<code key="d">FFMPEG_THREADS / FFMPEG_PRESET</code>, "8 / superfast", "Encoding speed and CPU use"],
            [<code key="e">MAX_UPLOAD_MB</code>, "5120", "Upload and download size limit"],
            [<code key="f">MAX_VIDEO_HOURS</code>, "12", "Longest source accepted"],
            [<code key="h">CLIPPER_STORAGE_DIR</code>, "./storage", "Absolute path to relocate all data"],
            [<code key="i">CLIPPER_SETUP_TOKEN</code>, "—", "First-account token for non-localhost installs"],
          ])}
        </> },
        { id: "storage", title: "Where data lives", body: <>
          {code("storage/\n  auth/                  accounts, sessions, security log\n  workspaces/<user-id>/  one folder per account:\n    uploads/ audio/ transcripts/ projects/ clips/ assets/ temp/ backups/\n  backups/               legacy-claim backups")}
          <p>Everything is plain files written with temporary files and atomic renames. Persistence is designed for one application instance, not multiple servers.</p>
        </> },
        { id: "backups", title: "Backups", body: <p>Open <b>Backup &amp; recovery</b> to create checksummed backups and restore them into a separate folder. You can also stop the server and copy the whole storage folder.</p> },
        { id: "api", title: "API and automation", body: <>
          <p>The studio is built on Next.js route handlers (<code>/api/import</code>, <code>/api/analyze</code>, <code>/api/generate</code>, <code>/api/progress</code>, <code>/api/edit</code>, <code>/api/download</code> and others). Every route requires a signed-in session cookie and only returns the caller&apos;s own data.</p>
          {note(<>The <code>npm run clipper</code> command-line tool and the smoke-test scripts call these routes without a session, so they need updating before they work against an instance with accounts.</>)}
        </> },
        { id: "security", title: "Security", body: <ul>
          <li>Passwords use Argon2id; session tokens are random and stored hashed.</li>
          <li>Cookies are HTTP-only and SameSite strict. Use HTTPS if the server is not on localhost.</li>
          <li>Sign-in and recovery are rate limited, and errors do not reveal whether an account exists.</li>
          <li>URL downloads check every connection and reject non-public addresses.</li>
          <li>Keep the app on localhost, or put it behind a TLS reverse proxy. It is not hardened for direct internet exposure.</li>
        </ul> },
        { id: "troubleshooting", title: "Troubleshooting", body: <>
          {table(["Problem", "Fix"], [
            ["“No active Node.js version”", "Select an installed version, e.g. nvm use 24."],
            ["“No source transcript is available”", "The video has no subtitles. Import an SRT/VTT file in Transcript explorer, or use fixed-length clips; processing continues without captions."],
            ["URL import fails", "Update yt-dlp, and confirm the link is a finished public recording."],
            ["No AI suggestions", "Check ollama serve is running and the model is pulled; npm run health shows each check."],
            ["Captions look wrong", "Make sure FFmpeg has libass, and preview an exported clip."],
            ["Signed out unexpectedly", "You are probably on a different host (localhost vs 127.0.0.1). Use one address."],
            ["Locked out", "Reset your password at /recover with your recovery code, or ask the owner."],
          ])}
        </> },
      ]} />
    </PageShell>
  );
}
