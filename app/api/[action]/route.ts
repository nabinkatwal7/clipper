import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
async function route(req: NextRequest, context: Context) {
  return handle(req, (await context.params).action);
}
export { route as GET, route as POST, route as DELETE };
