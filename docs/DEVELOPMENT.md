# Development

## Setup

```sh
npm install
npm run dev     # http://127.0.0.1:4000, webpack dev server
```

This repository uses a recent Next.js major version. Read the guides in `node_modules/next/dist/docs/` before touching routing, caching or server APIs; much online documentation is out of date.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on `127.0.0.1:4000` |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`tsx --test tests/*.test.ts`) |
| `npm run format` | Prettier |
| `npm run health` | Checks FFmpeg, FFprobe, yt-dlp and Ollama |

Do not run `npm run build` while `npm run dev` is running from the same directory; both write to `.next/`.

## Layout

```
app/                 pages and route handlers
  api/auth/          sign-in, registration, recovery
  api/legacy/        claim pre-accounts projects
  api/[action]/      studio API wrapper
  app/               the signed-in studio
  *.css              design tokens, studio, public-site styles
components/          React components (studio, public site, auth)
lib/                 domain logic (auth, jobs, storage, Ollama, rendering)
tests/               node:test unit tests
scripts/             smoke and integration scripts
```

See [ARCHITECTURE.md](../ARCHITECTURE.md) for how the parts fit together.

## Tests

Tests are plain `node:test` files run through `tsx`. Tests that touch storage set `CLIPPER_STORAGE_DIR` to a temporary directory *before* importing the module under test, because the storage root is read at import time. Existing examples: `tests/auth.test.ts`, `tests/legacy.test.ts`.

Integration scripts (`scripts/integration.ts`, `scripts/smoke.ts`, `scripts/ingest-smoke.ts`) exercise real FFmpeg and route handlers. They predate accounts and call the API without a session, so they need updating before they pass against the current code.

## Conventions

- Validate every external input with Zod. Never trust a user id from the client; derive it from the session.
- Build file paths only through `lib/store.ts` helpers and validated UUIDs.
- Spawn external tools with `run()` from `lib/process.ts` using argument arrays.
- Write JSON atomically (temp file + rename).
- Do not present unsupported capability as supported, and do not invent transcripts, metrics or model output.
- Keep user-facing public-site text in `lib/public-copy.ts` where it is translated; feature content is in `lib/site-features.ts`.

## Adding a public page

Create `app/<name>/page.tsx` using `PageShell` (and `DocLayout` for long text) from `components/site-pages.tsx`, then link it from `SiteHeader`/`SiteFooter` in `components/public-site.tsx`.

## Releasing

There is no automated release process yet. Run typecheck, lint and tests, update `FEATURE_MATRIX.md` for changed features, and tag the commit.
