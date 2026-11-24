import { Wordmark } from "./public-site";
import { Check } from "lucide-react";

const points = [
  "Find highlights in long recordings with local AI",
  "Cut vertical clips and caption them in your language",
  "Your media stays on your machine",
  "No subscription, no credit card",
];
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-main">
        <Wordmark />
        <div className="auth-slot">{children}</div>
        <p className="auth-foot"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/">Back to home</a></p>
      </div>
      <aside className="auth-aside" aria-hidden="false">
        <p className="eyebrow">Clipper Studio</p>
        <h2>Turn hours of footage into moments worth watching.</h2>
        <ul>{points.map((p) => <li key={p}><Check size={16} />{p}</li>)}</ul>
        <p className="auth-note">Speech recognition and translation depend on the Ollama models you install.</p>
      </aside>
    </main>
  );
}
