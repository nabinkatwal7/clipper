import {promises as fs} from "node:fs";
import path from "node:path";
import {createHash,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
import {hash,verify} from "@node-rs/argon2";
import {z} from "zod";
import {storageBase} from "./identity";
export const cookieName="studio_session";
const token=()=>randomBytes(32).toString("base64url");
const digest=(s:string)=>createHash("sha256").update(s).digest("hex");
const dir=path.join(storageBase,"auth"),accounts=path.join(dir,"accounts.json");
export const setupPath=path.join(dir,"owner-setup-token.txt");
const password=z.string().min(12).max(200);
const params={memoryCost:65536,timeCost:3,parallelism:1};
const signup=z.object({name:z.string().trim().min(1).max(100),username:z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,40}$/).optional(),email:z.email().max(254).transform(s=>s.toLowerCase()),password,confirm:z.string().optional(),terms:z.literal(true),setup:z.string().max(120).optional(),invitation:z.string().max(120).optional()}).refine(v=>v.confirm===undefined||v.password===v.confirm,"Passwords must match");
type Account={id:string;role:"owner"|"member";name:string;username:string;email:string;passwordHash:string;recoveryHash:string;generation:number;disabled?:boolean};
type Records={version:1;users:Account[];mode:"closed"|"invite"|"open";invites:string[]};
export type PublicUser=Pick<Account,"id"|"role"|"name"|"username"|"email">;
function publicUser({id,role,name,username,email}:Account):PublicUser{return {id,role,name,username,email}}
const state=globalThis as typeof globalThis & {studioAccountWrites?:Promise<unknown>;studioAuthAttempts?:Map<string,number[]>};
function locked<T>(fn:()=>Promise<T>){const p=(state.studioAccountWrites||Promise.resolve()).catch(()=>{}).then(fn);state.studioAccountWrites=p;return p}
async function records():Promise<Records>{try{return JSON.parse(await fs.readFile(accounts,"utf8"))}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return {version:1,users:[],mode:"open",invites:[]};throw e}}
async function atomic(file:string,data:unknown){const tmp=file+"."+randomUUID()+".tmp";try{await fs.writeFile(tmp,JSON.stringify(data),{mode:0o600,flag:"wx"});await fs.rename(tmp,file)}finally{await fs.rm(tmp,{force:true})}}
async function init(){await fs.mkdir(path.join(dir,"sessions"),{recursive:true,mode:0o700})}
export async function registrationState(){await init();const r=await records();if(!r.users.length){try{await fs.writeFile(setupPath,token(),{mode:0o600,flag:"wx"})}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e}}return {first:!r.users.length,mode:r.mode}}
export function rate(key:string,max:number){const map=state.studioAuthAttempts??=new Map<string,number[]>();const now=Date.now();for(const [k,v]of map)if(v.at(-1)!<now-600000)map.delete(k);const a=(map.get(key)||[]).filter(v=>v>now-600000);if(a.length>=max)throw Error("Too many attempts. Try again in ten minutes.");a.push(now);map.set(key,a)}
export async function audit(event:string,user?:string){await init();await fs.appendFile(path.join(dir,"security.jsonl"),JSON.stringify({at:new Date().toISOString(),event,user})+"\n",{mode:0o600})}
export async function register(body:unknown,local=true){const b=signup.parse(body);return locked(async()=>{const {first}=await registrationState(),r=await records();if(first&&!local){const secret=process.env.CLIPPER_SETUP_TOKEN||await fs.readFile(setupPath,"utf8");if(!timingSafeEqual(Buffer.from(digest(secret.trim())),Buffer.from(digest(b.setup||""))))throw Error("Invalid local setup token.")}else if(!first&&(r.mode==="closed"||r.mode==="invite"&&!r.invites.includes(digest(b.invitation||"")))
)throw Error("Registration is closed or requires a valid invitation.");
 if(r.users.some(u=>u.email===b.email||b.username&&u.username===b.username))throw Error("These account details are unavailable.");
 let username=b.username;if(!username){const base=(b.email.split("@")[0].replace(/[^a-z0-9_-]/g,"").slice(0,30)||"user").padEnd(3,"0");username=base;while(r.users.some(u=>u.username===username))username=base+"-"+randomBytes(2).toString("hex")}
 const recovery=token(),user:Account={id:randomUUID(),name:b.name,username,email:b.email,role:first?"owner":"member",passwordHash:await hash(b.password,params),generation:0,recoveryHash:digest(recovery)};r.users.push(user);if(b.invitation)r.invites=r.invites.filter(i=>i!==digest(b.invitation!));await atomic(accounts,r);if(first)await fs.rm(setupPath,{force:true});await audit("account.created",user.id);return {user:publicUser(user),recovery}})}
