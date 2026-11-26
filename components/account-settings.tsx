"use client";

import { useState, type FormEvent } from "react";

type Admin = {
  mode: string;
  users: { id: string; name: string; role: string; disabled: boolean }[];
};

export function AccountSettings({
  name,
  admin,
}: {
  name: string;
  admin: Admin | null;
}) {
  const [operation, select] = useState("profile");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          password: fields.get("password"),
          value: fields.get("value") ?? undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to save settings.");
      if (operation === "password" || operation === "revoke") {
        location.assign("/login");
        return;
      }
      form.reset();
      if (operation === "invite")
        setNotice("One-time invitation code · " + data.result);
      else location.reload();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="account-settings" onSubmit={submit}>
      <label className="field">
        Action
        <select
          value={operation}
          onChange={(event) => {
            select(event.target.value);
            setNotice("");
            setError("");
          }}
        >
          <option value="profile">Change display name</option>
          <option value="password">Change password</option>
          <option value="revoke">Sign out all sessions</option>
          {admin && (
            <>
              <option value="mode">Change registration mode</option>
              <option value="invite">Create invitation</option>
              <option value="disable">Disable member</option>
              <option value="enable">Enable member</option>
            </>
          )}
        </select>
      </label>
      {operation === "profile" && (
        <label className="field">
          Display name
          <input name="value" defaultValue={name} maxLength={100} required />
        </label>
      )}
      {operation === "password" && (
        <label className="field">
          New password
          <input
            name="value"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
            required
          />
        </label>
      )}
      {operation === "mode" && (
        <label className="field">
          Registration mode
          <select name="value" defaultValue={admin?.mode}>
            <option value="closed">Closed</option>
            <option value="invite">Invitation only</option>
            <option value="open">Open</option>
          </select>
        </label>
      )}
      {(operation === "enable" || operation === "disable") && (
        <label className="field">
          Member
          <select name="value" defaultValue="" required>
            <option value="">Choose member</option>
            {admin?.users
              .filter(
                (user) =>
                  user.role === "member" &&
                  user.disabled === (operation === "enable"),
              )
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="field">
        Current password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
        />
      </label>
      <button className="site-button" disabled={busy}>
        {busy ? "Saving…" : "Confirm action"}
      </button>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
