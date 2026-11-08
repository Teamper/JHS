import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const fixture = JSON.parse(await readFile(new URL("../../fixtures/integrations/one115/mixed-matches.json", import.meta.url), "utf8"));
const candidates = fixture.data.filter(item => /\.(mp4|mkv)$/i.test(item.n)).map(item => ({ name: item.n, fileId: item.fid }));

async function boot(page, context, route, names = candidates, realLayer = false) {
    await fulfillHostFixtures(context);
    // Keep the real HostAdapter parsing paths, with the issue's movie identity in the fixture DOM.
    await page.goto(route === "detail" ? "https://javdb.com/v/test-id" : "https://javdb.com/");
    await page.evaluate(route => {
        const node = document.querySelector(route === "detail" ? ".movie-panel-info .first-block .value" : ".video-title strong");
        if (!node) throw new Error("Missing fixture movie identity");
        node.textContent = "START-657";
        if (route === "detail") {
            const copiedIdentity = document.querySelector('.column-video-info [data-clipboard-text]');
            copiedIdentity.setAttribute("data-clipboard-text", "START-657");
            copiedIdentity.textContent = "START-657";
            document.querySelector(".column-video-info h1").textContent = "START-657 Browser Fixture";
            const panel = document.createElement("div");
            panel.className = "panel-block";
            panel.innerHTML = '<strong>番号:</strong><span class="value">START-657</span>';
            document.querySelector(".column-video-info").append(panel);
        }
    }, route);
    await injectUserscriptRuntime(page, { beforeUserscriptInjection: realLayer ? host => host.addScriptTag({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) }) : undefined, settingOverrides: { enable115Match: false, enableLoadReview: "no", enableLoadRelated: "no", enableLoadPreviewVideo: "no", defaultQuickFilterTab: "all" } });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.waitForFunction(() => Boolean(window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin")));
    await page.evaluate(async names => {
        const controller = window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin");
        window.matchCalls = 0;
        const offline = controller.getRuntimeService("offline");
        offline.getAccountIdentity = async () => ({ accountId: "fixture-account" });
        offline.searchFilePage = async () => { window.matchCalls++; return { items: names, hasMore: false, nextOffset: names.length }; };
        offline.getPlayUrl = (_provider, match) => `https://115.com/?fixture=${match.fileId}`;
        await controller.getRuntimeService("settings").set("enable115Match", true);
    }, names);
}

for (const theme of ["light", "dark"]) {
    test(`115 exact detail matching excludes neighbours (${theme})`, async ({ page, context }, info) => {
        await boot(page, context, "detail");
        await page.evaluate(theme => window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin").getRuntimeService("settings").set("themeMode", theme), theme);
        const block = page.locator(".jhs-115-match");
        await expect(block.locator(".jhs-115-match-row")).toHaveCount(2);
        await expect(block.locator("a")).toHaveText(["start_657-C.mp4（0 B）", "START657-CD2.mkv（0 B）"]);
        await expect(block.locator(".jhs-115-rename")).toHaveCount(2);
        await expect(block).not.toContainText("START-651");
        expect(await block.locator("a").evaluateAll(nodes => nodes.map(node => node.href))).toEqual(["https://115.com/?fixture=correct-c", "https://115.com/?fixture=correct-cd2"]);
        await block.screenshot({ path: info.outputPath(`115-detail-${theme}.png`) });
    });
}

test("115 list count and dialog contain only the exact movie", async ({ page, context }) => {
    await boot(page, context, "list");
    const badge = page.locator(".jhs-115-list-match");
    await expect(badge).toHaveText("匹配2个");
    await badge.click();
    const links = page.locator('.layui-layer a[href^="https://115.com/?fixture="]');
    await expect(links).toHaveText(["start_657-C.mp4", "START657-CD2.mkv"]);
    expect(page.url()).toBe("https://javdb.com/");
});

test("115 empty filtered list retries without navigating", async ({ page, context }) => {
    await boot(page, context, "list", candidates.slice(0, 5));
    const badge = page.locator(".jhs-115-list-match");
    await expect(badge).toHaveText("未匹配");
    await badge.click();
    await expect.poll(() => page.evaluate(() => window.matchCalls)).toBe(4);
    await expect(badge).toHaveText("未匹配");
    expect(page.url()).toBe("https://javdb.com/");
});

for (const theme of ["light", "dark"]) test(`115 batch rename requires preview and an explicit selection, retaining disc and quality suffixes ${theme}`, async ({ page, context }, info) => {
    await boot(page, context, "detail", [{ name: "start00657-3-4K-C.mp4", fileId: "rename-one" }, { name: "START657-CD2.mkv", fileId: "rename-two" }], true);
    await page.evaluate(theme => window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin").getRuntimeService("settings").set("themeMode", theme), theme);
    await expect(page.locator(".jhs-115-match-row")).toHaveCount(2);
    await page.evaluate(() => {
        window.renameCalls = [];
        const owner = window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin");
        owner.offline.renameFile = async (provider, fileId, name, options) => { window.renameCalls.push({ provider, fileId, name, accountId: options.expectedAccountId }); return { success: true }; };
    });
    const trigger = page.getByRole("button", { name: "预览与批量重命名" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "START-657 115 重命名预览" });
    await expect(dialog).toContainText("→ START-657-3-4K-C.mp4");
    await expect(dialog).toContainText("→ START-657-CD2.mkv");
    await dialog.getByRole("button", { name: "确认重命名所选文件" }).click();
    await expect(dialog).toContainText("请勾选");
    expect(await page.evaluate(() => window.renameCalls)).toEqual([]);
    await dialog.getByRole("checkbox").first().check();
    await dialog.getByRole("button", { name: "确认重命名所选文件" }).click();
    await expect(dialog).toContainText("成功 1 · 失败 0 · 未开始 0");
    expect(await page.evaluate(() => window.renameCalls)).toEqual([{ provider: "one115", fileId: "rename-one", name: "START-657-3-4K-C.mp4", accountId: "fixture-account" }]);
    await dialog.screenshot({ path: info.outputPath("rename-preview.png") });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
});

test("115 incomplete matching exposes continuation and retains earlier matches", async ({ page, context }) => {
    await boot(page, context, "detail");
    await page.evaluate(async () => {
        const owner = window.unsafeWindow.pluginManager.getBean("OneOneFiveMatchPlugin");
        const first = { name: "START-657-C.mp4", fileId: "one", videoId: "pick-one", size: 1024, accountId: "1" };
        const second = { ...first, name: "START-657-CD2.mkv", fileId: "two", videoId: "pick-two" };
        owner.match.matchMovie = async (_movie, options) => ({ matches: options.continuation ? [first, second] : [first], complete: Boolean(options.continuation), continuation: options.continuation ? null : { offset: 1000 } });
        await owner.configureMatching();
    });
    await expect(page.locator(".jhs-115-match-row")).toHaveCount(1);
    await page.getByRole("button", { name: "结果未完整 · 继续加载" }).click();
    await expect(page.locator(".jhs-115-match-row")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "结果未完整 · 继续加载" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "预览与批量重命名" })).toBeFocused();
});
