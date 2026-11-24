"use client";
import type {Locale} from "@/lib/public-copy";
export function LocalePicker({locale}:{locale:Locale}){return <select aria-label="Interface language" value={locale} onChange={e=>{document.cookie="studio_locale="+e.target.value+"; Path=/; SameSite=Strict; Max-Age=31536000";location.reload()}}><option value="en">English</option><option value="ne">नेपाली</option><option value="hi">हिन्दी</option></select>}