export async function login(identifier:string,pass:string){const name=z.string().trim().toLowerCase().min(1).max(254).parse(identifier);z.string().max(200).parse(pass);const user=(await records()).users.find(u=>u.email===name||u.username===name);
 const ok=user?await verify(user.passwordHash,pass):await hash(pass,params).then(()=>false);if(!user||!ok||user.disabled){await audit("login.denied");throw Error("Invalid sign-in details.")}await audit("login.success",user.id);return publicUser(user)}
export async function issue(id:string,remember:boolean){await init();const u=(await records()).users.find(u=>u.id===id&&!u.disabled);if(!u)throw Error("Account unavailable");const value=token(),expires=Date.now()+(remember?30:1)*86400000;await atomic(path.join(dir,"sessions",digest(value)+".json"),{version:1,id,generation:u.generation,expires,created:Date.now()});return {value,expires}}
export async function session(value?:string){if(!value||!/^[-\w]{43}$/.test(value))return null;const f=path.join(dir,"sessions",digest(value)+".json");try{const s=JSON.parse(await fs.readFile(f,"utf8"));if(s.expires<=Date.now()){await fs.rm(f,{force:true});return null}const u=(await records()).users.find(u=>u.id===s.id&&!u.disabled&&u.generation===s.generation);return u?publicUser(u):null}catch{return null}}
export async function logout(value?:string){if(value)await fs.rm(path.join(dir,"sessions",digest(value)+".json"),{force:true})}
export async function recover(raw:unknown){const b=z.object({identifier:z.string().trim().toLowerCase().max(254),code:z.string().min(20).max(120),password}).parse(raw);return locked(async()=>{const r=await records(),u=r.users.find(u=>u.username===b.identifier||u.email===b.identifier);if(!u||u.disabled||!timingSafeEqual(Buffer.from(digest(b.code)),Buffer.from(u.recoveryHash)))throw Error("Invalid recovery details.");const code=token();u.recoveryHash=digest(code);u.passwordHash=await hash(b.password,params);u.generation++;await atomic(accounts,r);await audit("password.recovered",u.id);return code})}
export async function manage(user:PublicUser,raw:unknown){const b=z.object({password:z.string().max(200),operation:z.enum(["password","mode","invite","revoke","disable","enable","profile"]),value:z.string().max(254).optional()}).parse(raw);return locked(async()=>{const r=await records(),u=r.users.find(a=>a.id===user.id&&!a.disabled);if(!u||!await verify(u.passwordHash,b.password))throw Error("Confirm your current password.");let result="Saved";if(b.operation==="password"){u.passwordHash=await hash(password.parse(b.value),params);u.generation++}else if(b.operation==="revoke")u.generation++;else if(b.operation==="profile")u.name=z.string().trim().min(1).max(100).parse(b.value);else{if(u.role!=="owner")throw Error("Owner access required.");if(b.operation==="mode")r.mode=z.enum(["closed","invite","open"]).parse(b.value);else if(b.operation==="invite"){result=token();r.invites.push(digest(result))}else{const target=r.users.find(a=>a.id===b.value&&a.role!=="owner");if(!target)throw Error("Member unavailable");target.disabled=b.operation==="disable";target.generation++}}await atomic(accounts,r);await audit("account."+b.operation,u.id);return result})}
export async function members(user:PublicUser){if(user.role!=="owner")throw Error("Owner access required");return (await records()).users.map(u=>({...publicUser(u),disabled:!!u.disabled}))}

