function prefix(){const id=document.querySelector<HTMLElement>("[data-workspace-user]")?.dataset.workspaceUser;if(!id)throw Error("Open a signed-in workspace.");return "ws:"+id+":"}
export const studioStorage={getItem:(key:string)=>window.localStorage.getItem(prefix()+key),setItem:(key:string,value:string)=>window.localStorage.setItem(prefix()+key,value),removeItem:(key:string)=>window.localStorage.removeItem(prefix()+key),keys:()=>{const p=prefix();return Object.keys(window.localStorage).filter(k=>k.startsWith(p)).map(k=>k.slice(p.length))}};

