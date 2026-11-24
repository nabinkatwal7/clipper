import {promises as fs,createWriteStream} from "node:fs";
import {randomUUID} from "node:crypto";
import {pipeline} from "node:stream/promises";
import {ZipArchive} from "archiver";
import type {Project,Clip,Segment} from "./types";
import {file,save} from "./store";
import {render} from "./jobs";
import {clipBasename,captionFile} from "./post-captions";
import {poster} from "./clip-poster";
import {ledger} from "./production-store";
import {beginProgress,completeProgress,reporter} from "./progress";
function stamp(n:number,vtt:boolean){const ms=Math.round(Math.max(n,0)*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(v=>String(v).padStart(2,"0")).join(":")+(vtt?".":",")+String(ms%1000).padStart(3,"0")}
export function subtitleTrack(rows:Segment[],start:number,end:number,vtt=false){return (vtt?"WEBVTT\n\n":"")+rows.filter(r=>r.start<end&&r.end>start&&r.text.trim()).map((r,i)=>(i+1)+"\n"+stamp(Math.max(0,r.start-start),vtt)+" --> "+stamp(Math.min(end,r.end)-start,vtt)+"\n"+r.text.trim()).join("\n\n")+"\n"}
export function packageLocation(p:string,c?:string){return file("temp",p,(c||"project").replaceAll("-","")+".publish.zip")}
export async function buildPackage(p:Project,clips:Clip[],single:boolean,signal:AbortSignal){
 const rights=(await ledger(p.id)).rights;const dest=packageLocation(p.id,single?clips[0].id:undefined),tmp=dest+"."+randomUUID()+".tmp";const zip=new ZipArchive({zlib:{level:0}});const active=pipeline(zip,createWriteStream(tmp,{flags:"wx"}),{signal});active.catch(()=>{});const scratch:string[]=[];
 try{p.status="processing";p.stage="rendering";p.detail="Building publishing package";beginProgress(p,"rendering",p.detail,clips.length,"clips");await save(p);const progress=reporter(p,"rendering");
 for(const [i,c] of clips.entries()){signal.throwIfAborted();const folder=clipBasename(c)+"/";const make=async(captions:boolean)=>{const id=randomUUID();scratch.push(file("clips",id,"mp4"));await render(p,c,{...c.settings,ratio:"9:16",captions},c.segments,signal,id);return file("clips",id,"mp4")};
 const vertical=c.settings.ratio==="9:16"?file("clips",c.id,"mp4"):await make(c.settings.captions);const clean=c.settings.captions?await make(false):vertical;
 zip.file(vertical,{name:folder+"video.mp4"});zip.file(clean,{name:folder+"clean.mp4"});zip.append(Buffer.from(await poster(c.id,c.end-c.start)),{name:folder+"thumbnail.jpg"});
 for(const ext of ["srt","vtt"])zip.append(subtitleTrack(c.segments,c.start,c.end,ext==="vtt"),{name:folder+"subtitles."+ext});
 const description=captionFile(c);zip.append(description,{name:folder+"caption.txt"});zip.append(JSON.stringify({schemaVersion:1,title:c.title,description,hashtags:description.match(/#[\p{L}\p{N}_]+/gu)||[],suggestedPinnedComment:"What stood out to you in this moment?",source:p.source||"Local upload",sourceTitle:p.title,start:c.start,end:c.end,rights,settings:{...c.settings,ratio:"9:16"},platforms:["YouTube Shorts","Instagram Reels","TikTok","Facebook Reels"],checklist:["Confirm usage permissions and attribution.","Review captions, framing and audio.","Confirm platform description and thumbnail."]},null,2),{name:folder+"publishing.json"});
 progress.update(i+1,clips.length,"clips","Prepared "+(i+1)+" of "+clips.length+" publishing folders")}
 await progress.flush();await zip.finalize();await active;signal.throwIfAborted();await fs.rename(tmp,dest);completeProgress(p,"rendering");p.status="ready";p.stage="complete";p.detail="Publishing package ready";await save(p)
 }finally{zip.destroy();await active.catch(()=>{});await Promise.all([...scratch,tmp].map(f=>fs.rm(f,{force:true})))}
}
