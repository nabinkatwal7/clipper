import {cookies} from "next/headers";
import {session,cookieName} from "./auth";
import type {Locale} from "./public-copy";
export async function webUser(){return session((await cookies()).get(cookieName)?.value)}
export async function webLocale():Promise<Locale>{const l=(await cookies()).get("studio_locale")?.value;return l==="ne"||l==="hi"?l:"en"}

