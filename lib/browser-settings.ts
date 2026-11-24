export const browserKeys = [
  "clipper-brands",
  "clipper-publishing",
  "studio-calendar",
  "studio-channels",
  "studio-vision-model",
  "studio-embedding-model",
  "studio-event-states",
  "studio-events",
  "studio-favorites",
  "studio-first-run-seen",
  "studio-inspector",
  "studio-library",
  "studio-planned-brands",
  "studio-platforms",
  "studio-publishing-notes",
  "studio-sidebar",
  "studio-text-model",
  "studio-theme","studio-appearance","studio-arrangements","studio-command-key",
  "studio-search-history",
  "studio-weekday",
] as const;
export function browserSettings(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid browser settings");
  const entries: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (
      !browserKeys.some((key) => key === k) &&
      !/^highlight-[a-f0-9-]{36}$/.test(k)
    )
      throw Error("Unknown browser setting");
    if (typeof v !== "string" || v.length > 2000000)
      throw Error("Invalid browser setting value");
    entries[k] = v;
  }
  return entries;
}
