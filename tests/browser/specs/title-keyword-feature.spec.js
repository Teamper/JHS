import { expect, test } from "@playwright/test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const devUserscriptPath = join(repoRoot, "dist", "dev", "JHS-7.0.dev.user.js");

test("Library title filter safely confirms selected FC2 text and preserves the 6.5.1 keyword key", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic browser project covers the delegated title interaction");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableTitleSelectFilter: "yes" }, userscriptPath: devUserscriptPath });
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.diagnostics.exportSnapshot().activeContributions)).toContain("library.keyword-filter");
  await page.evaluate(async () => {
    await window.unsafeWindow.settingsService.set("enableTitleSelectFilter", "no");
    await window.unsafeWindow.settingsService.set("enableTitleSelectFilter", "yes");
  });
  await page.addScriptTag({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });
  await page.evaluate(() => {
    const workspace = document.createElement("div");
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
  const dialog = page.locator(".layui-layer-dialog").filter({ hasText: "是否屏蔽标题关键词" }).last();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(0);
  await expect(dialog).toContainText("FC2-TEST <img src=x onerror=alert(1)>");

  await dialog.locator(".layui-layer-btn0").click();
  await expect(page.locator(`#layui-layer${await page.evaluate(() => window.__titleLayerId)}`)).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => {
    const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
    return forage.getItem("filter_keyword_title");
  })).toEqual(["FC2-TEST <img src=x onerror=alert(1)>"]);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("FilterTitleKeywordPlugin"))).toBe(false);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "FilterTitleKeywordPlugin"))).toBe(true);
});
