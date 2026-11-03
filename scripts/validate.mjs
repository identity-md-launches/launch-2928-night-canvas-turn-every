// Exercise the production static export, with explicitly synthetic API responses.
// Run npm run build first. No test data is shipped in the runtime bundle.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { statsFixture, statusFixture, TEST_TIME } from "../tests/fixtures.mjs";

const require = createRequire(
  process.env.NIGHT_CANVAS_MODULES
    ? join(process.env.NIGHT_CANVAS_MODULES, "../package.json")
    : new URL("../package.json", import.meta.url),
);
const playwrightModule = await import(
  pathToFileURL(require.resolve("playwright"))
);
const { chromium, webkit } = playwrightModule.default ?? playwrightModule;
const axeModule = await import(
  pathToFileURL(require.resolve("@axe-core/playwright"))
);
const AxeBuilder = axeModule.default.default ?? axeModule.default;
const output = resolve("test/scratch/validation");
await mkdir(output, { recursive: true });
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const name =
      decodeURIComponent(url.pathname.slice("/preview/".length)) ||
      "index.html";
    const file = resolve(root, name);
    if (!file.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [],
  errors = [],
  localFailures = [];
let browser, page;
const step = async (name, fn) => {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, ms: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.error(`FAIL ${name}: ${error}`);
    if (page && !page.isClosed())
      await page
        .screenshot({ path: join(output, "failure.png"), fullPage: true })
        .catch(() => {});
    throw error;
  }
};
const visible = (locator) =>
  locator.waitFor({ state: "visible", timeout: 10000 });
const textMatches = async (locator, pattern) =>
  assert.match(await locator.innerText(), pattern);

async function newMockPage({
  state = "ACTIVE",
  stats = statsFixture(),
  rateLimit = false,
  schema = 1,
} = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const next = await context.newPage();
  await next.clock.install({ time: new Date(TEST_TIME) });
  let requests = 0;
  const control = { state, fail: false };
  next.on("pageerror", (e) => errors.push(e.message));
  next.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      localFailures.push(`${r.status()} ${r.url()}`);
  });
  await next.route(
    "https://api.squeekchain.com/v1/measurement/stats?range=30d",
    (route) => route.fulfill({ json: stats }),
  );
  await next.route("https://api.squeekchain.com/v1/status", (route) => {
    requests++;
    if (control.fail) return route.abort("failed");
    if (rateLimit && requests === 1)
      return route.fulfill({
        status: 429,
        headers: {
          "Retry-After": "45",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "Retry-After",
        },
        json: { error: "rate_limited" },
      });
    return route.fulfill({
      json: {
        ...statusFixture({
          coreStatus: control.state,
          ...(control.state === "IDLE"
            ? { rpmMilli: 0, speedMmPerSecond: 0 }
            : {}),
        }),
        schemaVersion: schema,
      },
    });
  });
  await next.goto(url);
  await next
    .locator(".night-card")
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  return { context, page: next, control, count: () => requests };
}

