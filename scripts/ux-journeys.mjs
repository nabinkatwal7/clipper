import { strict as assert } from "node:assert";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.STUDIO_URL || "http://127.0.0.1:4000";
const output = process.env.SCREENSHOT_DIR || "tools/ux-journeys";
const identifier = process.env.STUDIO_TEST_EMAIL;
const password = process.env.STUDIO_TEST_PASSWORD;
assert.ok(
  identifier && password,
  "Provide credentials for a dedicated test account.",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 940 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const shot = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name + " overflow",
    );
    await page.screenshot({
      path: output + "/" + name + ".png",
      animations: "disabled",
    });
  };
  await page.goto(base);
  await shot("public-desktop");
  await page.goto(base + "/login");
  await shot("login-desktop");
  const login = await page.request.post(base + "/api/auth/login", {
    headers: { origin: base },
    data: { identifier, password },
  });
  assert.equal(login.status(), 200);
  await page.goto(base + "/app");
  await page.getByRole("heading", { name: "Studio overview" }).waitFor();
  const setup = page.getByRole("dialog", { name: "Local setup" });
  if (await setup.isVisible()) await page.keyboard.press("Escape");
  const rail = page.getByRole("navigation", { name: "Primary workspaces" });
  assert.equal(await rail.getByRole("button").count(), 8);
  await shot("home-desktop");
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Account settings" }).waitFor();
  await shot("account-menu-desktop");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "New project", exact: true })
    .last()
    .click();
  await page.getByText("Quick clip settings", { exact: true }).waitFor();
  await page
    .getByRole("switch", { name: "Burn available subtitles into clips" })
    .click();
  await shot("import-desktop");
  await page.keyboard.press("Escape");
  await rail.getByRole("button", { name: "Projects workspace" }).click();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await page.getByLabel("Filter projects by status").selectOption("error");
  await shot("projects-desktop");
  await page.keyboard.press("Control+k");
  await page
    .getByPlaceholder("Search pages, commands, projects and clips")
    .fill("Transcript explorer");
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "Transcript explorer", exact: true })
    .waitFor();
  await shot("transcript-desktop");
  await rail.getByRole("button", { name: "Home workspace" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("home-mobile");
  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  await rail.getByRole("button", { name: "Library workspace" }).click();
  await shot("navigation-mobile");
  await page
    .getByRole("navigation", { name: "Studio pages" })
    .getByRole("button", { name: "Asset library", exact: true })
    .click();
  await page.getByRole("heading", { name: "Assets", exact: true }).waitFor();
  await shot("assets-mobile");
  await page.getByRole("button", { name: "Change theme", exact: true }).click();
  await shot("assets-mobile-light");
  assert.deepEqual(errors, []);
  console.log(
    "Public pages, workspace rail, quick import, keyboard search and mobile navigation passed.",
  );
} finally {
  await browser.close();
}
