/** Cross-runtime UUID — safe for browser bundles and Node. */
export function uuid() {
  const c = globalThis.crypto;
  if (!c?.randomUUID)
    throw Error("Secure random UUID is unavailable in this runtime");
  return c.randomUUID();
}
