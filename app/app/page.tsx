import { redirect } from "next/navigation";
import Workspace from "@/components/workspace";
import { AccountBar } from "@/components/account-bar";
import { webLocale, webUser } from "@/lib/web-session";
import { StudioLocaleProvider } from "@/components/studio-locale";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clipper Studio", robots: { index: false } };

export default async function AppPage() {
  const u = await webUser();
  if (!u) redirect("/login?next=/app");
  return (
    <div data-workspace-user={u.id} style={{ display: "contents" }}>
      <StudioLocaleProvider locale={await webLocale()}>
        <Workspace account={<AccountBar name={u.name} role={u.role} />} />
      </StudioLocaleProvider>
    </div>
  );
}
