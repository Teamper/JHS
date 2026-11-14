import { clickSettingsCategory } from "../harness/settings-navigation.js";
import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and touch confirmation lifecycle coverage"));

async function boot(page, context) {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    settingOverrides: { reviewCount: "20", enableLoadOtherSite: "no", themeMode: "light" },
    beforeUserscriptInjection: injectRealLayer,
  });
}

test("injected confirmation service cancels once on Escape, close and cancel, and accepts only the named action", async ({ page, context }) => {
  await boot(page, context);
  await page.evaluate(() => {
    const trigger = document.createElement("button"); trigger.id = "confirm-probe-trigger"; trigger.textContent = "打开确认"; document.body.append(trigger); trigger.focus();
    window.__confirmProbe = { accepted: 0, canceled: 0, serviceCalls: 0 };
    const service = window.utils.dialogService, original = service.confirm.bind(service);
    service.confirm = (...args) => { window.__confirmProbe.serviceCalls++; return original(...args); };
    window.__openConfirm = () => window.utils.q(null, "授权此地址？", () => window.__confirmProbe.accepted++, () => window.__confirmProbe.canceled++, { confirmText: "授权", cancelText: "取消" });
  });
  for (const [index, close] of ["escape", "close", "cancel"].entries()) {
    await page.evaluate(() => window.__openConfirm());
    const confirmation = page.locator(".layui-layer-dialog");
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toHaveClass(/jhs-confirm-actions/);
    await expect(confirmation.locator(".layui-layer-btn a")).toHaveText(["取消", "授权"]);
    await expect(confirmation.locator(".layui-layer-btn0")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(confirmation.locator(".layui-layer-btn0")).toHaveCSS("color", "rgb(31, 39, 51)");
    await expect(confirmation.locator(".layui-layer-btn1")).toHaveCSS("background-color", "rgb(59, 110, 165)");
    await expect(confirmation.locator(".layui-layer-btn1")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(confirmation.locator(".layui-layer-btn0")).toBeFocused();
    await confirmation.locator(".layui-layer-btn1").focus();
    await page.keyboard.press("Tab");
    expect(await confirmation.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await confirmation.locator(".layui-layer-btn0").focus();
    if (close === "escape") await page.keyboard.press("Escape");
    else if (close === "close") await confirmation.locator(".layui-layer-close").click();
    else await page.keyboard.press("Space");
    await expect(confirmation).toHaveCount(0);
    await expect(page.locator("#confirm-probe-trigger")).toBeFocused();
    expect(await page.evaluate(() => window.__confirmProbe)).toEqual({ accepted: 0, canceled: index + 1, serviceCalls: index + 1 });
  }
  await page.evaluate(() => window.__openConfirm());
  await page.locator(".layui-layer-dialog .layui-layer-btn1").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".layui-layer-dialog")).toHaveCount(0);
  await expect(page.locator("#confirm-probe-trigger")).toBeFocused();
  expect(await page.evaluate(() => window.__confirmProbe)).toEqual({ accepted: 1, canceled: 3, serviceCalls: 4 });
  expect(await page.evaluate(() => window.utils.layerIndexStack)).toEqual([]);
});

test("Escape ends the WebDAV authorization save without persisting the profile, password, ordinary draft or origin", async ({ page, context }) => {
  await boot(page, context);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  const settings = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
  await expect(settings.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await clickSettingsCategory(settings.locator('[data-panel="browse-panel"]'));
  await settings.locator("#reviewCount").selectOption("40", { force: true });
  await clickSettingsCategory(settings.locator('[data-panel="data-panel"]'));
  await settings.locator("#webDavUrl").fill("https://authorization.example.test/dav");
  await settings.locator("#webDavUsername").fill("synthetic-user");
  await settings.locator("#webDavPassword").fill("synthetic-password");
  await settings.locator("#saveBtn").click();
  const confirmation = page.locator(".layui-layer-dialog");
  await expect(confirmation).toContainText("authorization.example.test");
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(settings).toBeVisible();
  await expect(settings.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
  await expect(settings.locator("#webDavPassword")).toHaveValue("synthetic-password");
  expect(await page.evaluate(async () => {
    const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin"), snapshot = plugin.getRuntimeService("settings").snapshot();
    return { profile: await plugin.getRuntimeService("webdav").getProfile(), reviewCount: snapshot.reviewCount, origins: snapshot.trustedLocalOrigins ?? [] };
  })).toEqual({ profile: { url: "", username: "", password: "" }, reviewCount: "20", origins: [] });
});

test("danger confirmation uses Cancel-left / Confirm-right order and danger token colors", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project verifies danger confirmation styling");
  await boot(page, context);
  await page.evaluate(() => {
    window.utils.q(null, "确认屏蔽此条目？", () => {}, () => {}, { confirmText: "屏蔽", cancelText: "取消", tone: "danger" });
  });
  const confirmation = page.locator(".layui-layer-dialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveClass(/jhs-confirm-actions/);
  await expect(confirmation).toHaveClass(/jhs-confirm-actions--danger/);
  await expect(confirmation.locator(".layui-layer-btn a")).toHaveText(["取消", "屏蔽"]);
  await expect(confirmation.locator(".layui-layer-btn1")).toHaveCSS("background-color", "rgb(192, 43, 43)");
  await expect(confirmation.locator(".layui-layer-btn1")).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
});
