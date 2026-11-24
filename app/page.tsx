import { SiteHeader, SiteFooter, Workflow, faq } from "@/components/public-site";
import { ProductPreview, FactStrip, FeatureSections, LanguagesBand, PrivacyBand, ClosingCta } from "@/components/landing";
import { Audiences, Journey, SelfHost, TechStrip } from "@/components/landing-extra";
import { copy } from "@/lib/public-copy";
import { webUser, webLocale } from "@/lib/web-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clipper Studio — local-first video clipping", description: "Find highlights, make vertical clips and caption them in your language. Local AI, no subscription." };

export default async function Home() {
  const [user, l] = await Promise.all([webUser(), webLocale()]);
  const t = copy[l];
  const href = user ? "/app" : "/register";
  return (
    <main className="public-site">
      <SiteHeader locale={l} logged={!!user} />
      <section className="site-hero">
        <div className="hero-copy">
          <div className="capability">Local AI <b>·</b> Multilingual <b>·</b> No subscription</div>
          <h1>{t.line} <em>{t.em}</em></h1>
          <p>{t.desc}</p>
          <div className="site-actions">
            <a className="site-button big" href={href}>{user ? t.open : t.register}</a>
            <a className="site-secondary big" href="#features">{t.features}</a>
          </div>
        </div>
        <ProductPreview />
      </section>
      <FactStrip />
      <Audiences />
      <section className="lp-section" id="how-it-works">
        <p className="eyebrow">{t.nav[1]}</p>
        <h2>Six steps, one workspace</h2>
        <Workflow locale={l} />
      </section>
      <Journey />
      <FeatureSections />
      <SelfHost />
      <LanguagesBand />
      <TechStrip />
      <PrivacyBand />
      <section className="lp-section faq" id="faq">
        <h2>Questions</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <ClosingCta href={href} label={user ? t.open : "Open Clipper Studio"} title={t.close} />
      <SiteFooter locale={l} />
    </main>
  );
}
