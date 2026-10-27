import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "script transport desktop and touch coverage"));

for (const transport of ["inline", "base64"]) {
  test(`${transport} transport preserves Unicode, inline execution and asynchronous readiness`, async ({ context, page }) => {
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/v/test-id");
    const text = "中文 🚀 café </script>\u2028\u2029";
    const source = `\uFEFFwindow.__transport = { text: ${JSON.stringify(text)}, source: document.currentScript.textContent, hook: window.__beforeTransport, complete: false };
      setTimeout(() => { window.__transport.complete = true; window.__jhsBrowserDiagnostics.bootstrapPhases = { "first-ready": performance.now() }; }, 75);`;
    await injectUserscriptRuntime(page, {
      userscriptSource: source, userscriptTransport: transport,
      beforeUserscriptInjection: hostPage => hostPage.evaluate(() => { window.__beforeTransport = true; }),
    });
    expect(await page.evaluate(() => window.__transport)).toEqual({ text, source, hook: true, complete: true });
  });
}

test("byte transport executes the selected Dev file and keeps its source URL", async ({ context, page }) => {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id");
  const path = process.env.JHS_TEST_BUNDLE_PATH || fileURLToPath(new URL("../../../dist/dev/JHS-7.0.dev.user.js", import.meta.url));
  const source = await readFile(path, "utf8");
  await injectUserscriptRuntime(page, { userscriptTransport: "base64", settingOverrides: { enableLoadReview: "no" } });
  const injected = await page.locator("script").evaluateAll(nodes => nodes.map(node => node.textContent).find(text => text.includes("data-jhs-dev-build")));
  expect(injected).toBe(`${source}\n//# sourceURL=${path.replace(/\n/g, "")}`);
  expect(await page.locator("html").getAttribute("data-jhs-dev-build")).toBeTruthy();
  expect(await page.evaluate(() => window.__jhsBrowserDiagnostics.bootstrapPhases["feature-ready-signal"])).toBeGreaterThan(0);
  await expect(page.locator("#xunLeiSubtitleBtn")).toBeVisible();
});
