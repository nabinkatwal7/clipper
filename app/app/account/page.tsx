import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account-settings";
import { webUser } from "@/lib/web-session";
import { members, registrationState } from "@/lib/auth";

export const metadata = { title: "Account settings", robots: { index: false } };

export default async function AccountPage() {
  const user = await webUser();
  if (!user) redirect("/login?next=/app/account");
  const admin =
    user.role === "owner"
      ? { users: await members(user), mode: (await registrationState()).mode }
      : null;
  return (
    <main className="account-page">
      <a href="/app">Back to studio</a>
      <h1>Account settings</h1>
      <p>
        {user.email} · @{user.username}
      </p>
      <AccountSettings name={user.name} admin={admin} />
    </main>
  );
}
