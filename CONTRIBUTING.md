# Contributing

Thanks for helping. This is a small project, so the process is light.

## Before you start

- Search existing issues first. For anything bigger than a bug fix, open an issue to discuss the approach before writing code.
- Read [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
- Security problems: do **not** open a public issue. See [SECURITY.md](SECURITY.md).

## Ground rules

These are deliberate project constraints; changes that break them will likely be declined:

- One Next.js application. No separate backend servers.
- Ollama is the only AI service. No paid or hosted AI APIs.
- Local filesystem and JSON persistence. No external database.
- No direct social-media publishing and no payment systems.
- Never present unsupported capability as supported (for example, speech recognition for a language that has not been verified). Never fabricate transcripts, metrics or AI output.
- Treat imported media metadata, subtitles and model responses as untrusted data.

## Development setup

```sh
npm install
npm run dev          # http://127.0.0.1:4000
```

Next.js in this repo is a newer major version than most documentation you will find. Read the guides in `node_modules/next/dist/docs/` before changing routing, caching or server APIs.

## Before opening a pull request

```sh
npm run typecheck
npm run lint
npm test
```

All three must pass. Add or update tests for behaviour changes; tests live in `tests/` and run with `tsx --test`. For UI changes, check desktop and a phone-width viewport, and include screenshots that contain no third-party footage or personal data.

## Pull requests

- Keep each PR focused. Describe what changed and why, and how you verified it.
- Do not commit `.env*` files, `storage/`, media, or model files.
- Use clear commit messages in the imperative mood (for example "Fix upload size check").
- By contributing you agree your work is released under the project's [MIT license](LICENSE).

## Code style

- TypeScript with strict types. Validate all external input with Zod.
- Run subprocesses with argument arrays, never through a shell.
- Resolve file paths only through the storage helpers; never build paths from user input.
- Prefer small, readable functions over clever ones. Match the surrounding style; `npm run format` runs Prettier.

## Reporting bugs

Include: what you did, what you expected, what happened, your OS, Node version, and the output of `npm run health`. Remove any private URLs or personal information from logs.