try {
  browser = await chromium.launch({ headless: true });
  const main = await newMockPage();
  page = main.page;
  await step(
    "390px first screen: canvas, honest live state, units, primary action",
    async () => {
      await visible(page.getByText("RUNNING", { exact: true }));
      await textMatches(page.locator(".live-stats"), /3\.46 km/);
      await textMatches(page.locator(".live-stats"), /1\.10/);
      await textMatches(page.locator(".live-stats"), /76\.5/);
      const box = await page
        .getByRole("link", { name: "View tonight’s artwork", exact: true })
        .boundingBox();
      assert.ok(
        box && box.y >= 0 && box.y + box.height <= 844,
        `primary action bottom=${box?.y + box?.height}`,
      );
      assert.ok(await page.locator(".tonight-art canvas").isVisible());
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        390,
      );
    },
  );
  await step(
    "gallery filters, empty-free results, sorting, show all 30 nights",
    async () => {
      await page
        .getByRole("button", { name: "With activity", exact: true })
        .click();
      assert.equal(await page.locator(".night-card").count(), 5);
      await page.getByLabel("Sort nights").selectOption("active");
      assert.match(
        await page.locator(".night-card").first().getAttribute("href"),
        /2026-10-29/,
      );
      await page
        .getByRole("button", { name: "Quiet nights", exact: true })
        .click();
      assert.equal(await page.locator(".night-card").count(), 1);
      await textMatches(page.locator(".night-card"), /0\.00 km/);
      await page
        .getByRole("button", { name: "All nights", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Show all 30 nights", exact: true })
        .click();
      assert.equal(await page.locator(".night-card").count(), 30);
      await visible(page.getByText("No readings", { exact: true }).first());
      await page
        .getByRole("button", { name: "Show fewer nights", exact: true })
        .click();
      assert.equal(await page.locator(".night-card").count(), 6);
    },
  );
  await step(
    "records and typical-day heatmap selection, with an accessible 48-row alternative",
    async () => {
      await textMatches(page.locator(".records-grid"), /6\.00 km/);
      await textMatches(page.locator(".records-grid"), /5 nights/);
      await textMatches(page.locator(".records-grid"), /Unknown/);
      await page.locator("button.heat-cell").first().click();
      await textMatches(page.locator(".heatmap-selection"), /12:00–12:30 UTC/);
      await page.getByText("View half-hour data", { exact: true }).click();
      assert.equal(await page.locator(".typical-day tbody tr").count(), 48);
      await page.getByText("View half-hour data", { exact: true }).click();
    },
  );
  await step(
    "theme toggle persists; both themes reflow at 320, 390, 820, 1440",
    async () => {
      for (const theme of ["light", "dark"]) {
        const current = await page.locator("html").getAttribute("data-theme");
        if (current !== theme)
          await page
            .getByRole("button", { name: `Switch to ${theme} mode` })
            .click();
        await page.reload();
        await visible(page.getByText("RUNNING", { exact: true }));
        assert.equal(
          await page.locator("html").getAttribute("data-theme"),
          theme,
        );
        for (const width of [320, 390, 820, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth),
            width,
            `${theme} overflow at ${width}`,
          );
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
    },
  );
  await step(
    "200% text enlargement reflows home and artwork at 320 and 390",
    async () => {
      for (const route of ["", "#/art/2026-11-02"]) {
        await page.goto(url + route);
        const style = await page.addStyleTag({
          content: ":root{font-size:200%}",
        });
        await page.evaluate(() => document.fonts.ready);
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 844 });
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth),
            width,
            `enlarged text overflow at ${width} ${route}`,
          );
        }
        await page.screenshot({
          path: join(output, `text-200-${route ? "artwork" : "home"}.png`),
          fullPage: true,
        });
        await style.evaluate((el) => el.remove());
      }
      await page.setViewportSize({ width: 390, height: 844 });
    },
  );
  await step(
    "artwork route, reload, heading focus, PNG export and X intent with the real page URL",
    async () => {
      await page.goto(url + "#/art/2026-11-02");
      await visible(page.getByRole("button", { name: "Download PNG" }));
      await page.reload();
      await visible(page.getByRole("button", { name: "Download PNG" }));
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        "page-heading",
      );
      const intent = new URL(
        await page
          .getByRole("link", { name: "Share on X" })
          .getAttribute("href"),
      );
      assert.equal(intent.pathname, "/intent/tweet");
      assert.equal(intent.searchParams.get("url"), url + "#/art/2026-11-02");
      assert.match(intent.searchParams.get("text"), /2 November 2026/);
      const pngs = [];
      for (let i = 0; i < 2; i++) {
        const pending = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download PNG" }).click();
        const file = await pending;
        assert.equal(file.suggestedFilename(), "night-canvas-2026-11-02.png");
        const path = join(output, `artwork-${i}.png`);
        await file.saveAs(path);
        const bytes = await readFile(path);
        assert.equal(bytes.readUInt32BE(16), 1200);
        assert.equal(bytes.readUInt32BE(20), 675);
        pngs.push(createHash("sha256").update(bytes).digest("hex"));
      }
      assert.equal(
        pngs[0],
        pngs[1],
        "same data should export the exact same PNG",
      );
      await textMatches(
        page.locator(".download-feedback"),
        /1200 × 675 PNG is ready/,
      );
      await page
        .getByText("Explore the 48 half-hours", { exact: true })
        .click();
      assert.equal(await page.locator(".night-data tbody tr").count(), 48);
      await page
        .getByText("Explore the 48 half-hours", { exact: true })
        .click();
      for (const width of [320, 390, 820, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth),
          width,
        );
      }
      await page.setViewportSize({ width: 390, height: 844 });
    },
  );
  await step(
    "keyboard skip preserves the artwork route and focus is visible",
    async () => {
      await page.locator(".skip-link").focus();
      await page.keyboard.press("Enter");
      assert.match(page.url(), /#\/art\/2026-11-02$/);
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        "main",
      );
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => ({
        tag: document.activeElement.tagName,
        outline: getComputedStyle(document.activeElement).outlineStyle,
      }));
      assert.equal(focus.tag, "A");
      assert.equal(focus.outline, "solid");
      await page.screenshot({ path: join(output, "keyboard-focus.png") });
    },
  );
  await step(
    "unknown nights cannot export invented artwork; malformed and out-of-window routes recover",
    async () => {
      await page.goto(url + "#/art/2026-10-20");
      await visible(
        page.getByText("No recorded artwork for this night", { exact: true }),
      );
      assert.ok(
        await page.getByRole("button", { name: "Download PNG" }).isDisabled(),
      );
      assert.match(
        await page.locator(".artwork-large canvas").getAttribute("aria-label"),
        /No readings available/,
      );
      await textMatches(page.locator(".artwork-stats"), /Unknown/);
      await page.goto(url + "#/art/2026-99-99");
      await visible(page.getByRole("heading", { name: "This sky isn’t here" }));
      await page.goto(url + "#/art/2020-01-01");
      await visible(
        page.getByText(
          "This date has no readings in the current 30-day window. Choose another night from the collection.",
        ),
      );
      await page.getByRole("link", { name: "Explore nights" }).click();
      await visible(
        page.getByRole("heading", { name: "The nightly collection" }),
      );
      await page.waitForFunction(
        () => document.activeElement?.id === "gallery-heading",
      );
    },
  );
  await step(
    "axe WCAG A/AA scan of home and artwork in both themes",
    async () => {
      for (const route of ["", "#/art/2026-11-02"]) {
        await page.goto(url + route);
        await visible(page.getByRole("link", { name: "Night Canvas home" }));
        if (route)
          await visible(page.getByRole("button", { name: "Download PNG" }));
        for (const theme of ["dark", "light"]) {
          if ((await page.locator("html").getAttribute("data-theme")) !== theme)
            await page
              .getByRole("button", { name: `Switch to ${theme} mode` })
              .click();
          const scan = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          await writeFile(
            join(output, `axe-${route ? "artwork" : "home"}-${theme}.json`),
            JSON.stringify(scan.violations, null, 2),
          );
          assert.deepEqual(
            scan.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
            [],
            `${theme} ${route || "home"}`,
          );
        }
      }
    },
  );
  await main.context.close();

  await step(
    "status polls at 15 seconds, repaints live pixels, and recovers from a fault",
    async () => {
      const test = await newMockPage();
      page = test.page;
      await visible(page.getByText("RUNNING", { exact: true }));
      const initialCount = test.count();
      const running = await page
        .locator(".tonight-art canvas")
        .evaluate((c) => c.toDataURL());
      test.control.state = "IDLE";
      await page.clock.runFor(15100);
      await visible(page.getByText("RESTING", { exact: true }));
      assert.equal(test.count(), initialCount + 1);
      const resting = await page
        .locator(".tonight-art canvas")
        .evaluate((c) => c.toDataURL());
      assert.notEqual(resting, running);
      test.control.state = "COUNTER_FAULT";
      await page.clock.runFor(15100);
      await visible(page.getByText("SIGNAL LOST", { exact: true }));
      await textMatches(page.locator(".live-stats"), /Unknown/);
      test.control.state = "ACTIVE";
      await page.clock.runFor(15100);
      await visible(page.getByText("RUNNING", { exact: true }));
      test.control.fail = true;
      await page.clock.runFor(15100);
      await visible(page.getByText("SIGNAL LOST", { exact: true }));
      await visible(
        page.getByText("Unable to reach the public readings.", {
          exact: false,
        }),
      );
      test.control.fail = false;
      await page.clock.runFor(15100);
      await visible(page.getByText("RUNNING", { exact: true }));
      await test.context.close();
    },
  );
  await step(
    "429 Retry-After is honored; manual retry cannot bypass the cooldown",
    async () => {
      const test = await newMockPage({ rateLimit: true });
      page = test.page;
      await visible(
        page.getByText("Too many requests. Waiting before trying again.", {
          exact: false,
        }),
      );
      assert.equal(test.count(), 1);
      assert.ok(
        await page
          .getByRole("button", { name: "Retry", exact: true })
          .isDisabled(),
      );
      await page.clock.runFor(44000);
      assert.equal(test.count(), 1);
      await page.clock.runFor(1500);
      await visible(page.getByText("RUNNING", { exact: true }));
      assert.equal(test.count(), 2);
      await test.context.close();
    },
  );
  await step(
    "unsupported schema shows unknown live values and a recoverable error",
    async () => {
      const test = await newMockPage({ schema: 2 });
      page = test.page;
      await visible(page.getByText("SIGNAL LOST", { exact: true }));
      await visible(
        page.getByText("This data version is not supported.", { exact: false }),
      );
      await textMatches(page.locator(".live-stats"), /Unknown/);
      await test.context.close();
    },
  );
  await step(
    "unavailable history and filter empty states explain what to do next",
    async () => {
      const unavailable = await newMockPage({
        stats: { schemaVersion: 1, status: "unavailable" },
      });
      page = unavailable.page;
      await visible(
        page.getByRole("heading", { name: "The collection is waiting" }),
      );
      assert.equal(await page.locator(".night-card").count(), 0);
      await visible(
        page.getByText("Night history unavailable", { exact: true }),
      );
      await textMatches(
        page.locator(".gallery-section > .sr-only"),
        /Night readings are unavailable/,
      );
      await unavailable.context.close();
      const data = statsFixture();
      data.activity.days.forEach((d) =>
        d.buckets.forEach((b) => {
          if (b.workUnits !== null) b.workUnits = "0";
        }),
      );
      const empty = await newMockPage({ stats: data });
      page = empty.page;
      await page
        .getByRole("button", { name: "With activity", exact: true })
        .click();
      await visible(
        page.getByRole("heading", { name: "No active nights in this window" }),
      );
      await page
        .getByRole("button", { name: "Show all nights", exact: true })
        .click();
      assert.equal(await page.locator(".night-card").count(), 6);
      await empty.context.close();
    },
  );
  await step(
    "production export has no local resource failures or JavaScript errors",
    async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(localFailures, []);
      const html = await readFile(join(root, "index.html"), "utf8");
      assert.match(html, /src="\.\/assets\//);
      assert.match(html, /href="\.\/assets\//);
      assert.match(html, /og:image/);
      await readFile(join(root, "share.png"));
    },
  );

  try {
    const safari = await webkit.launch({ headless: true });
    const context = await safari.newContext({
      viewport: { width: 390, height: 844 },
    });
    const webPage = await context.newPage();
    await webPage.route(
      "https://api.squeekchain.com/v1/measurement/stats?range=30d",
      (r) => r.fulfill({ json: statsFixture() }),
    );
    await webPage.route("https://api.squeekchain.com/v1/status", (r) =>
      r.fulfill({
        json: statusFixture({ receivedAt: new Date().toISOString() }),
      }),
    );
    await webPage.goto(url);
    await webPage.locator(".night-card").first().waitFor();
    await webPage.locator(".night-card").nth(1).click();
    await webPage.getByRole("button", { name: "Download PNG" }).waitFor();
    results.push({ name: "WebKit artwork navigation", passed: true });
    await safari.close();
  } catch (error) {
    const message = String(error);
    if (
      !/missing dependencies|Executable doesn't exist|Host system is missing/.test(
        message,
      )
    )
      throw error;
    results.push({
      name: "WebKit artwork navigation",
      passed: null,
      limitation: message.slice(0, 500),
    });
    console.log(
      "LIMITATION WebKit could not launch: missing native browser libraries.",
    );
  }
} finally {
  await writeFile(
    join(output, "results.json"),
    JSON.stringify({ results, errors, localFailures }, null, 2),
  );
  await browser?.close();
  await new Promise((done) => server.close(done));
}
console.log(
  `${results.filter((r) => r.passed === true).length} interaction groups passed; ${results.filter((r) => r.passed === null).length} browser limitations.`,
);
