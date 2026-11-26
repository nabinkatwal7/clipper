# Architecture

Clipper Studio is a single Next.js (App Router) application. There is no separate backend, database or queue service.

```
Browser ──► Next.js (Node runtime)
              ├─ app/            pages: public site, auth pages, /app (studio)
              ├─ app/api/        route handlers (auth, legacy claim, studio API)
              └─ lib/            domain logic
                    │
        ┌───────────┼────────────────┬──────────────┐
        ▼           ▼                ▼              ▼
     storage/     FFmpeg/FFprobe    yt-dlp       Ollama (HTTP)
   (JSON + media)  (child process)  (via proxy)   (local or remote)
```

## Routes

| Route | Purpose | Auth |
| --- | --- | --- |
| `/`, `/features`, `/how-it-works`, `/languages`, `/docs`, `/privacy`, `/terms` | Public marketing and documentation pages | none |
| `/login`, `/register`, `/recover` | Account pages | none (redirect to `/app` if signed in) |
| `/app` | The studio (client app in `components/workspace.tsx`) | session, checked on the server |
| `/api/auth/[operation]` | login, register, logout, recover, manage | origin check; session for `manage` |
| `/api/legacy` | Claim pre-accounts projects | owner session |
| `/api/[action]` | All studio actions (import, generate, edit, download, …) | session; origin check on writes |

`app/api/[action]/route.ts` is a thin wrapper: it validates the session, enters a per-user storage scope, then delegates to `handle()` in `lib/api.ts`.

## Accounts and sessions (`lib/auth.ts`)

- `storage/auth/accounts.json` holds users (Argon2id hash, role, generation counter, recovery-code hash) and registration settings. Writes are serialized in-process and use write-temp-then-rename.
- `storage/auth/sessions/<sha256(token)>.json` holds one file per session. The cookie value is the random token; only its hash touches disk.
- A user's `generation` is copied into each session; changing a password or revoking increments it and invalidates older sessions.
- Registration mode is `open` (default), `invite` or `closed`. The first account becomes the owner; on non-localhost addresses it must present a setup token.

## Per-user isolation (`lib/identity.ts`)

An `AsyncLocalStorage` carries the authenticated user id through a request. `workspaceRoot()` returns `storage/workspaces/<user-id>`, and every storage helper (`lib/store.ts`) builds paths from it plus validated UUIDs. The client never supplies a user id.

On the client, `lib/client-storage.ts` prefixes localStorage keys with the user id read from a `data-workspace-user` attribute that `/app` renders on the server.

## Storage layout

```
storage/
  auth/                 accounts.json, sessions/, security.jsonl, legacy-claim.json
  workspaces/<id>/      uploads/ audio/ transcripts/ projects/ clips/ assets/ temp/ backups/
  backups/              pre-claim metadata backups
```

Project metadata is JSON, written atomically. Media is stored as files; downloads stream with HTTP range support.

## Processing pipeline (`lib/jobs.ts`)

A single in-process queue runs one job at a time and supports cancellation.

1. **Ingest** – upload, or `yt-dlp` through a local proxy that blocks non-public addresses (`lib/network.ts`). Published subtitles are fetched and imported (`lib/source-subtitles.ts`).
2. **Probe** – `ffprobe` for duration, size and streams; thumbnail via FFmpeg.
3. **Transcript** – reuse the saved transcript; if there is none, skip (see below).
4. **Analyze** (AI mode) – transcript windows are sent to Ollama with a JSON schema; results are validated, de-duplicated and clamped to real timestamps (`lib/clip-plan.ts`, `lib/discovery.ts`).
5. **Render** – FFmpeg builds each clip (layout, reframing, captions via ASS, audio, grading).
6. **Save** – project JSON updated at every stage so interrupted jobs can resume.

If there is no transcript, step 4 is replaced by explicit fixed-length splitting and captions are disabled. The project notes why.

External commands run through `lib/process.ts` (`run()`), which uses argument arrays (no shell), enforces timeouts, supports abort signals, and keeps up to 400 M characters of stdout (yt-dlp metadata can be tens of MB).

## AI integration (`lib/ollama.ts`, `lib/director.ts`, …)

Everything AI goes through the Ollama HTTP API. Prompts treat transcripts as data. Outputs are parsed with Zod/JSON schemas and validated against the source; invalid or unsupported results are dropped instead of repaired into plausible-looking content.

## Public site

Server components under `app/` with content in `lib/site-features.ts`, `lib/public-copy.ts` and page files. Styles are plain CSS in `app/*.css` using the same design tokens as the studio (`app/tokens.css`). Stock photos are hot-linked from Unsplash (`lib/photos.ts`).

## Creative OS foundations (Phase 1)

- **Studio registry** — `lib/studios.ts` defines primary workspaces (Home, Clipping, Editing, …). Live routes map to existing pages; planned studios are registered but omitted from navigation until implemented.
- **Soundboard / sequencer** — `lib/soundboard.ts` stores pad profiles and step patterns under the workspace root; browser playback uses asset audio URLs.
- **Recording Studio** — browser `getDisplayMedia` / `MediaRecorder` capture saves WebM into the asset library; scene presets and session metadata live in `lib/recording-meta.ts`.
- **Instant replay** — overlapping bounded buffer while recording (`Save last N s`); bookmark scrub + FFmpeg stream-copy extract via `lib/instant-replay.ts`.
- **Motion Studio** — scaffold UI for text/shape/keyframe layers that write into the shared composition on a clip (not a separate motion engine).
- **Compositing Studio** — typed node graph (`lib/comp-graph.ts`) with port/cycle validation; `bakeGraph` compiles supported nodes to FFmpeg `filter_complex` and writes a bounded MP4 asset (60s, no audio).
- **Workspace switcher** — `components/workspace-nav.tsx` + `StudioShell` filter the sidebar by the active workspace group.
- **Capability registry** — `GET /api/capabilities` wraps diagnostics into feature gates (FFmpeg, hardware encode, ASS, xfade, Ollama models).
- **Sequences** — `lib/sequences.ts` adds a versioned project document (`schemaVersion: 1`) with named sequences, migration from a single `composition`, and cyclic nesting checks. Settings may carry `sequences` alongside legacy `composition`. UUIDs use `lib/id.ts` (`globalThis.crypto.randomUUID`) so validation stays browser-safe when pulled into client bundles.
- **Assets** — fingerprints, `usedBy` references, collections, ratings; delete blocked while referenced.
- **Clip Family Tree / Media toolbox** — provenance graph and FFmpeg/FFprobe conversion stay behind authenticated APIs; client panels do not import Node filesystem modules.

Roadmap: [docs/EXPANSION_ROADMAP.md](docs/EXPANSION_ROADMAP.md).

## Design decisions

- **Files over a database** keeps installation trivial and data portable; the cost is single-instance operation.
- **Same-origin check by `Host`** rather than the configured bind address, so `localhost` and `127.0.0.1` both work.
- **No built-in speech recognition.** It was removed to keep the project to one AI service; transcripts come from subtitles. Adding an Ollama audio-capable model path is a planned extension, gated on verified capability.
