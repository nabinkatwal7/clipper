# Clipper Studio

A self-hosted, local-first video clipping studio. Import a long recording, find highlight candidates with a local [Ollama](https://ollama.com) model, cut vertical clips, edit them on a multi-track timeline, caption them in your language, and export ready-to-post videos.

- **Local-first.** Media, accounts and projects are plain files on your machine. No database, no paid API, no subscription.
- **Local AI.** Ollama is the only AI service. Without it you can still clip manually.
- **Multilingual.** Unicode captions in any script, translation through an installed model, and an interface in English, Nepali and Hindi (home page today).
- **Accounts built in.** First-party sign-in with Argon2id password hashing, hashed server-side sessions and per-user workspaces.

> **Status:** usable and actively developed, but young. Read [Known limitations](#known-limitations) before relying on it.

## Features

| Area | What you get |
| --- | --- |
| Import | File upload (up to 5 GiB by default) or public video URL via yt-dlp, with format inspection |
| Highlights | Ollama-assisted candidates with reasons and real timestamps; fixed-length and manual clipping without AI |
| Editing | Multi-track timeline, reframing to 9:16, layouts, layers and B-roll, audio mixing, colour grading, effects, history |
| Captions | Import SRT/VTT, edit, style, translate with an installed model, burn in |
| Library | Clip library, collections, search (exact, fuzzy, semantic), thumbnails, publishing packages |
| Automation | Channel watchlists, local processing queue, workflows, content calendar |
| Operations | Per-user workspaces, backups with checksums, storage view |

See [FEATURE_MATRIX.md](FEATURE_MATRIX.md) for implementation status of every feature.

## Quick start

Requirements: Node.js 22 or 24, FFmpeg (with `libass`) and FFprobe, yt-dlp, and Ollama. A GPU is optional. Python is not required.

```sh
# Windows
winget install Gyan.FFmpeg yt-dlp.yt-dlp Ollama.Ollama
# macOS
brew install node@22 ffmpeg yt-dlp ollama
# Linux: install ffmpeg and yt-dlp from your package manager, Ollama from ollama.com

ollama pull qwen2.5:3b

git clone https://github.com/nabinkatwal7/clipper.git
cd clipper
npm install
cp .env.example .env.local     # optional; Windows: copy .env.example .env.local
npm run dev
```

Open <http://127.0.0.1:4000>, choose **Get started**, and create your account. The first account becomes the workspace owner. Save the one-time recovery code shown after sign-up: there is no email service, so it is how you reset a forgotten password.

Use the same address every time. Browsers keep cookies per host, so `localhost` and `127.0.0.1` are separate sessions.

`npm run health` checks that every tool is found.

More detail: [docs/INSTALL.md](docs/INSTALL.md) · [docs/CONFIGURATION.md](docs/CONFIGURATION.md)

## How transcripts work

Clipper Studio does **not** include speech recognition. Transcripts come from:

1. subtitles published with the video (imported automatically for URL imports), or
2. a timed subtitle file (SRT/VTT) you import in **Transcript explorer**.

With no transcript, AI highlights and captions are skipped and the studio falls back to fixed-length clips, labelled as such. Model output is a suggestion; review it before publishing. See [docs/LANGUAGE_SUPPORT.md](docs/LANGUAGE_SUPPORT.md).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/INSTALL.md](docs/INSTALL.md) | Requirements and installation per operating system |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Environment variables, accounts, registration modes |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Project layout, scripts, tests, conventions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces fit together |
| [docs/LANGUAGE_SUPPORT.md](docs/LANGUAGE_SUPPORT.md) | What language features exist and their limits |
| [SECURITY.md](SECURITY.md) | Security model and how to report a vulnerability |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

The same setup guide is available in the running app at `/docs`.

## Security notes

- Bind to localhost (the default). If you expose the app, put it behind a TLS reverse proxy; it is not hardened for direct internet exposure.
- Only import media you own or are authorized to use. The downloader does not bypass DRM or platform restrictions.
- If `OLLAMA_URL` points to another machine, transcripts and prompts are sent to it.
- The public pages load stock photos from Unsplash, which can see visitors' IP addresses. The studio itself makes no such requests.

Report vulnerabilities privately; see [SECURITY.md](SECURITY.md).

## Known limitations

- **No built-in speech recognition** (see above).
- **Single instance.** Persistence is files written by one Node process; it is not designed for several servers.
- **Command-line tool and smoke scripts** (`npm run clipper`, `scripts/*.ts`) predate accounts and call the API without a session, so they need updating.
- **Interface translation** covers the home page only; the studio is English.
- **Authentication** has no two-factor support, session management page or email flows yet.
- The editor's visual tests rely on Playwright, which is not installed by default.

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Third-party components and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). FFmpeg, yt-dlp and Ollama are installed separately and are not distributed with this project; check their licenses for your use.
