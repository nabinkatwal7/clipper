# Installation

## Requirements

| Component | Version | Used for |
| --- | --- | --- |
| Node.js | 22 or 24 LTS | The application |
| FFmpeg + FFprobe | recent, with the `libass` subtitle filter | Probing, rendering, thumbnails |
| yt-dlp | current | Importing from a URL (optional if you only upload files) |
| Ollama | current | Highlights, translation, search (optional; manual clipping works without it) |

Python is **not** required. A GPU is optional; CPU encoding works and Ollama uses supported GPUs automatically.

Make sure each command is on your `PATH` **before** starting Next.js, or set absolute paths in `.env.local` (see [CONFIGURATION.md](CONFIGURATION.md)).

## Windows (PowerShell)

```powershell
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
winget install Ollama.Ollama
ollama pull qwen2.5:3b
```

Open a new terminal afterwards so the new commands are found. Install Node.js from <https://nodejs.org>.

## macOS

```sh
brew install node@22 ffmpeg yt-dlp ollama
ollama serve            # keep running, or use the Ollama app
ollama pull qwen2.5:3b  # in another terminal
```

## Linux (Ubuntu / Debian)

```sh
sudo apt update
sudo apt install ffmpeg pipx
pipx install yt-dlp
```

Install Node.js 22+ from <https://nodejs.org> or a version manager, and Ollama from <https://ollama.com/download/linux>, then:

```sh
ollama serve
ollama pull qwen2.5:3b
```

## Get the code and run

```sh
git clone https://github.com/nabinkatwal7/clipper.git
cd clipper
npm install
npm run dev
```

Open <http://127.0.0.1:4000> and choose **Get started**. The first account becomes the owner. Save the recovery code shown after sign-up.

Use one address consistently: `localhost` and `127.0.0.1` keep separate sign-in cookies.

Check your setup:

```sh
npm run health
```

## Production run

```sh
npm run build
npm start
```

This needs a persistent Node server; do not deploy to serverless platforms. Keep it bound to localhost and, if you need remote access, put it behind a TLS reverse proxy (see [SECURITY.md](../SECURITY.md)).

## Upgrading projects created before accounts existed

Earlier versions stored projects directly in `storage/`. After signing in as the owner, use **Claim existing projects** in the studio. A metadata backup is written to `storage/backups/` first, files are moved (never deleted) into your workspace, and other users never see unclaimed projects.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `No active Node.js version` | Select an installed version (`nvm use 24`). |
| Commands not found | Open a new terminal, or set `FFMPEG_BIN`, `FFPROBE_BIN`, `YTDLP_BIN` to absolute paths. |
| URL import fails | Update yt-dlp; confirm the link is a finished public recording. |
| No AI suggestions | Confirm `ollama serve` is running and the model is pulled (`npm run health`). |
| "No source transcript is available" | The video has no published subtitles. Import an SRT/VTT in Transcript explorer, or use fixed-length clips; processing continues without captions. |
| Signed out unexpectedly | You switched between `localhost` and `127.0.0.1`. |
| Locked out | Reset at `/recover` with your recovery code, or ask the owner. |
