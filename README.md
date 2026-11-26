# Clipper Studio

## Batch clip delivery

In **Transcript explorer**, use **Find and replace across this transcript** to correct repeated text. Preview the changes before applying them. In **Clip library**, choose **Use latest transcript captions** under **Batch render variations** to render the corrections into new copies of existing clips.

In **Clip library**, select clips individually or apply a filter and choose **Select all shown**. Open **Batch render variations** to queue portrait, square, landscape or caption-free copies. You can select clips from different projects, with up to 20 clips and 40 outputs per batch. The existing versions remain available for comparison in Production desk.

**Download ZIP** exports the selected MP4s, post-caption text, available SRT files and a JSON index with each clip’s source timestamps and aspect ratio.

## Clip an ongoing stream

Open **Live clipping** in the studio sidebar. Play the stream in a separate desktop browser tab, then choose **Share stream tab** and include tab audio in the browser picker. Capture the previous 15 or 30 seconds, or select a custom length of 5–30 seconds. With Studio focused, Shift+J captures 15 seconds and Shift+K captures 30. Review the source preview, name the clip and queue the 720p export. The draft stays in memory until you queue or discard it. Keep the Live clipping page open while capturing.

A self-hosted, local-first video clipping studio. Import a long recording, find highlight candidates with a local [Ollama](https://ollama.com) model, cut vertical clips, edit them on a multi-track timeline, caption them in your language, and export ready-to-post videos.

- **Local-first.** Media, accounts and projects are plain files on your machine. No database, no paid API, no subscription.
- **Local AI.** Ollama is the only AI service. Without it you can still clip manually.
- **Multilingual.** Unicode captions, a local speech recognizer and Ollama translation. English, Nepali and Hindi cover the landing page and core studio navigation and clipping controls.
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

Clipper Studio can create timestamped transcripts locally with the open-source [whisper.cpp](https://github.com/ggml-org/whisper.cpp) engine. Install a multilingual GGML model, then enable captions when generating clips or choose **Transcribe audio** in Transcript Studio. The studio reuses saved transcripts and available source subtitles first. You can also import SRT or VTT files.

On Windows, place the extracted runtime under `tools/whisper/runtime` and the model at `tools/whisper/ggml-base.bin`. On other systems, or to use a different model, set `CLIPPER_SPEECH_BIN` and `CLIPPER_SPEECH_MODEL` in `.env.local`. See [Configuration](docs/CONFIGURATION.md).

With no transcript, AI highlights and captions are skipped and the studio falls back to fixed-length clips, labelled as such. Model output is a suggestion; review it before publishing. See [docs/LANGUAGE_SUPPORT.md](docs/LANGUAGE_SUPPORT.md).

## Authenticated command line

Run `npm run clipper -- jobs` or `npm run clipper -- transcribe PROJECT_ID` with `CLIPPER_USER` and `CLIPPER_PASSWORD` supplied through your environment. Each command signs in, uses its session, and attempts sign-out on exit. An existing `CLIPPER_SESSION` can be supplied instead. The CLI only sends credentials to a loopback Studio URL.

Run `node scripts/authenticated-smoke.mjs` against a dedicated test account to check the authenticated HTTP API. Set `CLIPPER_SMOKE_VIDEO` to a local MP4 made from the upstream whisper.cpp JFK sample to also test speech recognition and an actual render. The in-process FFmpeg fixture `scripts/expansion-smoke.ts` runs against temporary storage independently of authentication.

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

- **Deployment.** Multiple loopback web instances can share a same-host coordinator. The coordinator owns the render queue and filesystem writes. Active-active workers and multi-host failover remain unsupported.
- **Interface translation.** Core studio navigation, Home, quick import and selected project and transcript controls support Nepali and Hindi. Untranslated advanced-tool text falls back to English.
- **Authentication** has no two-factor support, session management page or email flows yet.
- The editor's visual tests rely on Playwright, which is not installed by default.

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Third-party components and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). FFmpeg, yt-dlp and Ollama are installed separately and are not distributed with this project; check their licenses for your use.
