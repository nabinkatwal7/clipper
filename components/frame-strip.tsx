"use client";
import {useEffect,useRef} from "react";
export function FrameStrip({project,left,span,onSelect}:{project:string;left:number;span:number;onSelect?:(time:number)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !span) return;
    let stopped = false;
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    let i = 0;
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, c.width, c.height);
    const target = () =>
      Math.min(v.duration - 0.01, left + (span * (i + 0.5)) / 10);
    v.onloadedmetadata = () => {
      if (!stopped) v.currentTime = target();
    };
    v.onseeked = () => {
      if (stopped) return;
      ctx?.drawImage(v, i * 96, 0, 96, 54);
      if (++i < 10) v.currentTime = target();
    };
    v.src = "/api/download?project=" + project + "&kind=source";
    return <div className="frame-strip"><canvas ref={canvas} width={960} height={54} aria-label="Source frame samples"/>{onSelect&&<div className="frame-picks">{Array.from({length:10},(_,i)=><button key={i} aria-label={"Choose frame "+(i+1)} onClick={()=>onSelect(left+span*(i+.5)/10)}/>)}</div>}</div>
}
