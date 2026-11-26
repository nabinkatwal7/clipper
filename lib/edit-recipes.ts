import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workspaceRoot } from "./store";
import { defaults, type Settings } from "./types";
import { settings as validateSettings } from "./validation";

export type RecipeOp =
  | { op: "layout"; layout: Settings["layout"] }
  | { op: "captions"; captions: boolean; style?: Settings["style"] }
  | { op: "ratio"; ratio: Settings["ratio"]; resolution?: Settings["resolution"] }
  | { op: "volume"; volume: number }
  | { op: "grade"; grade: NonNullable<Settings["grade"]> }
  | { op: "branding"; overlayText?: string; overlayY?: number }
  | { op: "encode"; encodeProfile: NonNullable<Settings["encodeProfile"]> };

export type EditRecipe = {
  version: 1;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  operations: RecipeOp[];
};

function recipesDir() {
  return path.join(workspaceRoot(), "recipes");
}

function recipePath(id: string) {
  return path.join(recipesDir(), id + ".json");
}

export function validateRecipeOp(op: unknown): RecipeOp {
  if (!op || typeof op !== "object" || !("op" in op))
    throw Error("Invalid recipe operation");
  const row = op as RecipeOp;
  switch (row.op) {
    case "layout":
      if (!["center", "blur", "crop", "facecam", "original"].includes(row.layout))
        throw Error("Invalid layout recipe");
      return row;
    case "captions":
      if (typeof row.captions !== "boolean") throw Error("Invalid captions recipe");
      if (
        row.style !== undefined &&
        !["minimal", "bold", "highlight"].includes(row.style)
      )
        throw Error("Invalid caption style");
      return row;
    case "ratio":
      if (!["9:16", "1:1", "4:5", "16:9"].includes(row.ratio))
        throw Error("Invalid ratio recipe");
      if (
        row.resolution !== undefined &&
        !["720", "1080"].includes(row.resolution)
      )
        throw Error("Invalid resolution");
      return row;
    case "volume":
      if (!Number.isFinite(row.volume) || row.volume < 0 || row.volume > 2)
        throw Error("Volume must be 0–2");
      return row;
    case "grade":
      if (!row.grade || typeof row.grade !== "object")
        throw Error("Invalid grade recipe");
      return row;
    case "branding":
      if (
        row.overlayText !== undefined &&
        (typeof row.overlayText !== "string" || row.overlayText.length > 120)
      )
        throw Error("Invalid branding text");
      if (
        row.overlayY !== undefined &&
        (!Number.isFinite(row.overlayY) || row.overlayY < 0 || row.overlayY > 1)
      )
        throw Error("Invalid overlay position");
      return row;
    case "encode":
      if (
        !["fast", "balanced", "quality", "draft", "archive"].includes(
          row.encodeProfile,
        )
      )
        throw Error("Invalid encode profile");
      return row;
    default:
      throw Error("Unsupported recipe operation");
  }
}

export function validateRecipe(input: unknown): EditRecipe {
  if (!input || typeof input !== "object") throw Error("Invalid recipe");
  const r = input as EditRecipe;
  if (
    r.version !== 1 ||
    typeof r.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(r.id) ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    r.name.length > 120 ||
    typeof r.description !== "string" ||
    r.description.length > 600 ||
    !Array.isArray(r.operations) ||
    !r.operations.length ||
    r.operations.length > 40
  )
    throw Error("Invalid edit recipe");
  return {
    version: 1,
    id: r.id,
    name: r.name.trim(),
    description: r.description.trim(),
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    operations: r.operations.map(validateRecipeOp),
  };
}

/** Apply validated recipe ops onto settings (configuration replication). */
export function applyRecipe(
  base: Settings,
  recipe: EditRecipe,
): Settings {
  let next: Settings = { ...base };
  for (const op of recipe.operations) {
    switch (op.op) {
      case "layout":
        next = { ...next, layout: op.layout };
        break;
      case "captions":
        next = {
          ...next,
          captions: op.captions,
          style: op.style || next.style,
        };
        break;
      case "ratio":
        next = {
          ...next,
          ratio: op.ratio,
          resolution: op.resolution || next.resolution,
        };
        break;
      case "volume":
        next = { ...next, volume: op.volume };
        break;
      case "grade":
        next = { ...next, grade: { ...next.grade, ...op.grade } };
        break;
      case "branding":
        next = {
          ...next,
          overlayText: op.overlayText ?? next.overlayText,
          overlayY: op.overlayY ?? next.overlayY,
        };
        break;
      case "encode":
        next = { ...next, encodeProfile: op.encodeProfile };
        break;
    }
  }
  return validateSettings(next);
}

export function recipeFromSettings(
  name: string,
  s: Settings,
  description = "",
): EditRecipe {
  const operations: RecipeOp[] = [
    { op: "layout", layout: s.layout },
    { op: "captions", captions: s.captions, style: s.style },
    { op: "ratio", ratio: s.ratio, resolution: s.resolution },
  ];
  if (s.volume !== undefined) operations.push({ op: "volume", volume: s.volume });
  if (s.grade) operations.push({ op: "grade", grade: s.grade });
  if (s.overlayText)
    operations.push({
      op: "branding",
      overlayText: s.overlayText,
      overlayY: s.overlayY,
    });
  if (s.encodeProfile)
    operations.push({ op: "encode", encodeProfile: s.encodeProfile });
  const now = new Date().toISOString();
  return validateRecipe({
    version: 1,
    id: randomUUID(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
    operations,
  });
}

export async function listRecipes() {
  await fs.mkdir(recipesDir(), { recursive: true });
  const names = await fs.readdir(recipesDir());
  return Promise.all(
    names
      .filter((n) => n.endsWith(".json"))
      .map(async (n) =>
        validateRecipe(
          JSON.parse(await fs.readFile(path.join(recipesDir(), n), "utf8")),
        ),
      ),
  );
}

export async function saveRecipe(recipe: EditRecipe) {
  const r = validateRecipe(recipe);
  await fs.mkdir(recipesDir(), { recursive: true });
  const tmp = recipePath(r.id) + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(r, null, 2));
    await fs.rename(tmp, recipePath(r.id));
  } finally {
    await fs.rm(tmp, { force: true });
  }
  return r;
}

export async function deleteRecipe(id: string) {
  await fs.rm(recipePath(id), { force: true });
}

export function defaultVerticalRecipe(): EditRecipe {
  return recipeFromSettings(
    "Vertical captioned short",
    {
      ...defaults,
      layout: "center",
      ratio: "9:16",
      resolution: "1080",
      captions: true,
      style: "bold",
      encodeProfile: "balanced",
    },
    "Apply vertical layout, bold captions and balanced encode.",
  );
}
