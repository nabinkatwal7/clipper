import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import { publicAddress } from "./validation";
export async function validateUrl(raw: string) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !["", "80", "443"].includes(url.port)
  )
    throw Error("Use a public HTTP or HTTPS video URL without credentials");
  await resolvePublic(url.hostname);
  return url;
}
const OFFLINE = new Set(["ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "ENETDOWN", "EHOSTUNREACH", "ECONNREFUSED", "ETIMEDOUT"]);
async function resolvePublic(host: string) {
  const addresses = await lookup(host.replace(/^\[|\]$/g, ""), { all: true }).catch((e: NodeJS.ErrnoException) => {
    if (OFFLINE.has(e.code ?? ""))
      throw Error(
        `No internet connection, or ${host} could not be found. Importing from a URL, downloading and checking feeds need internet access; local files, analysis, editing and rendering work offline.`,
      );
    throw e;
  });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw Error("Private, reserved and local network addresses are blocked");
  return addresses[0];
}
// Every downloader connection (including redirects, manifests and media URLs) is DNS-checked,
// then pinned to that public IP. The proxy is ephemeral and requires a per-job secret.
export async function downloadProxy(signal: AbortSignal) {
  const secret = randomBytes(24).toString("hex");
  const auth = "Basic " + Buffer.from(`clip:${secret}`).toString("base64");
  const sockets = new Set<net.Socket>();
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers["proxy-authorization"] !== auth) {
        res.writeHead(407).end();
        return;
      }
      const u = await validateUrl(req.url || "");
      if (u.protocol !== "http:") throw Error("HTTPS requires CONNECT");
      const address = await resolvePublic(u.hostname);
      const headers = { ...req.headers, host: u.host };
      delete headers["proxy-authorization"];
      const upstream = http.request(
        {
          hostname: address.address,
          family: address.family,
          port: Number(u.port || 80),
          path: u.pathname + u.search,
          method: req.method,
          headers,
        },
        (r) => {
          res.writeHead(r.statusCode || 502, r.headers);
          r.pipe(res);
        },
      );
      upstream.on("error", () => res.destroy());
      req.pipe(upstream);
    } catch {
      res.writeHead(403).end("Blocked destination");
    }
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  server.on("connect", async (req, client, head) => {
    try {
      if (req.headers["proxy-authorization"] !== auth)
        throw Error("Unauthorized");
      const u = new URL(`https://${req.url}`);
      if (u.port && u.port !== "443") throw Error("Blocked port");
      const a = await resolvePublic(u.hostname);
      const remote = net.connect(
        { host: a.address, port: 443, family: a.family },
        () => {
          client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          if (head.length) remote.write(head);
          client.pipe(remote);
          remote.pipe(client);
        },
      );
      sockets.add(remote);
      remote.on("close", () => sockets.delete(remote));
      remote.on("error", () => client.destroy());
      client.on("error", () => remote.destroy());
      client.on("close", () => remote.destroy());
    } catch {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address() as net.AddressInfo;
  const close = () => {
    for (const s of sockets) s.destroy();
    server.close();
  };
  signal.addEventListener("abort", close, { once: true });
  return {
    url: `http://clip:${secret}@127.0.0.1:${addr.port}`,
    close: () => {
      signal.removeEventListener("abort", close);
      close();
    },
  };
}
