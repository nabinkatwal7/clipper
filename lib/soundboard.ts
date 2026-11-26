import { promises as fs } from "node:fs";
import path from "node:path";
import { uuid } from "./id";
import { workspaceRoot } from "./store";

export type SoundPad = {
  id: string;
  label: string;
  assetId: string;
  key?: string;
  volume: number;
  loop: boolean;
};

export type SoundboardProfile = {
  version: 1;
  id: string;
  name: string;
  updatedAt: string;
  pads: SoundPad[];
};

export type SequencerPattern = {
  id: string;
  name: string;
  steps: number;
  /** padId -> boolean steps */
  lanes: Record<string, boolean[]>;
};

export type SequencerDoc = {
  version: 1;
  tempo: number;
  swing: number;
  patterns: SequencerPattern[];
  activePattern?: string;
};

function boardPath() {
  return path.join(workspaceRoot(), "soundboard.json");
}

function seqPath() {
  return path.join(workspaceRoot(), "sequencer.json");
}

export function emptyProfile(name = "Default"): SoundboardProfile {
  return {
    version: 1,
    id: uuid(),
    name: name.slice(0, 80),
    updatedAt: new Date().toISOString(),
    pads: [],
  };
}

export function emptySequencer(): SequencerDoc {
  const id = uuid();
  return {
    version: 1,
    tempo: 120,
    swing: 0,
    activePattern: id,
    patterns: [
      {
        id,
        name: "Pattern 1",
        steps: 16,
        lanes: {},
      },
    ],
  };
}

export function validatePad(input: unknown): SoundPad {
  const p = input as SoundPad;
  if (
    !p ||
    typeof p.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(p.id) ||
    typeof p.label !== "string" ||
    !p.label.trim() ||
    p.label.length > 40 ||
    typeof p.assetId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(p.assetId) ||
    !Number.isFinite(p.volume) ||
    p.volume < 0 ||
    p.volume > 1 ||
    typeof p.loop !== "boolean" ||
    (p.key !== undefined &&
      (typeof p.key !== "string" || p.key.length > 2))
  )
    throw Error("Invalid sound pad");
  return {
    id: p.id,
    label: p.label.trim(),
    assetId: p.assetId,
    key: p.key?.toLowerCase(),
    volume: p.volume,
    loop: p.loop,
  };
}

export function validateProfile(input: unknown): SoundboardProfile {
  if (!input || typeof input !== "object") throw Error("Invalid profile");
  const p = input as SoundboardProfile;
  if (
    p.version !== 1 ||
    typeof p.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(p.id) ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 80 ||
    !Array.isArray(p.pads) ||
    p.pads.length > 64
  )
    throw Error("Invalid soundboard profile");
  return {
    version: 1,
    id: p.id,
    name: p.name.trim(),
    updatedAt: new Date().toISOString(),
    pads: p.pads.map(validatePad),
  };
}

export function validateSequencer(input: unknown): SequencerDoc {
  if (!input || typeof input !== "object") throw Error("Invalid sequencer");
  const s = input as SequencerDoc;
  if (
    s.version !== 1 ||
    !Number.isFinite(s.tempo) ||
    s.tempo < 40 ||
    s.tempo > 240 ||
    !Number.isFinite(s.swing) ||
    s.swing < 0 ||
    s.swing > 0.75 ||
    !Array.isArray(s.patterns) ||
    !s.patterns.length ||
    s.patterns.length > 32
  )
    throw Error("Invalid sequencer document");
  for (const pat of s.patterns) {
    if (
      !pat ||
      typeof pat.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(pat.id) ||
      typeof pat.name !== "string" ||
      !pat.name.trim() ||
      ![8, 16, 32].includes(pat.steps) ||
      !pat.lanes ||
      typeof pat.lanes !== "object"
    )
      throw Error("Invalid pattern");
    for (const [padId, steps] of Object.entries(pat.lanes)) {
      if (!/^[0-9a-f-]{36}$/i.test(padId) || !Array.isArray(steps) || steps.length !== pat.steps)
        throw Error("Invalid lane");
      if (steps.some((v) => typeof v !== "boolean")) throw Error("Invalid step");
    }
  }
  return {
    version: 1,
    tempo: s.tempo,
    swing: s.swing,
    activePattern: s.activePattern,
    patterns: s.patterns,
  };
}

export async function loadSoundboard(): Promise<SoundboardProfile> {
  try {
    return validateProfile(JSON.parse(await fs.readFile(boardPath(), "utf8")));
  } catch {
    return emptyProfile();
  }
}

export async function saveSoundboard(profile: SoundboardProfile) {
  const p = validateProfile(profile);
  const tmp = boardPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(p, null, 2));
    await fs.rename(tmp, boardPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return p;
}

export async function loadSequencer(): Promise<SequencerDoc> {
  try {
    return validateSequencer(JSON.parse(await fs.readFile(seqPath(), "utf8")));
  } catch {
    return emptySequencer();
  }
}

export async function saveSequencer(doc: SequencerDoc) {
  const s = validateSequencer(doc);
  const tmp = seqPath() + "." + uuid() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(s, null, 2));
    await fs.rename(tmp, seqPath());
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return s;
}
