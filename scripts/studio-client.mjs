export async function studioClient() {
  const origin = new URL(
    process.env.CLIPPER_URL ||
      process.env.STUDIO_URL ||
      "http://127.0.0.1:4000",
  );
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw Error("Set CLIPPER_URL to a loopback Studio origin.");
  let token = process.env.CLIPPER_SESSION;
  let temporary = false;
  if (!token) {
    const identifier = process.env.CLIPPER_USER,
      password = process.env.CLIPPER_PASSWORD;
    if (!identifier || !password)
      throw Error(
        "Set CLIPPER_USER and CLIPPER_PASSWORD, or supply an existing CLIPPER_SESSION.",
      );
    const response = await fetch(new URL("/api/auth/login", origin), {
      method: "POST",
      redirect: "error",
      headers: { origin: origin.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!response.ok)
      throw Error((await response.json()).error || "Sign-in failed.");
    token = response.headers
      .getSetCookie()
      .map((value) => value.match(/^studio_session=([-\w]{43});/)?.[1])
      .find(Boolean);
    temporary = true;
  }
  if (!token || !/^[-\w]{43}$/.test(token))
    throw Error("Invalid Studio session.");
  function request(endpoint, options = {}) {
    if (!endpoint.startsWith("/api/") || endpoint.includes("\\"))
      throw Error("Invalid Studio API path.");
    const url = new URL(endpoint, origin);
    if (url.origin !== origin.origin || !url.pathname.startsWith("/api/"))
      throw Error("Invalid Studio API path.");
    const headers = new Headers(options.headers);
    headers.set("cookie", "studio_session=" + token);
    headers.set("origin", origin.origin);
    return fetch(url, { ...options, headers, redirect: "error" });
  }
  return {
    request,
    close: () =>
      temporary
        ? request("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        : Promise.resolve(),
  };
}
