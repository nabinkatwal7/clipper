import { promises as fs } from "node:fs";
import path from "node:path";
import {file} from "./store";
import type {Segment} from "./types";
function stamp(s:string){return s.split(":").reduce((n,part)=>n*60+Number(part),0)}
export function parseVtt(vtt:string):Segment[]{
 const segments:Segment[]=[];let previous="";
 for(const block of vtt.replace(/\r/g,"").split(/\n\s*\n/)){
 const lines=block.split("\n");const index=lines.findIndex(line=>line.includes(" --> "));if(index===-1)continue;
 const times=lines[index].match(/(\d[\d:.]*)\s+-->\s+(\d[\d:.]*)/);if(!times)continue;
 const start=stamp(times[1]),end=stamp(times[2]);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)continue;
 const line=lines.slice(index+1).map(l=>l.replace(/<[^>]*>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim()).filter(Boolean).join(" ");
 if(!line||line===previous)continue;
 const text=line.startsWith(previous+" ")?line.slice(previous.length+1):line;previous=line;
 segments.push({start,end,text,words:[]})
 }return segments
}
export async function importSourceSubtitles(id:string){
 const target=file("transcripts",id,"json");try{await fs.access(target);return false}catch{}
 const dir=path.dirname(file("uploads",id,"vtt"));const files=(await fs.readdir(dir)).filter(n=>n.startsWith(id+".")&&n.endsWith(".vtt")).sort();
 for(const name of files){const full=path.join(dir,name);if((await fs.stat(full)).size>30*1024*1024)continue;const rows=parseVtt(await fs.readFile(full,"utf8"));if(rows.length){await fs.writeFile(target,JSON.stringify(rows),{flag:"wx"});return true}}
 return false
}
