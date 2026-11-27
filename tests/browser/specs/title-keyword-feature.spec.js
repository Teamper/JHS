import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

test("Library title filter safely confirms selected FC2 text and preserves the 6.5.1 keyword key", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic browser project covers the delegated title interaction");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableTitleSelectFilter: "yes" }, userscriptPath: devUserscriptPath, beforeUserscriptInjection: injectRealLayer });
  await expect.poll(() => page.evaluate(() => window.__jhsBrowserDiagnostics.diagnostics.exportSnapshot().activeContributions)).toContain("library.keyword-filter");
  await page.evaluate(async () => {
    await window.unsafeWindow.settingsService.set("enableTitleSelectFilter", "no");
    await window.unsafeWindow.settingsService.set("enableTitleSelectFilter", "yes");
  });
  await page.evaluate(() => {
    const workspace = document.createElement("div");
    workspace.className = "jhs-fc2-title";
    const title = document.createElement("strong");
    title.className = "current-title";
    title.textContent = "FC2-TEST <img src=x onerror=alert(1)>";
    workspace.append(title);
    window.__titleLayerId = window.layer.open({ type: 1, content: workspace.outerHTML });
    const renderedTitle = document.querySelector(`#layui-layer${window.__titleLayerId} .current-title`);
    if (!renderedTitle) throw new Error("Layer did not render the selected title");

    const range = document.createRange();
    range.selectNodeContents(renderedTitle);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    window.__titleFilterDispatchAllowed = renderedTitle.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 44, clientY: 70 }));
  });
  expect(await page.evaluate(() => window.__titleFilterDispatchAllowed)).toBe(false);
  const dialog = page.locator(".layui-layer-dialog").filter({ hasText: "屏蔽标题关键词" }).last();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(0);
  await expect(dialog).toContainText("FC2-TEST <img src=x onerror=alert(1)>");

  await dialog.locator(".layui-layer-btn").getByText("屏蔽", { exact: true }).click();
  await expect(page.locator(`#layui-layer${await page.evaluate(() => window.__titleLayerId)}`)).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => {
    const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
    return forage.getItem("filter_keyword_title");
  })).toEqual(["FC2-TEST <img src=x onerror=alert(1)>"]);
  expect(await page.evaluate(() => window.__jhsBrowserDiagnostics.getContributionDescriptors().some(({ name }) => name === "FilterTitleKeywordPlugin"))).toBe(true);
});
