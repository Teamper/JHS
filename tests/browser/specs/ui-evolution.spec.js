import { clickSettingsCategory } from "../harness/settings-navigation.js";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const groups = ["appearance", "browse", "filtering", "tasks", "resources", "cloud", "data", "advanced"];
async function boot(page, context, theme = "light", detail = false) {
  await page.clock.setFixedTime(new Date("2026-10-04T08:00:00Z"));
  await fulfillHostFixtures(context);
  await page.goto(detail ? "https://javdb.com/v/test-id" : "https://javdb.com/");
  await injectUserscriptRuntime(page, { hostStyles: true, realFeedback: true, settingOverrides: {
    themeMode: theme, defaultQuickFilterTab: "all", enableClog: "no", enableLoadReview: "no", enableLoadPreviewVideo: "no", enableLoadOtherSite: "no"
  } });
}
async function openSettings(page, panel) {
  await page.evaluate(panel => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog(panel), panel);
  const dialog = page.locator(".layui-layer").last();
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  return dialog;
}

test("eight settings categories retain drafts, enhance all selects and save across categories", async ({ page, context }) => {
  await boot(page, context);
  const dialog = await openSettings(page);
  await expect(dialog.locator(".side-menu-item")).toHaveCount(8);
  await expect(dialog.locator("#appearance-panel")).toBeVisible();
  await dialog.locator("#highlightedTagNumber").fill("3");
  await dialog.locator("#highlightedTagNumber").dispatchEvent("change");
  await clickSettingsCategory(dialog.locator('[data-panel="advanced-panel"]'));
  await dialog.locator("#httpTimeout").fill("7000");
  await dialog.locator("#httpTimeout").dispatchEvent("change");
  for (const group of groups) {
    await clickSettingsCategory(dialog.locator(`[data-panel="${group}-panel"]`));
    await expect(dialog.locator(`#${group}-panel`)).toBeVisible();
    await expect(dialog.locator("#saveBtn")).toBeInViewport();
    await expect(dialog.locator(".jhs-btn--primary:visible,.jhs-btn--accent:visible")).toHaveCount(1);
    const controls = await dialog.locator(`#${group}-panel`).evaluate(root => ({
      width: root.clientWidth, scroll: root.scrollWidth,
      unenhanced: [...root.querySelectorAll("select")].filter(select => !select.closest(".jhs-select-control")).map(select => select.id)
    }));
    expect(controls.scroll, group).toBeLessThanOrEqual(controls.width + 1);
    expect(controls.unenhanced, group).toEqual([]);
  }
  await clickSettingsCategory(dialog.locator('[data-panel="appearance-panel"]'));
  await expect(dialog.locator("#highlightedTagNumber")).toHaveValue("3");
  await dialog.locator("#saveBtn").click();
  await expect.poll(() => page.evaluate(() => {
    const values = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot();
    return [values.highlightedTagNumber, values.httpTimeout];
  })).toEqual(["3", 7000]);
});

