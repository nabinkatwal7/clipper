"use client";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
function strength(p: string) {
  let s = 0;
  if (p.length >= 12) s++;
  if (p.length >= 16) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^\w]/.test(p)) s++;
  return Math.min(s, 4);
}
function safe(next?: string | null) {
  return next && /^\/app(\/[\w\-./]*)?$/.test(next) && !next.includes("//") ? next : "/app";
}

function PasswordField({ name, label, value, onChange, autoComplete, minLength, hint }: {
  name: string; label: string; value?: string; onChange?: (v: string) => void; autoComplete: string; minLength?: number; hint?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      <span className="lbl">{label}{hint}</span>
      <span className="pw">
        <input name={name} type={show ? "text" : "password"} required minLength={minLength} maxLength={200} autoComplete={autoComplete}
          {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : {})} />
        <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

function useSubmit(path: string, build: (f: Record<string, string>) => unknown, done: (j: Record<string, string>) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(build(f)) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || "Something went wrong. Please try again.");
      else done(j);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button className="site-button big" disabled={busy}>
      {busy && <LoaderCircle className="spin" size={16} />}
      {children}
    </button>
  );
}
function ErrorNote({ error }: { error: string }) {
  return error ? <p className="auth-error" role="alert">{error}</p> : null;
}
export function RecoveryCode({ code, title, onDone }: { code: string; title: string; onDone: () => void }) {
  return (
    <div className="auth-form" role="status">
      <h1>{title}</h1>
      <p className="auth-sub">
        This one-time code lets you reset your password if you are locked out, because Clipper Studio does not send email. It is shown once and stored only as a hash.
      </p>
      <code className="recovery">{code}</code>
      <button className="site-secondary big" type="button" onClick={() => navigator.clipboard?.writeText(code)}>Copy code</button>
      <button className="site-button big" onClick={onDone}>I saved it — continue</button>
    </div>
  );
}

export function LoginForm({ next, canRegister }: { next?: string; canRegister: boolean }) {
  const { busy, error, submit } = useSubmit(
    "/api/auth/login",
    (f) => ({ identifier: f.identifier, password: f.password, remember: f.remember === "on" }),
    () => location.assign(safe(next)),
  );
  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Welcome back</h1>
      <p className="auth-sub">Sign in to your Clipper Studio workspace.</p>
      <label><span className="lbl">Email or username</span><input name="identifier" required maxLength={254} autoComplete="username" autoFocus /></label>
      <PasswordField name="password" label="Password" autoComplete="current-password" hint={<a href="/recover" className="lbl-link">Forgot password?</a>} />
      <label className="check"><input name="remember" type="checkbox" defaultChecked /> Keep me signed in</label>
      <ErrorNote error={error} />
      <Submit busy={busy}>Sign in</Submit>
      {canRegister && <p className="auth-alt">New to Clipper Studio? <a href="/register">Create an account</a></p>}
    </form>
  );
}

export function RegisterForm({ needsToken, invite, next }: { needsToken: boolean; invite: boolean; next?: string }) {
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const { busy, error, submit } = useSubmit(
    "/api/auth/register",
    (f) => ({ name: f.name, email: f.email, password: f.password, terms: f.terms === "on", setup: f.setup || undefined, invitation: f.invitation || undefined, remember: true }),
    (j) => (j.recovery ? setCode(j.recovery) : location.assign(safe(next))),
  );
  if (code) return <RecoveryCode code={code} title="Save your recovery code" onDone={() => location.assign(safe(next))} />;
  const s = strength(pw);
  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Create your account</h1>
      <p className="auth-sub">Start clipping in a minute. No credit card, no subscription.</p>
      {invite && <label><span className="lbl">Invitation code</span><input name="invitation" required autoComplete="off" /></label>}
      {needsToken && (
        <label>
          <span className="lbl">Server setup token</span>
          <input name="setup" required autoComplete="off" spellCheck={false} />
          <small>This server is not on localhost, so the first account needs the token printed in <code>storage/auth/owner-setup-token.txt</code> or <code>CLIPPER_SETUP_TOKEN</code>.</small>
        </label>
      )}
      <label><span className="lbl">Full name</span><input name="name" required maxLength={100} autoComplete="name" autoFocus /></label>
      <label><span className="lbl">Email</span><input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <PasswordField name="password" label="Password" value={pw} onChange={setPw} minLength={12} autoComplete="new-password" />
      <div className="meter" aria-live="polite">
        <span className="bar"><i style={{ width: s * 25 + "%" }} data-s={s} /></span>
        <span>{pw ? labels[s] : "At least 12 characters. A passphrase works well."}</span>
      </div>
      <label className="check"><input name="terms" type="checkbox" required /> I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy notes</a>.</label>
      <ErrorNote error={error} />
      <Submit busy={busy}>Create account</Submit>
      <p className="auth-alt">Already have an account? <a href="/login">Sign in</a></p>
    </form>
  );
}

export function RecoverForm() {
  const [code, setCode] = useState("");
  const { busy, error, submit } = useSubmit(
    "/api/auth/recover",
    (f) => ({ identifier: f.identifier, code: f.code.trim(), password: f.password }),
    (j) => setCode(j.recovery),
  );
  if (code) return <RecoveryCode code={code} title="Password updated" onDone={() => location.assign("/login")} />;
  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Reset your password</h1>
      <p className="auth-sub">Enter the recovery code you saved when you created your account. A new one is issued after a reset.</p>
      <label><span className="lbl">Email or username</span><input name="identifier" required maxLength={254} autoComplete="username" autoFocus /></label>
      <label><span className="lbl">Recovery code</span><input name="code" required minLength={20} maxLength={120} autoComplete="off" spellCheck={false} /></label>
      <PasswordField name="password" label="New password" minLength={12} autoComplete="new-password" />
      <ErrorNote error={error} />
      <Submit busy={busy}>Reset password</Submit>
      <p className="auth-alt">Lost the code? On a self-hosted install the workspace owner can reset your access. <a href="/login">Back to sign in</a></p>
    </form>
  );
}
