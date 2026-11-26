# Configuration

Copy `.env.example` to `.env.local` and restart the server after changes. `.env*` files are git-ignored.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama server. If remote, transcripts and prompts are sent to it. |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Default model for analysis and translation. A project can choose another. |
| `FFMPEG_BIN`, `FFPROBE_BIN`, `YTDLP_BIN` | from `PATH` | Absolute paths if the tools are not on `PATH`. |
| `FFMPEG_THREADS` | `8` | Threads for encoding. |
| `FFMPEG_PRESET` | `superfast` | x264 preset; slower presets give smaller files. |
| `MAX_UPLOAD_MB` | `5120` | Maximum upload or download size (MiB). |
| `MAX_VIDEO_HOURS` | `12` | Longest source accepted. |
| `CLIPPER_STORAGE_DIR` | `./storage` | Absolute path to relocate all data. |
| `CLIPPER_SETUP_TOKEN` | none | Token the first account must present when created via a non-localhost address. |

## Accounts

- The first account becomes the **owner**; later accounts are **members**.
- New installations close registration after owner setup. In **Account settings**, the owner can confirm their password to switch to open or invitation-only registration, create single-use invitations, and enable or disable member accounts. Existing registration settings are preserved.
- Passwords: 12–200 characters; no composition rules.
- Sessions last one day, or 30 days with "Keep me signed in". Changing a password signs out all other sessions.
- **Recovery:** each account gets a one-time recovery code at sign-up. Use it at `/recover`; a new code is issued after a successful reset. There is no email service.

## Data location

```
storage/
  auth/            accounts.json, sessions/, security.jsonl
  workspaces/<id>/ one folder per user
  backups/
```

Back up the whole `storage/` directory while the server is stopped, or use **Backup & recovery** in the studio for a per-workspace checksummed backup.

## Ollama models

Any text model installed in Ollama can be selected. Capability depends on the model: context size, instruction following and the languages it handles all vary. The studio does not claim that a model supports a language or modality it has not been verified for; review all model output.

## Running on a network

Bound to `127.0.0.1` by default (`npm run dev` / `npm start`). If you expose it, use HTTPS via a reverse proxy, set `CLIPPER_SETUP_TOKEN`, close registration after creating the owner, and read [SECURITY.md](../SECURITY.md).
