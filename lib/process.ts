import { spawn } from "node:child_process";
export function run(
  command: string,
  args: string[],
  signal?: AbortSignal,
  onLine?: (line: string) => void,
  timeout = 6 * 60 * 60 * 1000,
  maxOutput = 400_000_000, // characters kept; large yt-dlp metadata JSON can exceed tens of MB
): Promise<string> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    const chunks: string[] = [];
    let size = 0,
      error = "";
    const pending = { stdout: "", stderr: "" };
    const lines = (stream: keyof typeof pending, chunk: string) => {
      if (!onLine) return; // avoids re-splitting huge single-line output
      pending[stream] += chunk;
      const parts = pending[stream].split(/[\r\n]+/);
      pending[stream] = parts.pop() || "";
      for (const line of parts) if (line) onLine?.(line);
    };
    const kill = () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        const killer = spawn(
          "taskkill",
          ["/pid", String(child.pid), "/T", "/F"],
          { shell: false, windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => child.kill());
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill();
        }
      }
    };
    const timer = setTimeout(() => {
      kill();
      reject(Error(`${command} timed out`));
    }, timeout);
    signal?.addEventListener("abort", kill, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", kill);
    };
    child.stdout.on("data", (b) => {
      const text = b.toString();
      chunks.push(text);
      size += text.length;
      while (size > maxOutput && chunks.length > 1) size -= chunks.shift()!.length;
      lines("stdout", b.toString());
    });
    child.stderr.on("data", (b) => {
      error = (error + b.toString()).slice(-8000);
      lines("stderr", b.toString());
    });
    child.on("error", (e) => {
      cleanup();
      reject(e);
    });
    child.on("close", (code) => {
      for (const line of Object.values(pending)) if (line) onLine?.(line);
      cleanup();
      code === 0 && !signal?.aborted
        ? resolve(chunks.join(""))
        : reject(
            Error(
              signal?.aborted
                ? "Processing cancelled"
                : `${command} failed (${code}): ${error.slice(-1800)}`,
            ),
          );
    });
  });
}
export const bin = {
  ffmpeg: process.env.FFMPEG_BIN || "ffmpeg",
  ffprobe: process.env.FFPROBE_BIN || "ffprobe",
  python: process.env.PYTHON_BIN || "python",
  ytdlp: process.env.YTDLP_BIN || "yt-dlp",
};
