import {AsyncLocalStorage} from "node:async_hooks";
import path from "node:path";
const globalStore=globalThis as typeof globalThis & {studioScope?:AsyncLocalStorage<string>};
export const workspaceScope=globalStore.studioScope??=new AsyncLocalStorage<string>();
export const storageBase=path.resolve(process.env.CLIPPER_STORAGE_DIR||path.join(process.cwd(),"storage"));
export function workspaceRoot(){const user=workspaceScope.getStore();return user?path.join(storageBase,"workspaces",user):storageBase}

