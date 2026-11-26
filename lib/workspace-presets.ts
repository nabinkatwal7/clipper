import { studioStorage } from "./client-storage";

export type WorkspacePreset = {
  zoom: number;
  snap: boolean;
  tool?: string;
};

const KEY = "clipper-workspace-preset";

export function loadWorkspace(): WorkspacePreset | null {
  try {
    const raw = studioStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as WorkspacePreset;
    if (
      !data ||
      !Number.isFinite(data.zoom) ||
      typeof data.snap !== "boolean"
    )
      return null;
    return {
      zoom: Math.min(6, Math.max(0.4, data.zoom)),
      snap: data.snap,
      tool: typeof data.tool === "string" ? data.tool : undefined,
    };
  } catch {
    return null;
  }
}

export function saveWorkspace(preset: WorkspacePreset) {
  studioStorage.setItem(
    KEY,
    JSON.stringify({
      zoom: Math.min(6, Math.max(0.4, preset.zoom)),
      snap: preset.snap,
      tool: preset.tool,
    }),
  );
}