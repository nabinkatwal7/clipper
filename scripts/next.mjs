// Runs the Next.js CLI with anonymous telemetry disabled and update/analytics requests blocked.
// Clipper Studio makes no analytics requests. Usage (see package.json):
//   node scripts/next.mjs dev|build|start [next args]
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

process.env.NEXT_TELEMETRY_DISABLED = "1";
const preload = fileURLToPath(new URL("./no-phone-home.cjs", import.meta.url)).replaceAll("\\", "/");
// Quote the path so a folder name with spaces works; keep any NODE_OPTIONS the caller already set.
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} --require="${preload}"`.trim();
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
