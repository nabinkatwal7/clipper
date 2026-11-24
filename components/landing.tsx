import { Scissors, Languages, ShieldCheck, ArrowRight } from "lucide-react";
import { features, groups, type Feature } from "@/lib/site-features";
import { photo, photos, featurePhoto } from "@/lib/photos";

export function Photo({ k, w = 1200, h = 800, className }: { k: keyof typeof photos; w?: number; h?: number; className?: string }) {
  const [id, alt] = photos[k];
  return <img className={className} src={photo(id, w, h)} width={w} height={h} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
}

export function ProductPreview() {
  const rows = [
    ["12:04 – 12:41", "Unexpected reaction to the final round"],
    ["31:18 – 31:52", "Story about the first stream setup"],
    ["48:03 – 48:40", "Chat debate over the map choice"],
    ["1:02:27 – 1:03:01", "Funniest misplay of the night"],
  ];
  const tracks: [string, number[][]][] = [
    ["Video", [[2, 30], [34, 26], [64, 30]]],
    ["Captions", [[4, 20], [28, 18], [50, 22], [76, 18]]],
    ["Audio", [[0, 96]]],
  ];
  return (
    <figure className="preview" aria-label="Illustration of the Clipper Studio editor">
      <div className="pv-window">
        <div className="pv-bar"><i /><i /><i /><span>Clipper Studio — editor</span></div>
        <div className="pv-body">
          <aside className="pv-side">
            {["Overview", "Projects", "Discover", "Video editor", "Subtitle studio", "Streamers", "Workflows"].map((n, i) => (
              <span key={n} data-on={i === 3}>{n}</span>
            ))}
          </aside>
          <div className="pv-main">
            <div className="pv-stage">
              <div className="pv-phone">
                <div className="pv-frame" />
                <p className="pv-cap">एउटै कथा, <b>धेरै भाषा</b></p>
              </div>
              <ul className="pv-list">
                <li className="pv-h">Suggested highlights</li>
                {rows.map(([t, d], i) => (
                  <li key={t} data-on={i === 0}><code>{t}</code><span>{d}</span></li>
                ))}
              </ul>
            </div>
            <div className="pv-timeline">
              {tracks.map(([n, segs]) => (
                <div key={n} className="pv-track"><b>{n}</b><div>
                  {segs.map(([l, w]) => <i key={l} style={{ left: l + "%", width: w + "%" }} />)}
                </div></div>
              ))}
              <span className="pv-head" />
            </div>
          </div>
        </div>
      </div>
      <figcaption>Illustration of the editor layout with sample text. Not a recording of real footage.</figcaption>
    </figure>
  );
}

export function FactStrip() {
  const facts = [["Local AI", "Runs on your Ollama server"], ["Multilingual", "Unicode captions in any script"], ["Private", "Media stays on your machine"], ["No subscription", "Free to self-host"]];
  return (
    <section className="facts">
      {facts.map(([a, b]) => <div key={a}><b>{a}</b><span>{b}</span></div>)}
    </section>
  );
}

function FeaturePreview({ f }: { f: Feature }) {
  return (
    <div className="fp">
      <Photo k={featurePhoto[f.id]} w={900} h={460} className="fp-img" />
      <div className="fp-bar"><i /><i /><i /><span>{f.title}</span></div>
      <dl>{f.sample.map(([k, v]) => <div key={k}><dt>{k}</dt><dd lang={/[ऀ-ॿ]/.test(v) ? "ne" : undefined}>{v}</dd></div>)}</dl>
      <p>Sample interface data · stock photo</p>
    </div>
  );
}

export function FeatureSections() {
  return (
    <div id="features">
      <nav className="feature-nav" aria-label="Feature groups">
        {groups.map((g) => <a key={g} href={"#" + features.find((f) => f.group === g)!.id}>{g}</a>)}
      </nav>
      {groups.map((g) => (
        <div key={g}>
          <div className="group-head"><p className="eyebrow">{g}</p></div>
          {features.filter((f) => f.group === g).map((f, i) => (
            <section key={f.id} id={f.id} className="feat" data-flip={i % 2}>
              <div className="feat-copy">
                <p className="eyebrow">{f.title}</p>
                <h2>{f.tag}</h2>
                <p>{f.text}</p>
                <ul>{f.points.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
              <FeaturePreview f={f} />
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}

const langs = [["नेपाली", "यो क्षण सम्झनलायक छ।"], ["हिन्दी", "यह पल याद रखने लायक है।"], ["English", "A moment worth remembering."], ["Español", "Un momento para recordar."], ["العربية", "لحظة تستحق التذكر."], ["日本語", "記憶に残る瞬間。"], ["한국어", "기억할 만한 순간."], ["中文", "值得铭记的时刻。"]];
export function LanguagesBand() {
  return (
    <section className="lp-section band" id="languages">
      <p className="eyebrow"><Languages size={14} /> Multilingual</p>
      <h2>Great content speaks every language</h2>
      <p className="lead">Interface, source audio, transcript and captions are separate choices. Unicode is supported end to end.</p>
      <ul className="lang-grid">{langs.map(([n, t]) => <li key={n}><b>{n}</b><span>{t}</span></li>)}</ul>
      <p className="note">Sample lines for illustration. Transcription and translation quality depend on the model you choose and on the source transcript; speech recognition is only offered where it is verified to work. <a href="/languages">See language details</a></p>
    </section>
  );
}

export function PrivacyBand() {
  const items = ["Videos stay on your machine", "AI runs through your Ollama server", "No subscription and no external database", "Downloading source videos needs the internet", "A remote Ollama server receives the content you submit"];
  return (
    <section className="lp-section split" id="privacy">
      <div>
        <p className="eyebrow"><ShieldCheck size={14} /> Local-first</p>
        <h2>You own the footage and the project</h2>
        <p className="lead">Accounts, sessions and projects are stored as files on the host. Passwords are hashed with Argon2id and each user gets an isolated workspace.</p>
        <a className="more" href="/privacy">Read the privacy notes <ArrowRight size={14} /></a>
      </div>
      <ul className="checks">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

export function ClosingCta({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <section className="lp-section cta">
      <Photo k="timeline" w={1600} h={600} className="cta-bg" />
      <Scissors size={28} />
      <h2>{title}</h2>
      <a className="site-button big" href={href}>{label}</a>
    </section>
  );
}
