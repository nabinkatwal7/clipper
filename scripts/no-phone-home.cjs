// Preloaded into every Node process Next.js starts (see scripts/next.mjs).
// Clipper Studio makes no analytics or update-check requests. The Next.js development server
// otherwise fetches the npm registry for a "newer version available" banner, and Next telemetry
// posts to its own host. Refuse both before any other code can capture `fetch`.
const blocked = /^https?:\/\/(registry\.npmjs\.org|telemetry\.nextjs\.org)(\/|$)/i;
const original = globalThis.fetch;
if (typeof original === "function" && !original.__clipperBlocked) {
  const guarded = function (input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
    if (url && blocked.test(url)) return Promise.reject(new TypeError("Blocked: Clipper Studio makes no analytics or update-check requests."));
    return original.call(this, input, init);
  };
  guarded.__clipperBlocked = true;
  globalThis.fetch = guarded;
}
