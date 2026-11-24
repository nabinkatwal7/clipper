import {cookieName,session} from "@/lib/auth";
import {workspaceScope} from "@/lib/identity";
import { NextRequest,NextResponse } from "next/server";
import { handle } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
async function route(req: NextRequest, context: Context) {
  const u=await session(req.cookies.get(cookieName)?.value);if(!u)return NextResponse.json({error:"Sign in required."},{status:401,headers:{"Cache-Control":"no-store"}});
 const action=(await context.params).action;
 if(req.method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)return NextResponse.json({error:"Invalid origin"},{status:403});
 if(u.role!=="owner"&&["backups"].includes(action))return NextResponse.json({error:"Owner access required."},{status:403});
 const res=await workspaceScope.run(u.id,()=>handle(req,action));
 res.headers.set("Cache-Control","private, no-store");res.headers.set("X-Content-Type-Options","nosniff");return res;
}
export { route as GET, route as POST, route as DELETE };
