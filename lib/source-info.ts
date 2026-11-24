import { downloadProxy, validateUrl } from "./network";
import { bin, run } from "./process";
export async function sourceInfo(
  raw: string,
  channel: boolean,
  signal: AbortSignal,
) {
  const url = await validateUrl(raw),
    proxy = await downloadProxy(signal);
  try {
    const common = [
      "--ignore-config",
      "--no-plugin-dirs",
      "--proxy",
      proxy.url,
      "--socket-timeout",
      "12",
      "--retries",
      "0",
      "--skip-download",
      "--dump-single-json",
    ];
    const info = JSON.parse(
      await run(
        bin.ytdlp,
        [
          ...common,
          ...(channel
            ? ["--flat-playlist", "--playlist-end", "5"]
            : ["--no-playlist"]),
          "--",
          url.href,
        ],
        signal,
        undefined,
        60000,
      ),
    );
    const records = (info.entries || [info])
      .filter(
        (x: Record<string, unknown>) =>
          x &&
          !x.is_live &&
          !["is_live", "is_upcoming"].includes(String(x.live_status)),
      )
      .map((x: Record<string, unknown>) => ({
        title: String(x.title || "Recording"),
        url: String(x.webpage_url || x.url || ""),
      }))
      .filter((x: { url: string }) => /^https?:\/\//.test(x.url));
    return {
      title: info.title || url.hostname,
      channel: info.channel || info.uploader || "",
      platform: info.extractor_key || url.hostname,
      duration: Number(info.duration) || 0,
      quality: Math.max(
        0,
        ...(info.formats || []).map((f: { height?: number }) => f.height || 0),
      ),
      subtitles:
        Object.keys(info.subtitles || {}).length +
          Object.keys(info.automatic_captions || {}).length >
        0,
      live: info.is_live || info.live_status === "is_live",
      recordings: records,
    };
  } finally {
    await proxy.close();
  }
}
