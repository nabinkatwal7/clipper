import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
const [command, arg, extra] = process.argv.slice(2);
import { studioClient } from "./studio-client.mjs";
let client;
try {
  let endpoint,
    options = {};
  const post = (body) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  switch (command) {
    case "jobs":
      endpoint = "progress";
      break;
    case "health":
      endpoint = "health";
      break;
    case "import":
      endpoint = "import";
      options = post({ url: arg, settings: extra ? JSON.parse(extra) : {} });
      break;
    case "transcribe":
    case "analyze":
    case "generate":
    case "cancel":
      endpoint = command;
      options = post({
        project: arg,
        ...(extra ? { settings: JSON.parse(extra) } : {}),
      });
      break;
    case "render":
      endpoint = "edit";
      options = post({ ...JSON.parse(extra), project: arg });
      break;
    case "report":
      endpoint = "report?project=" + encodeURIComponent(arg);
      break;
    case "export":
      if (!extra) throw Error("Supply a new ZIP output filename.");
      endpoint = "download?kind=zip&project=" + encodeURIComponent(arg);
      break;
    default:
      throw Error(
        "Usage: npm run clipper -- jobs | health | import URL [settings-json] | transcribe PROJECT | analyze PROJECT | generate PROJECT [settings-json] | render PROJECT edit-json | cancel PROJECT | report PROJECT | export PROJECT new.zip",
      );
  }
  client = await studioClient();
  const r = await client.request("/api/" + endpoint, options);
  if (!r.ok) throw Error((await r.json()).error || r.statusText);
  if (command === "export") {
    await pipeline(
      Readable.fromWeb(r.body),
      createWriteStream(extra, { flags: "wx" }),
    );
    console.log("Exported " + extra);
  } else console.log(JSON.stringify(await r.json(), null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client?.close().catch(() => {});
}
