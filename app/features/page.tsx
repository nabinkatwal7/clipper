import { PageShell } from "@/components/site-pages";
import { features, groups } from "@/lib/site-features";

export const metadata = { title: "Features · Clipper Studio" };

export default function Features() {
  return (
    <PageShell image="timeline" eyebrow="Features" title="Every tool in the studio" lead={`Four areas, ${features.length} tools. Each one is a real screen in the app; select any to see what it does.`}>
      <div className="lp-section">
        {groups.map((g) => (
          <div key={g} className="fgroup">
            <h2>{g}</h2>
            <div className="fgrid">
              {features.filter((f) => f.group === g).map((f) => (
                <a key={f.id} href={"/#" + f.id} className="fcard"><b>{f.title}</b><span>{f.tag}</span><small>{f.points[0]}</small></a>
              ))}
            </div>
          </div>
        ))}
        <div className="compare">
          <div><h3>AI-assisted</h3><ul><li>Highlight suggestions with reasons</li><li>Translation of timed captions</li><li>Semantic search</li><li>Compilation ordering proposals</li></ul></div>
          <div><h3>Always manual</h3><ul><li>Trimming, layout and effects</li><li>Fixed-length and manual clips</li><li>Caption styling and correction</li><li>Review, planning and export</li></ul></div>
        </div>
      </div>
    </PageShell>
  );
}
