"use client";
import {useEffect,useState} from "react";
import type {Project} from "@/lib/types";
import {duration} from "./studio-media";
export function StreamIndex({project,seek}:{project:Project;seek:(s:number)=>void}){
 const [data,setData]=useState<{scenes:number[];peaks:number[]}|null>(null),[pending,setPending]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;fetch("/api/source-index?project="+project.id).then(async r=>{if(!r.ok)throw Error("Unable to read source index.");const json=await r.json();if(active)setData(json)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[project.id,project.status]);
 async function build(){setPending(true);try{const r=await fetch("/api/source-index?project="+project.id,{method:"POST"});if(!r.ok)throw Error((await r.json()).error)}catch(e){setError(String(e))}finally{setPending(false)}}
 return <div className="source-index">{data?<><h3>Audio intensity</h3><svg role="img" aria-label="Measured audio intensity across the recording" viewBox="0 0 480 42" preserveAspectRatio="none"><path d={data.peaks.map((v,i)=>"M"+i+" 21v"+(-20*Math.sqrt(v))+"v"+(40*Math.sqrt(v))).join("")} stroke="currentColor"/></svg><label className="field">Scene changes<select value="" onChange={e=>seek(+e.target.value)}><option value="">{data.scenes.length} detected · jump to a scene</option>{data.scenes.map((s,i)=><option key={i} value={s}>{duration(s)}</option>)}</select></label></>:<button className="tool" disabled={pending||["queued","processing"].includes(project.status)} onClick={()=>void build()}>{project.stage==="indexing"?"Indexing source…":"Index audio and scene changes"}</button>}{error&&<p role="alert">{error}</p>}</div>
}
