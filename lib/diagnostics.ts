import {availableParallelism,freemem,totalmem} from "node:os";
import {statfs} from "node:fs/promises";
import {bin,run} from "./process";
import {root,list} from "./store";
export async function diagnostics(signal:AbortSignal){const [encoders,filters,disk,projects,tags]=await Promise.all([run(bin.ffmpeg,["-hide_banner","-encoders"],signal).catch(()=>""),run(bin.ffmpeg,["-hide_banner","-filters"],signal).catch(()=>""),statfs(root).catch(()=>null),list(),fetch((process.env.OLLAMA_URL||"http://127.0.0.1:11434")+"/api/tags",{signal:AbortSignal.any([signal,AbortSignal.timeout(4000)])}).then(r=>r.json()).catch(()=>({models:[]}))]);
 const models=await Promise.all((tags.models||[]).slice(0,30).map(async(m:{name:string})=>{const info=await fetch((process.env.OLLAMA_URL||"http://127.0.0.1:11434")+"/api/show",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:m.name}),signal:AbortSignal.any([signal,AbortSignal.timeout(4000)])}).then(r=>r.json()).catch(()=>({}));return {name:m.name,capabilities:Array.isArray(info.capabilities)?info.capabilities:[]}}));
 return {schemaVersion:1,cpuThreads:availableParallelism(),freeMemoryBytes:freemem(),totalMemoryBytes:totalmem(),diskFreeBytes:disk?disk.bsize*disk.bavail:null,encoders:["libx264","h264_nvenc","h264_qsv","h264_amf","h264_videotoolbox"].filter(n=>encoders.includes(n)),filters:["xfade","overlay","lut3d","subtitles","sidechaincompress","loudnorm","blackdetect","freezedetect"].filter(n=>filters.includes(n)),models,jobs:projects.map(p=>({id:p.id,status:p.status,stage:p.stage,updatedAt:p.updatedAt})),note:"Encoder availability reflects the FFmpeg build. Device support is checked by a real encode."}
}

