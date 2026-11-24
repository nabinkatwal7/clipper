import { bin, run } from "./process";
export async function health() {
  const commands: [string, string, string[]][] = [
    ["FFmpeg", bin.ffmpeg, ["-version"]],
    ["FFprobe", bin.ffprobe, ["-version"]],
    ["yt-dlp", bin.ytdlp, ["--version"]],

  ];
  const checks = await Promise.all(
    commands.map(async ([name, command, args]) => {
      try {
        return {
          name,
          ok: true,
          detail: (await run(command, args, undefined, undefined, 20000)).split(
            "\n",
          )[0],
        };
      } catch (e) {
        return {
          name,
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );
  try {
    const res = await fetch(
      `${process.env.OLLAMA_URL || "http://127.0.0.1:11434"}/api/tags`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    const data = await res.json();
    const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
    const ok = data.models?.some((m: { name: string }) => m.name === model);
    checks.push({
      name: "Ollama",
      ok: !!ok,
      detail: ok ? model : `Run ollama pull ${model}`,
    });
  } catch {
    checks.push({
      name: "Ollama",
      ok: false,
      detail: "Ollama is unreachable. Start ollama serve.",
    });
  }
  return checks;
}
