import { openUtility } from "../harness/enhancement-navigation.js";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

async function boot(page, context, theme, site = "javdb", list = false) {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await fulfillHostFixtures(context);
    if (site === "javdb") {
        const html = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
        await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: html }));
    }
    await page.goto(site === "javdb" ? list ? "https://javdb.com/" : "https://javdb.com/v/test-id" : "https://www.javbus.com/ABC-123");
    await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true,
        settingOverrides: { themeMode: theme, defaultQuickFilterTab: "all", translateTitle: "no", enableLoadPreviewVideo: "no", enableLoadScreenShot: "no", enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadRelatedList: "no" },
        beforeUserscriptInjection: async host => {
            await host.addScriptTag({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });
            await host.evaluate(() => {
                window.mediaRequests = [];
                window.mediaItems = [{ Id: "movie-a", Name: "本地译名", OriginalTitle: "ABC-123 原标题", Path: "/NAS01/JAV2023/ABC123.mp4", ProviderIds: { Imdb: "tt1234567", Javdb: "opaque-id" } }];
                const previous = window.GM_xmlhttpRequest;
                window.GM_xmlhttpRequest = options => {
                    const url = new URL(String(options.url));
                    if (url.hostname !== "media.example") return previous(options);
                    window.mediaRequests.push({ url: url.href, headers: options.headers, redirect: options.redirect });
                    let aborted = false;
                    queueMicrotask(() => {
                        if (aborted) return;
                        const data = url.pathname.endsWith("System/Info/Public") ? { Id: "server-a", ServerName: "家庭媒体库" } : { Items: window.mediaItems, TotalRecordCount: window.mediaItems.length };
                        options.onload({ status: 200, response: data, responseText: JSON.stringify(data), finalUrl: url.href, responseHeaders: "content-type: application/json" });
                    });
                    return { abort() { aborted = true; options.onabort?.(); } };
                };
            });
        },
    });
    return errors;
}

async function utility(page, name) { return openUtility(page, name); }

for (const theme of ["light", "dark"]) test(`media connections save encrypted credentials, show status and choose versions ${theme}`, async ({ page, context }, info) => {
    const errors = await boot(page, context, theme);
    await (await utility(page, "媒体库")).click();
    const panel = page.locator(".jhs-media-connections").first();
    await panel.getByRole("button", { name: "添加服务器", exact: true }).click();
    const row = panel.locator("fieldset");
    await row.getByLabel("名称", { exact: true }).fill("家庭媒体库");
    await row.getByLabel("服务器地址（含代理子路径）", { exact: true }).fill("https://media.example/reverse/proxy/");
    await row.getByLabel("API Key", { exact: true }).fill("fixture-key");
    await row.getByLabel("用户 ID 范围（可选）", { exact: true }).fill("user-a");
    await row.getByRole("switch", { name: "启用此服务器", exact: true }).check();
    await panel.getByRole("switch", { name: "启用媒体库联动", exact: true }).check();
    await row.getByRole("button", { name: "测试连接", exact: true }).click();
    await expect(row).toContainText("连接成功 · 家庭媒体库");
    await panel.getByRole("button", { name: "保存连接与启用状态", exact: true }).click();
    await expect(panel.getByRole("status").last()).toHaveText("已保存");
    const encrypted = await page.evaluate(() => window.GM_getValue("jhs_media_connections_v1"));
    expect(encrypted).toMatchObject({ schema: 2 });
    expect(JSON.stringify(encrypted)).not.toContain("fixture-key");
    await panel.screenshot({ path: info.outputPath(`media-connections-${theme}.png`) });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    const badge = page.locator(".jhs-media-badge").first();
    await expect(badge).toContainText("已入库");
    await badge.getByRole("button", { name: "媒体库详情 / 播放", exact: true }).click();
    const link = page.locator('.jhs-media-details a');
    await expect(link).toHaveAttribute("href", "https://media.example/reverse/proxy/web/#/details?id=movie-a&serverId=server-a");
    expect(await link.getAttribute("href")).not.toContain("fixture-key");
    await page.keyboard.press("Escape");
    await expect(link).toHaveCount(0);
    await page.evaluate(() => { window.mediaItems = []; });
    await badge.getByRole("button", { name: "刷新媒体库", exact: true }).focus();
    await badge.getByRole("button", { name: "刷新媒体库", exact: true }).click();
    await expect(page.locator(".jhs-media-badge").first()).toContainText("未入库");
    await expect(page.locator(".jhs-media-badge").first().getByRole("button", { name: "刷新媒体库", exact: true })).toBeFocused();
    const requests = await page.evaluate(() => window.mediaRequests);
    expect(requests.length).toBeGreaterThanOrEqual(6);
    expect(requests.every(request => request.url.startsWith("https://media.example/reverse/proxy/") && !request.url.includes("fixture-key") && request.headers.Authorization === 'MediaBrowser Token="fixture-key"' && request.redirect === "error")).toBe(true);
    await (await utility(page, "隐私遮罩")).click();
    await page.locator(".jhs-media-badge").first().getByRole("button", { name: "刷新媒体库", exact: true }).click();
    await expect(page.locator(".jhs-media-badge").first()).toContainText("未入库");
    expect(errors).toEqual([]);
});

