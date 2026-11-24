import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { downloadProxy, validateUrl } from "../lib/network";
test("URL validator rejects credentials, non-HTTP protocols, and loopback", async () => {
  for (const url of [
    "file:///etc/passwd",
    "ftp://example.com/file",
    "https://user:pass@example.com/video",
    "http://127.0.0.1/video",
    "http://[::1]/video",
  ])
    await assert.rejects(validateUrl(url));
});
test("download proxy blocks private destinations even with correct authentication", async () => {
  const proxy = await downloadProxy(new AbortController().signal);
  const url = new URL(proxy.url);
  try {
    const status = await new Promise<number>((resolve, reject) => {
      http
        .get(
          {
            hostname: url.hostname,
            port: url.port,
            path: "http://127.0.0.1:443/secret",
            headers: {
              "Proxy-Authorization":
                "Basic " +
                Buffer.from(`${url.username}:${url.password}`).toString(
                  "base64",
                ),
            },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode!);
          },
        )
        .on("error", reject);
    });
    assert.equal(status, 403);
  } finally {
    proxy.close();
  }
});
