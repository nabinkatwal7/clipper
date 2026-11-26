import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || "msedge",
  headless: true,
});
const dest = process.env.SCREENSHOT_DIR || "tools/visual-regression";
const base = new URL(process.env.STUDIO_URL || "http://127.0.0.1:4000");
const identifier = process.env.STUDIO_TEST_EMAIL;
const password = process.env.STUDIO_TEST_PASSWORD;
assert.ok(
  identifier && password,
  "Provide credentials for a dedicated visual test account.",
);
await mkdir(dest, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("pageerror", (error) => errors.push(error.message));
  const login = await page.request.post(new URL("/api/auth/login", base).href, {
    headers: { origin: base.origin },
    data: { identifier, password },
  });
  assert.equal(login.status(), 200);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of [
      "Assets",
      "Discover",
      "Compilations",
      "Workflow builder",
      "Production desk",
      "Backup & recovery",
      "Content calendar",
    ]) {
      await page.goto(
        new URL("/app#" + name.toLowerCase().replaceAll(" ", "-"), base).href,
      );
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
      if (name === "Discover") {
        const form = page.locator(".tool-layout > section").first();
        await page.mouse.move(0, 0);
        const buffer = await form.screenshot({ animations: "disabled" }),
          file = new URL(
            "../tests/visual/discover-" + width + ".png",
            import.meta.url,
          );
        if (process.env.UPDATE_VISUAL_BASELINES === "1") {
          await mkdir(new URL("../tests/visual/", import.meta.url), {
            recursive: true,
          });
          await writeFile(file, buffer);
        } else {
          const expected = (await readFile(file)).toString("base64");
          const fraction = await page.evaluate(
            async ([first, second]) => {
              async function pixels(data) {
                const bitmap = await createImageBitmap(
                  await (await fetch("data:image/png;base64," + data)).blob(),
                );
                const canvas = document.createElement("canvas");
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(bitmap, 0, 0);
                return {
                  width: canvas.width,
                  height: canvas.height,
                  data: ctx.getImageData(0, 0, canvas.width, canvas.height)
                    .data,
                };
              }
              const [a, b] = await Promise.all([pixels(first), pixels(second)]);
              if (a.width !== b.width || a.height !== b.height) return 1;
              let changed = 0;
              for (let i = 0; i < a.data.length; i += 4) {
                if (
                  Math.max(
                    ...[0, 1, 2].map((j) =>
                      Math.abs(a.data[i + j] - b.data[i + j]),
                    ),
                  ) > 24
                )
                  changed++;
              }
              return changed / (a.width * a.height);
            },
            [expected, buffer.toString("base64")],
          );
          assert.ok(
            fraction < 0.012,
            "Discovery form differs from baseline at " +
              width +
              " px (" +
              (100 * fraction).toFixed(2) +
              "% changed)",
          );
        }
      }
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
  console.log("Seven workspaces passed desktop and mobile layout checks.");
} finally {
  await browser.close();
}
