import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const subtitleText = "1\n00:00:01,000 --> 00:00:02,000\n字幕 <b>literal text</b>\n";
const fixture = {};
for (const name of ["search", "detail"]) fixture[name] = (await readFile(new URL(`../../fixtures/integrations/subtitlecat/${name}.html`, import.meta.url), "utf8")).replaceAll("SSIS-001", "ABC-123").replaceAll("ssis-001", "abc-123");

async function boot(page, context, theme, upload = false) {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await fulfillHostFixtures(context);
    const html = await readFile(new URL("../fixtures/javdb-detail-interactions.html", import.meta.url), "utf8");
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: html }));
    await page.goto("https://javdb.com/v/test-id");
    await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true,
        settingOverrides: { themeMode: theme, enable115Match: upload ? "yes" : "no", enableLoadPreviewVideo: "no", enableLoadScreenShot: "no", enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadRelatedList: "no" },
        beforeUserscriptInjection: async host => {
            await host.addScriptTag({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });
            await host.evaluate(async ({ fixture, subtitleText }) => {
                const original = window.GM_xmlhttpRequest, bytes = new TextEncoder().encode(subtitleText).buffer;
                const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-1", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
                window.subtitleCalls = [];
                window.subtitleUploads = [];
                window.subtitleRemote = {};
                window.subtitleRejections = [];
                window.addEventListener("unhandledrejection", event => window.subtitleRejections.push(String(event.reason)));
                window.GM_xmlhttpRequest = options => {
                    const url = new URL(options.url);
                    if (!["api-shoulei-ssl.xunlei.com", "subtitle.example", "www.subtitlecat.com", "webapi.115.com", "115.com", "uplb.115.com", "bucket.oss-cn-shenzhen.aliyuncs.com"].includes(url.hostname)) return original(options);
                    window.subtitleCalls.push(url.href);
                    let aborted = false;
                    queueMicrotask(() => {
                        if (aborted) return;
                        let data;
                        if (url.hostname === "api-shoulei-ssl.xunlei.com") data = { data: [{ name: "ABC-123 中文字幕", ext: "srt", language: "zh", url: "https://subtitle.example/ABC-123.srt" }] };
                        else if (url.hostname === "subtitle.example" || url.pathname.endsWith(".srt")) data = bytes.slice(0);
                        else if (url.hostname === "www.subtitlecat.com") data = url.pathname === "/index.php" ? fixture.search : fixture.detail;
                        else if (url.hostname === "115.com") data = { uid: 1, sign: "fixture-sign" };
                        else if (url.pathname === "/files/search") data = { state: true, count: 2, data: [10, 20].map(id => ({ n: "ABC-123.mp4", fid: `video-${id}`, pid: String(id), pc: `pick-${id}` })) };
                        else if (url.pathname === "/files") {
                            const folder = url.searchParams.get("cid");
                            const files = window.subtitleRemote[folder] ? [window.subtitleRemote[folder]] : [];
                            data = { state: true, count: files.length, data: files };
                        } else if (url.hostname === "uplb.115.com") {
                            const folder = new URLSearchParams(options.data).get("target").slice(4);
                            data = { host: "https://bucket.oss-cn-shenzhen.aliyuncs.com/", object: `files/${folder}`, policy: "fixture-policy", accessid: "fixture-access", callback: "fixture-callback", signature: "fixture-signature" };
                        } else if (url.hostname === "bucket.oss-cn-shenzhen.aliyuncs.com") {
                            const folder = options.data.get("key").split("/").pop(), name = options.data.get("name");
                            window.subtitleUploads.push({ folder, name });
                            window.subtitleRemote[folder] = { fid: `sub-${folder}`, n: name, s: bytes.byteLength, sha };
                            if (folder === "20") return options.onerror?.({ error: "response lost after server accepted file" });
                            data = { state: true, file_id: `sub-${folder}` };
                        } else data = { state: true, data: [] };
                        options.onload?.({ status: 200, response: data, responseText: typeof data === "string" ? data : "", finalUrl: url.href, responseHeaders: `content-type: ${data instanceof ArrayBuffer ? "application/octet-stream" : typeof data === "string" ? "text/html" : "application/json"}` });
                    });
                    return { abort() { aborted = true; options.onabort?.(); } };
                };
            }, { fixture, subtitleText });
        },
    });
    await page.evaluate(() => {
        const owner = window.unsafeWindow.pluginManager.getBean("DetailPageButtonPlugin");
        const open = owner.openSubtitles;
        owner.openSubtitles = async (...args) => { try { return await open(...args); } catch (error) { console.error("SUBTITLE_WORKSPACE_ERROR", error.stack); throw error; } };
    });
    await page.locator("#xunLeiSubtitleBtn").click();
    const workspace = page.locator(".jhs-subtitles").first();
    await expect(workspace.locator(".jhs-subtitles__row")).toHaveCount(4);
    return { workspace, errors };
}

