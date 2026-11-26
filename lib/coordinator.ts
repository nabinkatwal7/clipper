import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "./origin";

const forwardedHeaders = [
  "accept",
  "content-type",
  "cookie",
  "range",
  "sec-fetch-site",
  "x-file-name",
];

/** API writes and media jobs belong to one coordinator. Replicas only serve the UI and forward API traffic. */
export async function forwardToCoordinator(
  request: NextRequest,
): Promise<Response | null> {
  const configured = process.env.CLIPPER_COORDINATOR_URL;
  if (!configured) return null;
  if (request.headers.has("x-clipper-forwarded"))
    return NextResponse.json(
      { error: "The coordinator must run without CLIPPER_COORDINATOR_URL." },
      { status: 503 },
    );
  if (request.method !== "GET" && !sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const origin = new URL(configured);
    if (
      origin.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw Error("Invalid coordinator URL.");
    const target = new URL(origin);
    target.pathname = request.nextUrl.pathname;
    target.search = request.nextUrl.search;
    const headers = new Headers({
      "accept-encoding": "identity",
      "x-clipper-forwarded": "1",
    });
    for (const name of forwardedHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    if (request.method !== "GET") headers.set("origin", origin.origin);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      signal: request.signal,
      redirect: "error",
      cache: "no-store",
      ...(request.body ? { body: request.body, duplex: "half" } : {}),
    });
    const responseHeaders = new Headers();
    for (const name of [
      "content-type",
      "content-disposition",
      "content-range",
      "accept-ranges",
      "x-content-type-options",
    ]) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    if (!upstream.headers.has("content-encoding")) {
      const size = upstream.headers.get("content-length");
      if (size) responseHeaders.set("content-length", size);
    }
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append("set-cookie", cookie);
    responseHeaders.set("cache-control", "private, no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Local coordinator is unavailable." },
      { status: 503 },
    );
  }
}
