import { NextRequest, NextResponse } from "next/server";
import { cookieName, session } from "@/lib/auth";
import { sameOrigin } from "@/lib/origin";
import { claimLegacy, legacyStatus } from "@/lib/legacy";
import { forwardToCoordinator } from "@/lib/coordinator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const forwarded = await forwardToCoordinator(req);
  if (forwarded) return forwarded;
  const u = await session(req.cookies.get(cookieName)?.value);
  if (!u)
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers },
    );
  if (u.role !== "owner")
    return NextResponse.json(
      { available: false, claimed: false, projects: 0, files: 0 },
      { headers },
    );
  return NextResponse.json(await legacyStatus(), { headers });
}

export async function POST(req: NextRequest) {
  const forwarded = await forwardToCoordinator(req);
  if (forwarded) return forwarded;
  const u = await session(req.cookies.get(cookieName)?.value);
  if (!u)
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers },
    );
  if (u.role !== "owner")
    return NextResponse.json(
      { error: "Owner access required." },
      { status: 403, headers },
    );
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Invalid origin" },
      { status: 403, headers },
    );
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "claim")
    return NextResponse.json(
      { error: "Confirmation required." },
      { status: 400, headers },
    );
  try {
    return NextResponse.json(await claimLegacy(u.id), { headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Claim failed." },
      { status: 400, headers },
    );
  }
}
