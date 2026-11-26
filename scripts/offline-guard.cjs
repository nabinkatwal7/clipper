// Simulated "offline" for acceptance testing. Preload with:
//   NODE_OPTIONS=--require=/abs/path/scripts/offline-guard.cjs
// Every DNS lookup or TCP connection to a non-loopback address fails as if there were no network,
// and each attempt is appended to OFFLINE_GUARD_LOG (JSON lines). Covers this Node process and the
// Node workers it spawns. It does NOT cover separate programs (FFmpeg, yt-dlp, whisper.cpp); those
// are only given local files or go through this process's guarded proxy in the flows under test.
const fs = require("node:fs");
const net = require("node:net");
const dns = require("node:dns");

const log = process.env.OFFLINE_GUARD_LOG;
const record = (kind, target) => {
  if (!log) return;
  try { fs.appendFileSync(log, JSON.stringify({ at: new Date().toISOString(), kind, target, pid: process.pid }) + "\n"); } catch {}
};
const loopback = (h) => {
  if (!h) return true;
  const s = String(h).replace(/^\[|\]$/g, "").toLowerCase();
  return s === "localhost" || s === "::1" || s === "0.0.0.0" || s === "::" || /^127\./.test(s) || /^::ffff:127\./.test(s) || s.endsWith(".localhost");
};
const offline = (code, what) => Object.assign(new Error(`offline-guard: ${what} blocked (simulated no network)`), { code, errno: -4039 });

const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let host, port;
  const a0 = args[0];
  if (a0 && typeof a0 === "object" && !Array.isArray(a0)) { host = a0.host; port = a0.port; if (a0.path) return origConnect.apply(this, args); }
  else if (typeof a0 === "string" && !/^\d+$/.test(a0)) return origConnect.apply(this, args); // unix/pipe path
  else { port = a0; host = typeof args[1] === "string" ? args[1] : undefined; }
  if (!loopback(host)) {
    record("connect", `${host}:${port}`);
    const err = offline("ENETUNREACH", `connect ${host}:${port}`);
    process.nextTick(() => this.destroy(err));
    return this;
  }
  return origConnect.apply(this, args);
};

const origLookup = dns.lookup;
dns.lookup = function (hostname, options, cb) {
  if (typeof options === "function") { cb = options; options = {}; }
  if (!loopback(hostname)) {
    record("dns", String(hostname));
    return process.nextTick(() => cb(Object.assign(offline("ENOTFOUND", `dns ${hostname}`), { hostname })));
  }
  return origLookup.call(dns, hostname, options, cb);
};
const origPLookup = dns.promises.lookup;
dns.promises.lookup = async function (hostname, options) {
  if (!loopback(hostname)) {
    record("dns", String(hostname));
    throw Object.assign(offline("ENOTFOUND", `dns ${hostname}`), { hostname });
  }
  return origPLookup.call(dns.promises, hostname, options);
};
for (const m of ["resolve", "resolve4", "resolve6"]) {
  const orig = dns[m];
  dns[m] = function (hostname, ...rest) {
    const cb = rest[rest.length - 1];
    if (!loopback(hostname) && typeof cb === "function") { record("dns", String(hostname)); return process.nextTick(() => cb(offline("ENOTFOUND", `dns ${hostname}`))); }
    return orig.call(dns, hostname, ...rest);
  };
}