for (const site of ["javdb", "javbus"]) for (const theme of ["light", "dark"]) test(`privacy masks ${site} native content, restores held reveal and preserves controls ${theme}`, async ({ page, context }, info) => {
    const errors = await boot(page, context, theme, site);
    const toggle = await utility(page, "隐私遮罩");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-jhs-privacy-active", "");
    await page.evaluate(() => {
        const root = document.createElement("div"), image = document.createElement("img");
        root.className = "screen-container";
        root.dataset.fixturePrivacySheet = "";
        image.width = 16;
        image.height = 16;
        image.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="gray"/></svg>';
        root.append(image);
        document.body.append(root);
    });
    await expect(page.locator("[data-fixture-privacy-sheet] img")).toHaveCSS("visibility", "hidden");
    await expect.poll(() => page.locator("[data-jhs-privacy-text]").count()).toBeGreaterThan(0);
    if (site === "javdb") for (const name of await page.locator(".magnet-name .name").all()) {
        expect(await name.locator("[data-jhs-privacy-text]").count()).toBeGreaterThan(0);
        const exposed = await name.evaluate(node => {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), result = [];
            while (walker.nextNode()) if (walker.currentNode.textContent.trim() && !walker.currentNode.parentElement.closest("[data-jhs-privacy-text]")) result.push(walker.currentNode.textContent);
            return result;
        });
        expect(exposed).toEqual([]);
    }
    const reveal = await utility(page, "按住临时查看");
    await reveal.scrollIntoViewIfNeeded();
    const rect = await reveal.boundingBox();
    if (info.project.use.hasTouch) {
        const input = await context.newCDPSession(page);
        await input.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }] });
        await expect(page.locator("html")).not.toHaveAttribute("data-jhs-privacy-active", "");
        await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await input.detach();
    } else {
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.mouse.down();
        await expect(page.locator("html")).not.toHaveAttribute("data-jhs-privacy-active", "");
        await page.mouse.up();
    }
    await expect(page.locator("html")).toHaveAttribute("data-jhs-privacy-active", "");
    await reveal.focus();
    await page.keyboard.down("Space");
    await expect(page.locator("html")).not.toHaveAttribute("data-jhs-privacy-active", "");
    await page.keyboard.up("Space");
    await expect(page.locator("html")).toHaveAttribute("data-jhs-privacy-active", "");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.locator("html")).toHaveAttribute("data-jhs-privacy-active", "");
    await page.screenshot({ path: info.outputPath(`privacy-${site}-${theme}.png`) });
    await (await utility(page, "遮罩偏好")).click();
    const preferences = page.locator(".jhs-privacy-config");
    await expect(preferences.getByRole("button", { name: "保存遮罩偏好" })).toBeVisible();
    if (site === "javbus") expect(await page.locator(".info p [data-jhs-privacy-text]").count()).toBeGreaterThan(0);
    await preferences.screenshot({ path: info.outputPath(`privacy-preferences-${site}-${theme}.png`) });
    await preferences.getByRole("button", { name: "保存遮罩偏好" }).click();
    await expect(preferences).toHaveCount(0);
    await expect(page.locator("#xunLeiSubtitleBtn")).toBeEnabled();
    await (await utility(page, "关闭隐私遮罩")).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-jhs-privacy-active", "");
    await expect(page.locator("[data-fixture-privacy-sheet] img")).toHaveCSS("visibility", "visible");
    expect(await page.evaluate(() => window.GM_getValue("jhs_privacy_enabled_v1"))).toBe(false);
    expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) test(`media list schedules visible cards and filters independently while privacy preserves parsing ${theme}`, async ({ page, context }, info) => {
    const errors = await boot(page, context, theme, "javdb", true);
    const overlaps = await page.locator("#jhs-page-commandbar").evaluateAll(bars => bars.flatMap(bar => {
        const controls = [...bar.querySelectorAll("button")].filter(button => button.checkVisibility());
        return controls.flatMap((button, index) => controls.slice(index + 1).filter(other => {
            const left = button.getBoundingClientRect(), right = other.getBoundingClientRect();
            return Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
        }).map(other => [button.textContent.trim(), other.textContent.trim()]));
    }));
    expect(overlaps).toEqual([]);
    await page.evaluate(async () => {
        await window.credentialService.set("jhs_media_connections_v1", JSON.stringify([{ id: "home", name: "家庭媒体库", type: "jellyfin", address: "https://media.example/reverse/proxy/", apiKey: "fixture-key", userId: "", enabled: true }]));
        await window.settingsService.set("enableMediaLibrary", true);
    });
    const first = page.locator("[data-jhs-primary-list] > .item").first();
    await expect(first.locator(".jhs-media-badge")).toContainText("已入库");
    const flags = await first.getAttribute("data-jhs-flags");
    await page.evaluate(() => {
        const list = document.querySelector("[data-jhs-primary-list]"), first = list.querySelector(".item");
        const spacer = document.createElement("div");
        spacer.style.height = "1600px";
        spacer.style.gridColumn = "1/-1";
        const card = first.cloneNode(true);
        card.querySelector(".jhs-media-badge").remove();
        card.className = "item";
        for (const attribute of card.getAttributeNames()) if (attribute.startsWith("data-jhs-")) card.removeAttribute(attribute);
        card.querySelector("strong").textContent = "ABC-124";
        card.querySelector("a").href = "/v/abc-124";
        card.querySelector("a").title = "相邻影片";
        card.setAttribute("data-fixture-next", "");
        list.append(spacer, card);
    });
    const next = page.locator("[data-fixture-next]");
    await expect(next.locator(".jhs-media-badge")).toContainText("结果未知");
    await next.scrollIntoViewIfNeeded();
    await expect(next.locator(".jhs-media-badge")).toContainText("未入库");
    await page.evaluate(() => window.scrollTo(0,0));
    if (await page.locator("#jhs-fab").isVisible()) {
        await page.locator("#jhs-fab").click();
        await page.locator('#jhs-fab-menu [data-action="quickFilter"]').click();
    } else await page.getByRole("button", {name:"更多筛选", exact:true}).click();
    const filters = page.getByRole("group", { name: "媒体库筛选", exact: true });
    await filters.getByRole("button", { name: "已入库", exact: true }).click();
    await expect(next).toBeHidden();
    await expect(first).toBeVisible();
    expect(await first.getAttribute("data-jhs-flags")).toBe(flags);
    await filters.getByRole("button", { name: "全部", exact: true }).click();
    await page.keyboard.press("Escape");
    await (await utility(page, "隐私遮罩")).click();
    await page.keyboard.press("Escape");
    await expect(first.locator(".video-title strong [data-jhs-privacy-text]")).toHaveCount(1);
    await first.screenshot({ path: info.outputPath(`media-list-private-${theme}.png`) });
    await first.locator(".jhs-media-badge").getByRole("button", { name: "刷新媒体库", exact: true }).click();
    await expect(first.locator(".jhs-media-badge")).toContainText("已入库");
    expect(errors).toEqual([]);
});
