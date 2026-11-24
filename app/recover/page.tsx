import { redirect } from "next/navigation";
import { RecoverForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { webUser } from "@/lib/web-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password · Clipper Studio" };

export default async function Recover() {
  if (await webUser()) redirect("/app");
  return <AuthShell><RecoverForm /></AuthShell>;
}
