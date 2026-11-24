import {promises as fs} from "node:fs";
import {bin,run} from "./process";
import {file,save} from "./store";
import {beginProgress,completeProgress,reporter,ffmpegSeconds} from "./progress";
import type {Project} from "./types";
export async function indexStream(p:Project,signal:AbortSignal){
 const scenes:number[]=[],bins=new Float64Array(480);let audioTime=0;
 p.stage="indexing";p.status="processing";p.detail="Measuring audio intensity and scene changes";beginProgress(p,"indexing",p.detail,p.duration,"seconds");await save(p);const progress=reporter(p,"indexing");
 const args=["-hide_banner","-nostdin","-threads","2","-protocol_whitelist","file,pipe","-i",file("uploads",p.id,"mp4"),"-vf","fps=2,scale=192:-2,select='gt(scene,0.35)',showinfo","-af","aresample=8000,aformat=channel_layouts=mono,asetnsamples=n=8000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level","-map","0:v:0","-map","0:a:0?","-threads","1","-progress","pipe:1","-nostats","-f","null","-"];
 await run(bin.ffmpeg,args,signal,line=>{const timestamp=line.match(/pts_time:\s*([\d.]+)/);if(timestamp&&line.includes("showinfo")&&scenes.length<10000)scenes.push(+timestamp[1]);if(timestamp&&line.includes("ametadata"))audioTime=+timestamp[1];const rms=line.match(/Overall\.RMS_level=(-?[\d.]+)/);if(rms){const i=Math.min(479,Math.floor(audioTime/p.duration*480));bins[i]=Math.max(bins[i],10**(+rms[1]/20))}const at=ffmpegSeconds(line);if(at!==undefined)progress.update(at,p.duration,"seconds","Indexing source · "+Math.floor(at)+"s measured")});
 await progress.flush();const target=file("temp",p.id,"index.json");await fs.writeFile(target+".tmp",JSON.stringify({scenes,peaks:Array.from(bins)}));await fs.rename(target+".tmp",target);completeProgress(p,"indexing");p.status="ready";p.stage="complete";p.detail="Source index ready";await save(p)
}
