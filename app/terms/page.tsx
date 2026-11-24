import { PageShell, DocLayout } from "@/components/site-pages";

export const metadata = { title: "Terms · Clipper Studio" };

export default function Terms() {
  return (
    <PageShell image="desk" cta={false} eyebrow="Terms" title="Terms of use" lead="Plain-language terms for a self-hosted video clipping tool.">
      <DocLayout updated="2026-11-24" sections={[
        { id: "use", title: "Using the software", body: <p>Clipper Studio helps you edit and caption video you have the right to use. You are responsible for your instance, your accounts and the content processed on it.</p> },
        { id: "content", title: "Your content", body: <p>Only import media you own or are authorized to use, and follow the rules of any platform you publish to. The software does not bypass DRM or access restrictions.</p> },
        { id: "ai", title: "AI output", body: <p>Highlights, transcripts and translations may be inaccurate. Review them before publishing. The software does not publish anything on your behalf.</p> },
        { id: "accounts", title: "Accounts", body: <p>Keep your password and recovery code safe. The workspace owner may disable accounts or change registration settings on their instance.</p> },
        { id: "warranty", title: "No warranty", body: <p>The software is provided as is, without warranty of any kind. Keep your own backups.</p> },
        { id: "changes", title: "Changes", body: <p>These terms may change as the software changes. The date at the top shows the latest revision.</p> },
      ]} />
    </PageShell>
  );
}
