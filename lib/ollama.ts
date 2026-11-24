// Consume Ollama NDJSON incrementally so real generation activity is visible.
export async function readOllamaResponse(
  response: Response,
  onText: (characters: number) => void,
) {
  if (!response.body) throw Error("Ollama returned an empty response");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let pending = "",
    result = "",
    finished = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const data = JSON.parse(line);
    if (data.error) throw Error(`Ollama: ${data.error}`);
    if (data.response) {
      result += data.response;
      if (result.length > 100000) throw Error("Ollama response is too large");
      onText(result.length);
    }
    if (data.done) finished = true;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) consume(line);
    }
    pending += decoder.decode();
    if (pending.trim()) consume(pending);
    if (!finished)
      throw Error(
        "Ollama stopped before completing its response. Retry analysis.",
      );
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
