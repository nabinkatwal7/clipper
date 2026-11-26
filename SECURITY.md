# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** using GitHub's "Report a vulnerability" (private security advisory) feature on this repository. Do not open a public issue. Include steps to reproduce, the affected version or commit, and the impact you expect. You will get an acknowledgement as soon as a maintainer can respond; this is a volunteer project, so there is no guaranteed response time.

## Supported versions

Only the latest commit on the default branch receives fixes.

## Threat model

Clipper Studio is designed to run on a machine you control, bound to `127.0.0.1`, for one person or a few trusted people. It is **not** hardened for direct exposure to the public internet.

### What it protects

- **Authentication:** passwords hashed with Argon2id (via `@node-rs/argon2`); never stored in plain text.
- **Sessions:** 256-bit random tokens, stored only as SHA-256 hashes on disk, sent in HTTP-only, SameSite=Strict cookies (`Secure` over HTTPS). Sessions are invalidated when a password changes.
- **Brute force:** sign-in, registration and recovery are rate limited; failures return generic messages that do not reveal whether an account exists.
- **CSRF:** state-changing requests must carry an `Origin` whose host matches the request `Host`.
- **Authorization:** every API route requires a valid session and runs inside a per-user storage scope, so one account cannot read another account's workspace through the app. The owner role gates registration mode, member management and backups.
- **First-run takeover:** the first account on a non-localhost address needs a setup token.
- **SSRF:** URL imports pass through a local proxy that resolves and checks every connection, rejects non-public addresses and restricts ports and redirects.
- **Subprocesses:** FFmpeg, FFprobe and yt-dlp run with argument arrays and no shell; file paths are built only from validated UUIDs.
- **Untrusted data:** subtitles, media metadata and model output are treated as data, never as instructions.
- **Asset references:** assets record `usedBy` refs; deletion is blocked while references remain (`assertAssetDeletable`).

### What it does not protect against

- A malicious server operator or anyone with filesystem access: files are plain and unencrypted.
- Running it directly on the internet without TLS and a reverse proxy.
- A compromised Ollama server. If `OLLAMA_URL` is remote, transcripts and prompts are sent there.
- Malicious media attacking FFmpeg or yt-dlp. Keep both up to date.
- Multiple server instances: file-based persistence assumes a single process.

### Known gaps

- No two-factor authentication, no session-management page, and no audit-log viewer yet.
- Rate-limit counters are in memory and reset when the server restarts.
- The legacy command-line tool and smoke scripts bypass accounts and need updating.

## Hardening checklist for exposing the app

1. Serve over HTTPS through a reverse proxy; keep the app bound to localhost behind it.
2. Set `CLIPPER_SETUP_TOKEN` before first start and set registration to closed or invitation-only after creating the owner.
3. Run as an unprivileged user with the storage folder readable only by that user.
4. Keep Node.js, FFmpeg, yt-dlp, Ollama and dependencies (`npm audit`) up to date.
5. Back up `storage/` regularly.
