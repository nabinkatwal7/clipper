import type {Project,Segment} from "./types";
export const metrics=["views","likes","comments","shares","saves","watchSeconds","averageSeconds","completionPercent","followers","revenue"] as const;
export type Metrics=Partial<Record<typeof metrics[number],number>>;
export type Review={status:"unreviewed"|"accepted"|"rejected"|"changes";notes:string;score:number|null;favorite:boolean};
export type Rights={creator:string;license:string;permission:"unknown"|"permitted"|"restricted";attribution:string;notes:string};
export type Ledger={version:1;rights:Rights;reviews:Record<string,Review>;analytics:Record<string,Metrics>};
export const emptyLedger=():Ledger=>({version:1,rights:{creator:"",license:"",permission:"unknown",attribution:"",notes:""},reviews:{},analytics:{}});
export function metricValues(input:unknown):Metrics{if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Expected a measurement record");const out:Metrics={};for(const [key,val] of Object.entries(input)){if(!metrics.includes(key as keyof Metrics)||typeof val!=="number"||!Number.isFinite(val)||val<0||(key==="completionPercent"&&val>100))throw Error("Invalid measurement: "+key);out[key as keyof Metrics]=val}return out}
export function report(p:Project,segments:Segment[],ledger:Ledger,index?:{scenes:number[];peaks:number[]}){
 const freq=new Map<string,number>();for(const s of segments)for(const word of s.text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)||[])freq.set(word,(freq.get(word)||0)+1);
 const moments=p.highlights.map(h=>({title:h.title,start:h.start,end:h.end,reason:h.reason,estimatedScore:h.score,quote:segments.find(s=>s.start>=h.start&&s.end<=h.end)?.text||null}));
 return {schemaVersion:1,project:p.title,source:p.source||"Local upload",durationSeconds:p.duration,summary:`${segments.length} transcript segments, ${moments.length} selected moments and ${p.clips.length} rendered clips.`,frequentTerms:[...freq].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([term,count])=>({term,count})),moments,category:p.settings.category||null,selectedDuration:p.settings.duration,audioActivity:index?.peaks??null,sceneTimes:index?.scenes??null,rights:ledger.rights,actualPerformance:ledger.analytics,limitations:["Scores are model estimates. Quotes are taken from stored transcript text.",...(index?[]:["Audio and scene index unavailable."]), "Chat activity unavailable without imported chat data."]};
}
export function reportText(r:ReturnType<typeof report>){return ["# "+r.project,r.summary,"Source: "+r.source,"## Frequent terms",r.frequentTerms.map(t=>t.term+" ("+t.count+")").join(", "),"## Selected moments",...r.moments.map(m=>`- ${m.start}–${m.end}s · ${m.title} · ${m.reason}`),"## Attribution",r.rights.attribution||r.rights.creator||"Unspecified","## Limitations",...r.limitations].join("\n\n")}
export function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!))}

