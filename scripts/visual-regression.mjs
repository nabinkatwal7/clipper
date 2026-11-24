import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { strict as assert } from "node:assert";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
  headless: true,
});
const dest = process.env.SCREENSHOT_DIR || "tools/visual-regression";
await mkdir(dest, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.STUDIO_URL || "http://127.0.0.1:4000");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of [
      "Assets",
      "Discover",
      "Compilations",
      "Workflow builder",
      "Production desk",
      "Backup & recovery",
    ]) {
      if (width < 600)
        await page
          .getByRole("button", { name: "Navigation", exact: true })
          .click();
      await page.getByRole("button", { name, exact: true }).click();
      await page.getByRole("heading", { name, exact: true }).first().waitFor();
      if (name === "Production desk")
        await page
          .getByRole("heading", { name: "Stream intelligence report" })
          .or(page.getByText("Import a recording to open its production desk."))
          .first()
          .waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        console.log(
          await page.evaluate(() =>
            [...document.body.querySelectorAll("*")]
              .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 12)
              .map((e) => [e.tagName, e.className, e.clientWidth]),
          ),
        );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        name + " overflow at " + width,
      );
      await page.screenshot({
        path:
          dest + "/" + width + "-" + name.replace(/[^a-z0-9]+/gi, "-") + ".png",
        animations: "disabled",
      });
    }
    await page
      .getByRole("button", { name: "Change theme", exact: true })
      .click();
  }
  assert.deepEqual(errors, []);
  console.log("Six workspaces passed desktop and mobile layout checks.");
} finally {
  await browser.close();
}
