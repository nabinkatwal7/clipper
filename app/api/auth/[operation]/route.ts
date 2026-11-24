import {NextRequest,NextResponse} from "next/server";
import {ZodError} from "zod";
import {audit,cookieName,issue,login,logout,manage,rate,recover,register,session} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(req:NextRequest,ctx:{params:Promise<{operation:string}>}){
 const {operation}=await ctx.params;const host=req.nextUrl.host;
 if(!["localhost","127.0.0.1","[::1]"].includes(req.nextUrl.hostname)||req.headers.get("origin")!==req.nextUrl.origin||req.headers.get("host")!==host||!req.headers.get("content-type")?.startsWith("application/json"))return NextResponse.json({error:"Invalid request origin."},{status:403});
 try{const text=await req.text();if(text.length>8192)throw Error("Request too large.");const b=JSON.parse(text);const current=req.cookies.get(cookieName)?.value;
 if(operation==="logout"){await logout(current);const r=NextResponse.json({ok:true});r.cookies.delete(cookieName);return r}
 if(operation==="manage"){const user=await session(current);if(!user)return NextResponse.json({error:"Sign in required"},{status:401});rate("manage:"+user.id,16);return NextResponse.json({result:await manage(user,b)})}
 rate("auth-global",65);
 if(operation==="recover"){rate("recover",8);return NextResponse.json({recovery:await recover(b)})}
 if(!["login","register"].includes(operation))throw Error("Unknown action");
 rate(operation+":"+String(b.identifier||b.username||"").toLowerCase().slice(0,100),10);
 const auth=operation==="register"?await register(b):{user:await login(b.identifier,b.password),recovery:undefined};await logout(current);const s=await issue(auth.user.id,b.remember===true);const r=NextResponse.json({ok:true,recovery:auth.recovery},{headers:{"Cache-Control":"no-store"}});r.cookies.set(cookieName,s.value,{httpOnly:true,sameSite:"strict",secure:req.nextUrl.protocol==="https:",path:"/",...(b.remember?{expires:new Date(s.expires)}:{})});return r;
 }catch(e){await audit("auth.request.failed");const message=e instanceof ZodError?"Check the required fields, password length and confirmation.":e instanceof Error?e.message:"Request failed";return NextResponse.json({error:message},{status:message.startsWith("Too many")?429:400,headers:{"Cache-Control":"no-store"}})}
}
