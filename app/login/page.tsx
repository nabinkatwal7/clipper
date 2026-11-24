import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { registrationState } from "@/lib/auth";
import { webUser } from "@/lib/web-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Clipper Studio" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [u, r, q] = await Promise.all([webUser(), registrationState(), searchParams]);
  if (u) redirect("/app");
  return <AuthShell><LoginForm next={q.next} canRegister={r.first || r.mode !== "closed"} /></AuthShell>;
}
