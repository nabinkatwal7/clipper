import { SiteHeader, SiteFooter } from "./public-site";
import { webUser, webLocale } from "@/lib/web-session";
import { ClosingCta } from "./landing";

export async function PageShell({ eyebrow, title, lead, children, cta = true }: { eyebrow: string; title: string; lead: string; children: React.ReactNode; cta?: boolean }) {
  const [u, l] = await Promise.all([webUser(), webLocale()]);
  return (
    <main className="public-site">
      <SiteHeader locale={l} logged={!!u} />
      <header className="page-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
      </header>
      {children}
      {cta && <ClosingCta href={u ? "/app" : "/register"} label={u ? "Open studio" : "Create your account"} title="Your next great clip is already in the footage." />}
      <SiteFooter locale={l} />
    </main>
  );
}

export type DocSection = { id: string; title: string; body: React.ReactNode };
export function DocLayout({ sections, updated }: { sections: DocSection[]; updated?: string }) {
  return (
    <div className="doc">
      <nav className="doc-toc" aria-label="On this page">
        {sections.map((s) => <a key={s.id} href={"#" + s.id}>{s.title}</a>)}
      </nav>
      <div className="doc-body">
        {updated && <p className="doc-updated">Last updated {updated}</p>}
        {sections.map((s) => <section key={s.id} id={s.id}><h2>{s.title}</h2>{s.body}</section>)}
      </div>
    </div>
  );
}
