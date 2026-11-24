import {metrics,metricValues,type Metrics} from "./production";
export function importMeasurements(text:string):Array<{clip:string;values:Metrics}> {
 if(typeof text!=="string"||text.length>500000)throw Error("Choose a CSV below 500 KB.");
 // All supported fields are numeric or identifiers. Quoted fields may contain thousands separators.
 const rows=text.trim().replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim());
 function cells(line:string){const fields:string[]=[];let i=0;for(;;){const match=/^(?:"((?:[^"]|"")*)"|([^",]*))(,|$)/.exec(line.slice(i));if(!match)throw Error("Malformed CSV field");fields.push((match[1]??match[2]).replaceAll('""','"').trim());i+=match[0].length;if(!match[3])return fields;}}
 const headers=cells(rows.shift()||"");if(!headers.includes("clip")||headers.length<2||new Set(headers).size!==headers.length||headers.some(k=>k!=="clip"&&!metrics.includes(k as keyof Metrics)))throw Error("Use clip and one or more supported measurement headers.");
 if(!rows.length||rows.length>5000)throw Error("Include between 1 and 5000 measurement rows.");
 const seen=new Set<string>();return rows.map((line,i)=>{const row=cells(line);if(row.length!==headers.length)throw Error("Incorrect column count on row "+(i+2));const clip=row[headers.indexOf("clip")];if(seen.has(clip)||!clip)throw Error("Missing or repeated clip on row "+(i+2));seen.add(clip);
 const values:Record<string,number>={};headers.forEach((key,j)=>{if(key!=="clip"&&row[j]){if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(row[j]))throw Error("Invalid "+key+" on row "+(i+2));values[key]=Number(row[j].replaceAll(",",""))}});if(!Object.keys(values).length)throw Error("No measurements on row "+(i+2));return {clip,values:metricValues(values)}})
}