for (const theme of ["light", "dark"]) test(`unified subtitle search filters preview and original-byte download ${theme}`, async ({ page, context }, info) => {
    const { workspace, errors } = await boot(page, context, theme);
    await workspace.getByRole("button", { name: "SubtitleCat", exact: true }).click();
    await expect(workspace.locator(".jhs-subtitles__row:visible")).toHaveCount(3);
    await workspace.getByLabel("语言筛选").fill("en");
    await expect(workspace.locator(".jhs-subtitles__row:visible")).toHaveCount(1);
    await workspace.getByLabel("语言筛选").fill("");
    await workspace.getByRole("button", { name: "迅雷", exact: true }).click();
    const row = workspace.locator(".jhs-subtitles__row:visible").first();
    await row.getByRole("button", { name: "预览", exact: true }).click();
    await expect(workspace.getByLabel("字幕预览")).toContainText("字幕 <b>literal text</b>");
    await expect(workspace.getByLabel("字幕预览").locator("b")).toHaveCount(0);
    await workspace.getByRole("button", { name: "收起预览" }).click();
    await expect(row.getByRole("button", { name: "预览", exact: true })).toBeFocused();
    await row.getByRole("button", { name: "预览", exact: true }).click();
    const pending = page.waitForEvent("download");
    await row.getByRole("button", { name: "下载", exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("ABC-123.zh.srt");
    const stream = await download.createReadStream(), chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString("utf8")).toBe(subtitleText);
    expect(await page.evaluate(() => window.subtitleCalls.filter(url => url === "https://subtitle.example/ABC-123.srt").length)).toBe(1);
    await workspace.screenshot({ path: info.outputPath(`subtitle-workspace-${theme}.png`) });
    await page.keyboard.press("Escape");
    await expect(workspace).toHaveCount(0);
    await expect(page.locator("#xunLeiSubtitleBtn")).toBeFocused();
    expect(await page.evaluate(() => window.subtitleRejections)).toEqual([]);
    expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) test(`115 subtitle upload previews both directories, preserves uncertain results and reconciles without replay ${theme}`, async ({ page, context }, info) => {
    const { workspace, errors } = await boot(page, context, theme, true);
    await workspace.getByRole("button", { name: "迅雷", exact: true }).click();
    await workspace.locator(".jhs-subtitles__row:visible").getByRole("button", { name: "上传至 115" }).click();
    const dialog = page.getByRole("dialog", { name: "字幕上传 ABC-123" });
    await expect(dialog.getByRole("checkbox")).toHaveCount(2);
    for (const checkbox of await dialog.getByRole("checkbox").all()) await checkbox.check();
    await dialog.getByRole("button", { name: "预览上传范围" }).click();
    await expect(dialog).toContainText("目录 10 · ABC-123.mp4 → ABC-123.zh.srt");
    await expect(dialog).toContainText("目录 20 · ABC-123.mp4 → ABC-123.zh.srt");
    await dialog.getByRole("button", { name: "确认上传至所选目录" }).click();
    await expect(dialog).toContainText("已核实上传完成");
    await expect(dialog).toContainText("上传结果不明");
    await expect(dialog).toContainText("本次提交已结算");
    expect(await page.evaluate(() => window.subtitleUploads)).toHaveLength(2);
    await dialog.getByRole("button", { name: "核对待确认记录" }).click();
    await expect(dialog).toContainText("待确认记录核对完成");
    expect(await page.evaluate(() => window.subtitleUploads)).toHaveLength(2);
    await dialog.screenshot({ path: info.outputPath("subtitle-upload.png") });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(workspace.getByRole("button", { name: "上传至 115" }).first()).toBeFocused();
    await workspace.getByRole("button", { name: "上传记录", exact: true }).click();
    const records = page.getByRole("dialog", { name: "字幕上传记录 ABC-123" });
    await expect(records).toContainText("当前账号上传记录已读取");
    await expect(records).toContainText("已核实上传完成");
    expect(await page.evaluate(() => window.subtitleUploads)).toHaveLength(2);
    await page.keyboard.press("Escape");
    await expect(workspace.getByRole("button", { name: "上传记录", exact: true })).toBeFocused();
    expect(errors).toEqual([]);
});
