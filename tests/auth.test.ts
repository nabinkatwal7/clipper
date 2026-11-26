import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dir = "";
let auth: typeof import("../lib/auth");
test.before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "clipper-auth-"));
  process.env.CLIPPER_STORAGE_DIR = dir;
  auth = await import("../lib/auth");
});
const base = {
  name: "Owner",
  username: "owner",
  email: "Owner@Example.com",
  password: "correct horse battery",
  confirm: "correct horse battery",
  terms: true,
};

test("first account becomes owner on localhost without a token; remote first-run needs one", async () => {
  assert.equal((await auth.registrationState()).first, true);
  await assert.rejects(
    auth.register({ ...base, setup: "wrong" }, false),
    /setup token/i,
  );
  const { user, recovery } = await auth.register(base, true);
  assert.equal(user.role, "owner");
  assert.equal(user.email, "owner@example.com");
  assert.equal(user.username, "owner");
  assert.ok(recovery.length >= 20);
});

test("open registration creates members with generated usernames; duplicates are refused", async () => {
  const owner = await auth.login("owner", base.password);
  const details = {
    name: "Mem",
    email: "owner@other.com",
    password: "another long passphrase",
    terms: true,
  };
  await assert.rejects(auth.register(details), /registration is closed/i);
  await auth.manage(owner, {
    operation: "mode",
    password: base.password,
    value: "open",
  });
  const m = await auth.register({
    name: "Mem",
    email: "owner@other.com",
    password: "another long passphrase",
    terms: true,
  });
  assert.equal(m.user.role, "member");
  assert.match(m.user.username, /^owner-[0-9a-f]{4}$/);
  await assert.rejects(
    auth.register({
      name: "Mem",
      email: "OWNER@example.com",
      password: "another long passphrase",
      terms: true,
    }),
    /unavailable/,
  );
});

test("invitations are single use and members cannot change registration mode", async () => {
  const owner = await auth.login("owner", base.password);
  await auth.manage(owner, {
    operation: "mode",
    password: base.password,
    value: "invite",
  });
  const invitation = await auth.manage(owner, {
    operation: "invite",
    password: base.password,
  });
  const details = {
    name: "Invited",
    email: "invited@example.com",
    password: "long invited passphrase",
    terms: true,
    invitation,
  };
  const { user } = await auth.register(details);
  await assert.rejects(
    auth.register({ ...details, email: "second@example.com" }),
    /invitation/i,
  );
  await assert.rejects(
    auth.manage(user, {
      operation: "mode",
      password: details.password,
      value: "open",
    }),
    /owner access/i,
  );
});

test("login uses generic errors and passwords are never stored in plaintext", async () => {
  await assert.rejects(
    auth.login("owner", "wrong password!!"),
    /Invalid sign-in details/,
  );
  await assert.rejects(
    auth.login("nobody", "wrong password!!"),
    /Invalid sign-in details/,
  );
  const stored = await readFile(
    path.join(dir, "auth", "accounts.json"),
    "utf8",
  );
  assert.ok(!stored.includes(base.password));
  assert.match(stored, /\$argon2id\$/);
});

test("sessions validate, expire on logout and are stored hashed", async () => {
  const user = await auth.login("Owner@Example.com", base.password);
  const s = await auth.issue(user.id, false);
  assert.equal((await auth.session(s.value))?.id, user.id);
  assert.equal(await auth.session("x".repeat(43)), null);
  await auth.logout(s.value);
  assert.equal(await auth.session(s.value), null);
});

test("password change invalidates existing sessions", async () => {
  const user = await auth.login("owner", base.password);
  const s = await auth.issue(user.id, true);
  await auth.manage(user, {
    password: base.password,
    operation: "password",
    value: "another long passphrase",
  });
  assert.equal(await auth.session(s.value), null);
});
