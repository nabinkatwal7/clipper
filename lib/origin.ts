/** Same-origin check by comparing the Origin header's host with the request Host header.
 *  (nextUrl.origin reflects the bind address, so it breaks when you browse via localhost vs 127.0.0.1.) */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
