import { PageShell } from "@/components/site-pages";

export const metadata = { title: "Languages · Clipper Studio" };

const rows: [string, string, string][] = [
  ["Nepali", "नेपाली", "Devanagari"], ["Hindi", "हिन्दी", "Devanagari"], ["English", "English", "Latin"], ["Urdu", "اردو", "Arabic (RTL)"],
  ["Bengali", "বাংলা", "Bengali"], ["Tamil", "தமிழ்", "Tamil"], ["Arabic", "العربية", "Arabic (RTL)"], ["Spanish", "Español", "Latin"],
  ["French", "Français", "Latin"], ["Russian", "Русский", "Cyrillic"], ["Japanese", "日本語", "Kana / Kanji"], ["Korean", "한국어", "Hangul"],
  ["Chinese", "中文", "Han"], ["Thai", "ไทย", "Thai"],
];

export default function Languages() {
  return (
    <PageShell image="laptopArt" eyebrow="Languages" title="Built for more than English" lead="Keep the language of the interface, the audio, the transcript and the captions independent, and mix them as your content requires.">
      <div className="lp-section">
        <h2>What works today</h2>
        <div className="fgrid three">
          <div className="fcard static"><b>Interface</b><span>English, Nepali and Hindi on the home page.</span><small>Other screens are being translated.</small></div>
          <div className="fcard static"><b>Captions and text</b><span>Unicode throughout: import, edit, style and burn in captions in any script.</span><small>Check complex-script rendering in an exported video.</small></div>
          <div className="fcard static"><b>Translation</b><span>Translate timestamped caption lines with a text model installed in Ollama.</span><small>Quality depends on the model. Review before export.</small></div>
        </div>
        <h2>Speech recognition</h2>
        <p className="lead">Automatic transcription depends on the speech engine and model on your machine, and on the language of the recording. Clipper Studio does not assume support for any language: when no verified transcript source exists you can import subtitles (SRT, VTT, timed text), reuse source captions, or work manually.</p>
        <h2>Scripts you can caption</h2>
        <div className="table">
          <table>
            <thead><tr><th>Language</th><th>Sample</th><th>Script</th></tr></thead>
            <tbody>{rows.map(([n, s, sc]) => <tr key={n}><td>{n}</td><td>{s}</td><td>{sc}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="note">This table lists scripts you can display and burn into captions, not a guarantee of speech-recognition support for the language.</p>
        <h2>Mixed-language content</h2>
        <p className="lead">Code-switching such as Nepali–English or Hindi–English is common in creator content. Keep original wording in captions, translate only what you choose, and review model output for slang and names.</p>
      </div>
    </PageShell>
  );
}
