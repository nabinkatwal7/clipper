import { redirect } from "next/navigation";
import Workspace from "@/components/workspace";
import { AccountBar } from "@/components/account-bar";
import { webUser } from "@/lib/web-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clipper Studio", robots: { index: false } };

export default async function AppPage() {
  const u = await webUser();
  if (!u) redirect("/login?next=/app");
  return (
    <>
      <Workspace />
      <AccountBar name={u.name} role={u.role} />
    </>
  );
}
