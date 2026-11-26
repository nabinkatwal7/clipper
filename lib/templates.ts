import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { settings as validateSettings } from "./validation";
import { workspaceRoot } from "./store";
import type { Settings } from "./types";
import { TEXT_TRACK_ASSET } from "./composition";

const templateSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  category: z.string().max(80).default("Custom"),
  description: z.string().max(500).default(""),
  createdAt: z.string(),
  settings: z.unknown(),
});

export type EditTemplate = {
  version: 1;
  id: string;
  name: string;
  category: string;
  description: string;
  createdAt: string;
  settings: Settings;
  assets?: string[];
};

function templatesDir() {
  return path.join(workspaceRoot(), "templates");
}

export async function listTemplates() {
  await fs.mkdir(templatesDir(), { recursive: true });
  const names = await fs.readdir(templatesDir());
  const rows: EditTemplate[] = [];
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    try {
      rows.push(await readTemplate(name.slice(0, -5)));
    } catch {}
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readTemplate(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw Error("Invalid template id");
  const text = await fs.readFile(path.join(templatesDir(), id + ".json"), "utf8");
  const parsed = templateSchema.parse(JSON.parse(text));
  return {
    ...parsed,
    settings: validateSettings(parsed.settings),
  } as EditTemplate;
}

export async function saveTemplate(input: {
  name: string;
  category?: string;
  description?: string;
  settings: Settings;
  id?: string;
}) {
  await fs.mkdir(templatesDir(), { recursive: true });
  const id = input.id || randomUUID();
  if (!/^[0-9a-f-]{36}$/.test(id)) throw Error("Invalid template id");
  const template: EditTemplate = {
    version: 1,
    id,
    name: input.name.trim().slice(0, 120),
    category: (input.category || "Custom").slice(0, 80),
    description: (input.description || "").slice(0, 500),
    createdAt: new Date().toISOString(),
    settings: validateSettings(input.settings),
  };
  if (!template.name) throw Error("Template name is required.");
  const target = path.join(templatesDir(), id + ".json");
  const temporary = target + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(template, null, 2));
  await fs.rename(temporary, target);
  return template;
}

export async function deleteTemplate(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw Error("Invalid template id");
  await fs.rm(path.join(templatesDir(), id + ".json"), { force: true });
}

export function builtinTemplates(): EditTemplate[] {
  const stamp = "1970-01-01T00:00:00.000Z";
  return [
    {
      version: 1,
      id: "11111111-1111-4111-8111-111111111111",
      name: "Vertical gaming punch-in",
      category: "Gaming",
      description: "9:16 layout with bold captions and punchy grade.",
      createdAt: stamp,
      settings: validateSettings({
        ratio: "9:16",
        resolution: "1080",
        captions: true,
        style: "highlight",
        captionAnimation: "pop",
        layout: "facecam",
        grade: {
          contrast: 1.15,
          saturation: 1.1,
          effect: "vignette",
          amount: 0.35,
        },
      }),
    },
    {
      version: 1,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Podcast clean captions",
      category: "Podcast",
      description: "Centered talking-head framing with minimal captions.",
      createdAt: stamp,
      settings: validateSettings({
        ratio: "1:1",
        captions: true,
        style: "minimal",
        captionAnimation: "fade",
        layout: "center",
        grade: { effect: "none", amount: 0.5, saturation: 0.95 },
      }),
    },
    {
      version: 1,
      id: "33333333-3333-4333-8333-333333333333",
      name: "Cinematic reel",
      category: "Cinematic",
      description: "Letterbox look with cooler grade and softer captions.",
      createdAt: stamp,
      settings: validateSettings({
        ratio: "9:16",
        captions: true,
        style: "bold",
        captionAnimation: "slide",
        layout: "blur",
        grade: {
          contrast: 1.12,
          saturation: 0.85,
          temperature: -0.08,
          effect: "letterbox",
          amount: 0.55,
        },
      }),
    },
    {
      version: 1,
      id: "44444444-4444-4444-8444-444444444444",
      name: "Layered vertical story",
      category: "Short-form",
      description:
        "Sample text track layout with grade and bounce captions (metadata assets list for media slots).",
      createdAt: stamp,
      assets: [],
      settings: validateSettings({
        ratio: "9:16",
        resolution: "1080",
        captions: true,
        style: "bold",
        captionAnimation: "bounce",
        layout: "blur",
        grade: {
          contrast: 1.1,
          saturation: 1.05,
          effect: "vignette",
          amount: 0.3,
        },
        composition: {
          version: 1,
          tracks: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              name: "Title card",
              type: "text",
              asset: TEXT_TRACK_ASSET,
              text: "Your hook",
              color: "#ffffff",
              fontSize: 72,
              at: 0,
              length: 4,
              slip: 0,
              x: 0.5,
              y: 0.35,
              size: 0.25,
              opacity: 1,
              volume: 1,
              visible: true,
              muted: true,
              locked: false,
              solo: false,
              loop: false,
              fade: 0.25,
              keys: {},
            },
          ],
        },
      }),
    },
  ];
}
