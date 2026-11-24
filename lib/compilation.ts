import {randomUUID} from "node:crypto";
import {promises as fs} from "node:fs";
import {bin,run} from "./process";
import {file,list,save} from "./store";
import {enqueue,probe} from "./jobs";
import {dimensions} from "./captions";
import {verifyRender} from "./export-qa";
import {defaults,type Project,type Segment} from "./types";
export const transitions={Cut:"cut",Dissolve:"fade","Fade through black":"fadeblack","Fade through white":"fadewhite","Slide left":"slideleft","Slide right":"slideright","Wipe left":"wipeleft","Wipe right":"wiperight","Smooth zoom":"zoomin",Push:"smoothleft",Blur:"hblur"} as const;
export async function compilation(body:{clips:string[];title:string;transition:keyof typeof transitions;seconds:number;ratio:typeof defaults.ratio;normalize:boolean}){
 if(!Array.isArray(body.clips)||body.clips.length<2||body.clips.length>12||typeof body.title!=="string"||!body.title.trim()||body.title.length>160||!Object.hasOwn(transitions,body.transition)||!Number.isFinite(body.seconds)||body.seconds<.05||body.seconds>2||!["9:16","1:1","16:9","4:5"].includes(body.ratio))throw Error("Choose 2–12 clips, an output ratio and a transition of 0.05–2 seconds.");
 const all=(await list()).flatMap(p=>p.clips);const clips=body.clips.map(id=>{const c=all.find(c=>c.id===id);if(!c)throw Error("Selected clip no longer exists");return c});
 if(clips.reduce((a,c)=>a+c.end-c.start,0)>720)throw Error("Choose at most 12 minutes of footage per compilation.");
 const id=randomUUID(),now=new Date().toISOString(),settings={...defaults,ratio:body.ratio,layout:"original" as const,captions:false,mode:"manual" as const},[w,h]=dimensions(settings);
 const p:Project={id,title:body.title.trim(),duration:0,width:w,height:h,createdAt:now,updatedAt:now,settings,status:"queued",stage:"queued",detail:"Compilation queued",clips:[],highlights:[]};await save(p);
 enqueue(id,async signal=>{const temporary:string[]=[];let combined="",duration=0;const segments:Segment[]=[];
 const scratch=()=>{const name=file("temp",randomUUID(),"mp4");temporary.push(name);return name};
 const encode=["-c:v","libx264","-preset","superfast","-threads","2","-c:a","aac","-ar","48000","-movflags","+faststart"];
 try{for(const [i,c] of clips.entries()){p.status="processing";p.stage="rendering";p.detail=`Preparing compilation clip ${i+1} of ${clips.length}`;await save(p);const src=file("clips",c.id,"mp4");const media=JSON.parse(await run(bin.ffprobe,["-v","error","-show_streams","-show_format","-of","json",src],signal));const len=Number(media.format.duration);const audio=media.streams.some((s:{codec_type:string})=>s.codec_type==="audio");const norm=scratch();
 await run(bin.ffmpeg,["-loglevel","error","-threads","2","-i",src,...(audio?[]:["-f","lavfi","-i","anullsrc=r=48000:cl=stereo"]),"-map","0:v","-map",audio?"0:a:0":"1:a","-t",String(len),"-vf",`fps=30,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,"-af",(body.normalize?"loudnorm=I=-16:TP=-1.5:LRA=11,":"")+"aformat=channel_layouts=stereo,apad",...encode,norm],signal);
 const overlap=i&&body.transition!=="Cut"?Math.min(body.seconds,len/3,duration/3):0,offset=duration-overlap;
 if(i===0)combined=norm;else{const out=scratch();const graph=overlap?`[0:v][1:v]xfade=transition=${transitions[body.transition]}:duration=${overlap}:offset=${offset}[v];[0:a][1:a]acrossfade=d=${overlap}[a]`:"[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]";await run(bin.ffmpeg,["-loglevel","error","-i",combined,"-i",norm,"-filter_complex_threads","1","-filter_complex",graph,"-map","[v]","-map","[a]",...encode,out],signal);await fs.rm(combined,{force:true});await fs.rm(norm,{force:true});combined=out}
 for(const s of c.segments.filter(s=>s.end>c.start&&s.start<c.end)){segments.push({text:s.text,start:offset+Math.max(0,s.start-c.start),end:offset+Math.min(len,s.end-c.start),words:[]})}duration=offset+len}
 const qa=await verifyRender(combined,w,h,duration,true,signal);await fs.rename(combined,file("uploads",id,"mp4"));await probe(p,signal);const clipId=randomUUID(),dest=file("clips",clipId,"mp4");await fs.link(file("uploads",id,"mp4"),dest).catch(()=>fs.copyFile(file("uploads",id,"mp4"),dest));p.clips=[{id:clipId,file:clipId+".mp4",title:p.title,reason:"User-arranged compilation of "+clips.length+" rendered clips",score:null,start:0,end:p.duration,segments,settings,qa}];await fs.writeFile(file("transcripts",id,"json"),JSON.stringify(segments));p.status="ready";p.stage="complete";p.detail="Compilation ready";await save(p);
 }finally{await Promise.all(temporary.map(path=>fs.rm(path,{force:true})))}});return p
}

