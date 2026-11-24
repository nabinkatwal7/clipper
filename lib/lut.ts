import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { file } from "./store";
export function parseCube(text: string) {
  let size = 0,
    values = 0;
  const normalized: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line || /^TITLE\s/.test(line)) continue;
    if (/^LUT_3D_SIZE\s/.test(line)) {
      const n = Number(line.split(/\s+/)[1]);
      if (size || !Number.isInteger(n) || n < 2 || n > 65)
        throw Error("Choose a 3D cube between 2 and 65 samples per channel.");
      size = n;
      normalized.push("LUT_3D_SIZE " + n);
      continue;
    }
    const domain = /^DOMAIN_(MIN|MAX)\s/.test(line);
    const parts = line.split(/\s+/);
    const triple = (domain ? parts.slice(1) : parts).map(Number);
    if (
      triple.length !== 3 ||
      !triple.every(Number.isFinite) ||
      (!domain && !size)
    )
      throw Error("Invalid cube data.");
    normalized.push((domain ? parts[0] + " " : "") + triple.join(" "));
    if (!domain) values++;
  }
  if (!size || values !== size ** 3)
    throw Error("Cube sample count does not match its declared size.");
  return normalized.join("\n") + "\n";
}
export async function importCube(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw Error("Choose a .cube file.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 12000000) {
      await reader.cancel();
      throw Error("Cube exceeds 12 MB.");
    }
    chunks.push(value);
  }
  const data = parseCube(Buffer.concat(chunks).toString("utf8"));
  const id = randomUUID();
  await fs.writeFile(file("assets", id, "cube"), data, { flag: "wx" });
  return { id };
}
