import { promises as fs } from "node:fs";
import path from "node:path";
import { workspaceRoot } from "./store";
import { settings as validateSettings } from "./validation";
import type { Segment, Settings } from "./types";

export type EditDraft = {
  project: string;
  clip: string;
  savedAt: string;
  title?: string;
  postCaption?: string;
  start?: number;
  end?: number;
  settings: Settings;
  segments: Segment[];
};

function draftPath(project: string, clip: string) {
  return path.join(workspaceRoot(), "drafts", project + "." + clip + ".json");
}

export async function saveEditDraft(draft: EditDraft) {
  const dir = path.join(workspaceRoot(), "drafts");
  await fs.mkdir(dir, { recursive: true });
  const payload: EditDraft = {
    ...draft,
    settings: validateSettings(draft.settings),
    savedAt: new Date().toISOString(),
  };
  const target = draftPath(draft.project, draft.clip);
  const temporary = target + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(payload, null, 2));
  await fs.rename(temporary, target);
  return payload;
}

export async function readEditDraft(project: string, clip: string) {
  try {
    const text = await fs.readFile(draftPath(project, clip), "utf8");
    const data = JSON.parse(text) as EditDraft;
    return {
      ...data,
      settings: validateSettings(data.settings),
    };
  } catch {
    return null;
  }
}
