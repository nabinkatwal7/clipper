import { uuid } from "./id";
import {
  validateComposition,
  type Composition,
} from "./composition";

/** Project sequence — named editable timeline referencing a composition. */
export type Sequence = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  composition: Composition;
  nestedOf?: string;
};

export type ProjectDocument = {
  schemaVersion: 1;
  activeSequence?: string;
  sequences: Sequence[];
};

export function emptySequence(name = "Sequence 1"): Sequence {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    name: name.slice(0, 120),
    createdAt: now,
    updatedAt: now,
    composition: { version: 1, tracks: [] },
  };
}

export function validateSequence(input: Sequence): Sequence {
  if (
    !input ||
    typeof input.id !== "string" ||
    !/^[0-9a-f-]{36}$/.test(input.id) ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 120
  )
    throw Error("Invalid sequence");
  if (input.nestedOf && !/^[0-9a-f-]{36}$/.test(input.nestedOf))
    throw Error("Invalid nested sequence reference");
  validateComposition(input.composition);
  return input;
}

export function validateProjectDocument(
  input: unknown,
): ProjectDocument {
  if (!input || typeof input !== "object")
    return { schemaVersion: 1, sequences: [emptySequence()] };
  const doc = input as ProjectDocument;
  if (doc.schemaVersion !== 1)
    throw Error("Unsupported project document schema");
  if (!Array.isArray(doc.sequences) || doc.sequences.length > 32)
    throw Error("Use at most 32 sequences");
  const ids = new Set<string>();
  const sequences = doc.sequences.map((row) => {
    const s = validateSequence(row);
    if (ids.has(s.id)) throw Error("Duplicate sequence id");
    ids.add(s.id);
    return s;
  });
  if (!sequences.length) sequences.push(emptySequence());
  if (doc.activeSequence && !ids.has(doc.activeSequence))
    throw Error("Active sequence missing");
  // Prevent cyclic nesting
  for (const s of sequences) {
    let cursor = s.nestedOf,
      guard = 0;
    while (cursor) {
      if (cursor === s.id) throw Error("Cyclic sequence nesting");
      const parent = sequences.find((x) => x.id === cursor);
      cursor = parent?.nestedOf;
      if (++guard > sequences.length) throw Error("Cyclic sequence nesting");
    }
  }
  return {
    schemaVersion: 1,
    activeSequence: doc.activeSequence || sequences[0].id,
    sequences,
  };
}

/** Migrate a legacy single composition into a project document. */
export function migrateComposition(
  composition: Composition | undefined,
): ProjectDocument {
  const seq = emptySequence("Main");
  if (composition) seq.composition = validateComposition(composition);
  return {
    schemaVersion: 1,
    activeSequence: seq.id,
    sequences: [seq],
  };
}

/** Resolve the composition used for preview/export (sequences or legacy). */
export function activeComposition(settings: {
  composition?: Composition;
  sequences?: ProjectDocument;
}): Composition | undefined {
  if (settings.sequences) {
    const doc = validateProjectDocument(settings.sequences);
    const seq =
      doc.sequences.find((s) => s.id === doc.activeSequence) ||
      doc.sequences[0];
    return seq?.composition;
  }
  return settings.composition;
}

export function setActiveSequence(
  doc: ProjectDocument,
  id: string,
): ProjectDocument {
  const next = validateProjectDocument(doc);
  if (!next.sequences.some((s) => s.id === id))
    throw Error("Sequence not found");
  return { ...next, activeSequence: id };
}

export function duplicateSequence(
  doc: ProjectDocument,
  id: string,
  name?: string,
): ProjectDocument {
  const next = validateProjectDocument(doc);
  const src = next.sequences.find((s) => s.id === id);
  if (!src) throw Error("Sequence not found");
  const copy = emptySequence(name || src.name + " copy");
  copy.composition = structuredClone(src.composition);
  copy.nestedOf = src.nestedOf;
  return validateProjectDocument({
    ...next,
    sequences: [...next.sequences, copy],
    activeSequence: copy.id,
  });
}

export function nestSequence(
  doc: ProjectDocument,
  childId: string,
  parentId: string | undefined,
): ProjectDocument {
  const next = validateProjectDocument(doc);
  if (parentId && !next.sequences.some((s) => s.id === parentId))
    throw Error("Parent sequence missing");
  if (parentId === childId) throw Error("Cannot nest a sequence into itself");
  const sequences = next.sequences.map((s) =>
    s.id === childId
      ? {
          ...s,
          nestedOf: parentId,
          updatedAt: new Date().toISOString(),
        }
      : s,
  );
  return validateProjectDocument({ ...next, sequences });
}

export function ensureSequences(settings: {
  composition?: Composition;
  sequences?: ProjectDocument;
}): ProjectDocument {
  if (settings.sequences) return validateProjectDocument(settings.sequences);
  return migrateComposition(settings.composition);
}