test("legacy settings entry points locate their group and keyboard navigation keeps the footer reachable", async ({ page, context }) => {
  await boot(page, context);
  for (const [legacy, group] of [["task-panel", "tasks"], ["network-panel", "advanced"], ["cloud-services-panel", "cloud"], ["snapshot-panel", "data"]]) {
    const dialog = await openSettings(page, legacy);
    await expect(dialog.locator(`#${group}-panel`)).toBeVisible();
    await expect(dialog.locator(`#${legacy}`)).toBeInViewport();
    await expect(dialog.locator("#saveBtn")).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  const dialog = await openSettings(page);
  const first = dialog.locator('[data-panel="appearance-panel"]');
  if (!await first.isVisible()) {
    const category = dialog.locator("#jhs-settings-category").locator("..").getByRole("combobox");
    await category.click(); await page.keyboard.press("End"); await page.keyboard.press("Enter");
    await expect(dialog.locator("#advanced-panel")).toBeVisible(); return;
  }
  await first.focus();
  await page.keyboard.press("End");
  await expect(dialog.locator('[data-panel="advanced-panel"]')).toBeFocused();
  await page.keyboard.press("Home");
  await expect(first).toBeFocused();
});

test("real Toastify and Viewer use semantic icons, neutral close controls and caller duration", async ({ page, context }) => {
  await boot(page, context, "dark");
  await page.evaluate(() => {
    window.show.ok("已保存", { duration: -1 });
    window.show.info("暂无记录", { duration: -1 });
    window.show.error("导入失败，请检查文件格式", { duration: -1 });
  });
  await expect(page.locator(".toastify.jhs-toast")).toHaveCount(3);
  const toastWidths = await page.locator(".toastify.jhs-toast").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  for (const width of toastWidths) expect(width).toBeLessThan(360);
  await expect(page.locator(".jhs-toast__content > svg[data-jhs-icon]")).toHaveCount(3);
  await expect(page.locator(".jhs-toast--error .toast-close")).toBeVisible();
  await page.locator(".jhs-toast--error .toast-close").click();
  await expect(page.locator(".jhs-toast--error")).toHaveCount(0);
  await page.evaluate(() => window.showImageViewer("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='600' height='400' fill='%2363768c'/%3E%3C/svg%3E"));
  await expect(page.locator(".viewer-container.viewer-in")).toBeVisible();
  await expect(page.locator(".jhs-image-viewer-close")).toHaveCSS("background-color", "rgba(20, 24, 29, 0.72)");
  await page.keyboard.press("Escape");
  await expect(page.locator(".viewer-container")).toHaveCount(0);
});

test("history empty text and pagination stay readable and reachable with host styles", async ({ page, context }) => {
  await boot(page, context);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("HistoryPlugin").openHistory());
  const table = page.locator(".jhs-history-dialog .tabulator");
  await expect(table).toBeVisible();
  const empty = table.locator(".tabulator-placeholder-contents");
  await expect(empty).toHaveCSS("color", "rgb(91, 107, 124)");
  for (const button of await table.locator(".tabulator-page").all()) { await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport(); }
  const size = await table.evaluate(root => ({ width: root.clientWidth, scroll: root.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
});

test("named confirmations cancel on Escape and run the action only from its explicit button", async ({ page, context }) => {
  await boot(page, context);
  await page.evaluate(() => { window.__confirmProbe = { accepted: 0, canceled: 0 }; });
  const open = () => page.evaluate(() => window.utils.q(null, "移除记录？", () => window.__confirmProbe.accepted++, () => window.__confirmProbe.canceled++, { confirmText: "移除" }));
  await open();
  const buttons = page.locator(".layui-layer-btn").last();
  await expect(buttons.locator("button")).toHaveText(["取消", "移除"]);
  await page.keyboard.press("Escape");
  await expect(buttons).toHaveCount(0);
  expect(await page.evaluate(() => window.__confirmProbe)).toEqual({ accepted: 0, canceled: 1 });
  await open();
  await page.locator(".layui-layer-btn").last().getByText("取消", { exact: true }).click();
  expect(await page.evaluate(() => window.__confirmProbe)).toEqual({ accepted: 0, canceled: 2 });
  await open();
  await page.locator(".layui-layer-btn").last().getByText("移除", { exact: true }).click();
  expect(await page.evaluate(() => window.__confirmProbe)).toEqual({ accepted: 1, canceled: 2 });
});

const visualEnabled = process.env.JHS_VISUAL_REGRESSION === "1";
for (const theme of ["light", "dark"]) for (const scene of ["settings", "tasks", "list", "detail", "history", "new-video", "feedback"]) {
  test(`representative ${scene} ${theme} with host styles and real feedback`, async ({ page, context }, info) => {
    test.skip(!visualEnabled || !["desktop-wide", "mobile"].includes(info.project.name), "representative visual regression is opt-in and platform specific");
    await boot(page, context, theme, scene === "detail");
    if (scene === "settings" || scene === "tasks") await openSettings(page, scene === "tasks" ? "task-panel" : undefined);
    if (scene === "history") await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("HistoryPlugin").openHistory());
    if (scene === "new-video") await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("NewVideoPlugin").openDialog());
    if (scene === "feedback") await page.evaluate(() => {
      window.show.ok("已保存", { duration: -1, gravity: "top" });
      window.show.info("暂无记录", { duration: -1, gravity: "center" });
      window.show.error("导入失败，请检查文件格式", { duration: -1, gravity: "bottom" });
    });
    await assertNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot(`representative-${scene}-${theme}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
