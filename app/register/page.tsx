import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { RegisterForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { registrationState } from "@/lib/auth";
import { webUser } from "@/lib/web-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account · Clipper Studio" };

export default async function Register() {
  const [u, r, h] = await Promise.all([webUser(), registrationState(), headers()]);
  if (u) redirect("/app");
  const host = (h.get("host") || "").replace(/:\d+$/, "");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  if (!r.first && r.mode === "closed")
    return (
      <AuthShell>
        <div className="auth-form">
          <h1>Registration is closed</h1>
          <p className="auth-sub">The workspace owner controls who can create accounts. Ask them for an invitation, or sign in if you already have an account.</p>
          <a className="site-button big" href="/login">Sign in</a>
        </div>
      </AuthShell>
    );
  return <AuthShell><RegisterForm needsToken={r.first && !loopback} invite={!r.first && r.mode === "invite"} /></AuthShell>;
}
