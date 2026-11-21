import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "../../tests/browser/node_modules/playwright/index.mjs";

const assets = {
    "/": ["index.html", "text/html"], "/app.css": ["app.css", "text/css"], "/product.css": ["product.css", "text/css"],
    "/main.js": ["main.js", "text/javascript"], "/trailer.mp4": ["trailer.mp4", "video/mp4"],
};
const server = createServer(async (request, response) => {
    const asset = assets[new URL(request.url, "http://localhost").pathname];
    if (!asset) return response.writeHead(404).end();
    const [file, contentType] = asset;
    response.writeHead(200, { "Content-Type": contentType }).end(await readFile(new URL(`www/${file}`, import.meta.url)));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.JHS_CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
    const context = await browser.newContext({ viewport: { width: 393, height: 830 }, isMobile: true, hasTouch: true, colorScheme: "light" });
    const page = await context.newPage();
    const errors = [], outgoing = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", route => {
        if (route.request().url().startsWith(address + "/")) return route.continue();
        outgoing.push(route.request().url());
        return route.abort();
    });
    const main = page.locator("#main");
    const tab = name => page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name });
    const press = (name, target = main) => target.getByRole("button", { name, exact: typeof name === "string" }).click();
    const dialog = () => page.getByRole("dialog");
    const card = id => page.locator(`.work-item[data-work="${id}"] .catalog-item`);
    const search = () => page.getByRole("searchbox");
    const back = () => page.locator("#back").click();
    const feedback = name => page.locator(".feedback").getByRole("button", { name }).click();
    const screenshotDir = new URL("../../output/jhs-android/preview-evidence/", import.meta.url);
    await mkdir(screenshotDir, { recursive: true });
    const shot = name => page.screenshot({ path: new URL(name + ".png", screenshotDir).pathname.slice(process.platform === "win32" ? 1 : 0) });
    const waitFor = locator => locator.waitFor({ state: "visible" });
    async function checkLayout() {
        const results = await page.evaluate(() => {
            const root = getComputedStyle(document.documentElement);
            const luminance = name => {
                const value = root.getPropertyValue(name).trim().slice(1);
                const [r, g, b] = value.match(/../g).map(pair => {
                    const channel = Number.parseInt(pair, 16) / 255;
                    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
                });
                return .2126 * r + .7152 * g + .0722 * b;
            };
            const contrast = (a, b) => {
                const levels = [luminance(a) + .05, luminance(b) + .05];
                return Math.max(...levels) / Math.min(...levels);
            };
            return {
                overflow: document.documentElement.scrollWidth > innerWidth,
                tooSmall: [...document.querySelectorAll("button, input[type=search], summary")].filter(node => {
                    const { width, height } = node.getBoundingClientRect();
                    return width > 0 && height > 0 && getComputedStyle(node).visibility !== "hidden"
                        && (width < 48 || height < 48);
                }).map(node => node.textContent.trim()),
                contrast: [["--ink", "--canvas"], ["--muted", "--canvas"], ["--accent", "--canvas"], ["--accent", "--selected"]]
                    .map(([a, b]) => contrast(a, b)),
            };
        });
        assert.equal(results.overflow, false);
        assert.deepEqual(results.tooSmall, []);
        assert(results.contrast.every(ratio => ratio >= 4.5), `contrast: ${results.contrast}`);
        console.log("Token contrast", results.contrast.map(ratio => ratio.toFixed(2)).join(", "));
    }

    await page.goto(address);
    await waitFor(card("0"));
    await checkLayout();
    await shot("01-discover");
    await search().fill("样片-1");
    assert.equal(await main.locator("[data-work]").first().getAttribute("data-work"), "9");
    await search().fill("港湾");
    await card("7").click();
    await press("收藏");
    assert.equal(await main.getByRole("button", { name: "收藏", exact: true }).getAttribute("aria-pressed"), "true");
    await back();
    assert.equal(await search().inputValue(), "港湾");
    assert.equal(await main.locator("[data-work]").count(), 1);
    await search().fill("林夏");
    assert(await main.locator("[data-work]").count() > 1);
    await press("筛选");
    await dialog().getByLabel("分类").selectOption("建筑");
    await press("取消", dialog());
    assert.equal(await main.locator(".active-filters").count(), 0);
    await search().fill("");
    await press("分类");
    await press("旅程");
    assert.equal(await main.locator("[data-work]").count(), 10);
    await press("旅程");
    await press("榜单");
    assert.equal(await main.locator(".catalog-rank").first().innerText(), "1");
    await press("全部");
    await press("排序");
    await dialog().getByLabel("顺序").selectOption("code");
    await press("应用", dialog());
    assert.equal(await main.locator("[data-work]").first().getAttribute("data-work"), "9");
    await card("18").scrollIntoViewIfNeeded();
    const before = await card("18").evaluate(node => node.getBoundingClientRect().top);
    await card("18").click();
    await back();
    assert(Math.abs(await card("18").evaluate(node => node.getBoundingClientRect().top) - before) <= 2);
    console.log("PASS 发现：番号、演员、分类、榜单、取消筛选、排序、收藏、返回锚点");

    await tab("追新").click();
    await shot("02-follow");
    assert.match(await main.locator(".queue-total").innerText(), /14/);
    assert.match(await card("0").innerText(), /林夏、许舟/);
    await card("0").click();
    await press("收藏");
    await press("处理完成");
    assert.match(await main.locator(".queue-total").innerText(), /13/);
    await press("处理完成", main.locator('[data-work="1"]'));
    await press("暂缓", main.locator('[data-work="2"]'));
    assert.match(await main.locator(".queue-total").innerText(), /11/);
    await feedback("撤销");
    assert.match(await main.locator(".queue-total").innerText(), /12/);
    await press("暂缓", main.locator('[data-work="2"]'));
    await press("暂缓", main.locator(".list-controls"));
    await press("恢复待办", main.locator('[data-work="2"]'));
    await press("筛选");
    await dialog().getByLabel("演员").selectOption("林夏");
    await press("应用", dialog());
    await press("待办", main.locator(".list-controls"));
    assert.equal(await main.locator("[data-work]").count(), 1);
    assert.match(await card("8").innerText(), /林夏/);
    console.log("PASS 追新：合并演员、收藏独立、连续处理、暂缓、撤销、手动恢复、演员筛选");

    await tab("片库").click();
    await shot("03-library");
    await press("筛选");
    await dialog().getByRole("checkbox", { name: "收藏" }).check();
    await dialog().getByLabel("清单").selectOption("ordinary");
    await press("应用", dialog());
    assert.equal(await main.locator("[data-work]").count(), 3);
    await card("0").click();
    await press("编辑备注");
    await dialog().getByRole("textbox", { name: "备注" }).fill("预览验收：可重启");
    await press("保存备注", dialog());
    await press("编辑清单");
    await press("加入", dialog().locator(".collection-row").filter({ hasText: "以后再看" }));
    await press("编辑清单");
    await press("移出", dialog().locator(".collection-row").filter({ hasText: "以后再看" }));
    await back();
    await press("多选");
    await card("0").click();
    await card("1").click();
    assert.equal(await main.locator(".selection-count").innerText(), "已选 2 部");
    await press("批量标记");
    await press("标为已看", dialog());
    assert.match(await card("0").innerText(), /已看/);
    assert.match(await card("1").innerText(), /已看/);
    await feedback("撤销");
    assert.doesNotMatch(await card("0").innerText(), /已看/);
    assert.match(await card("0").innerText(), /可重启/);
    await card("0").hover();
    await page.mouse.down();
    await waitFor(main.getByText("已选 1 部"));
    await page.mouse.up();
    await page.keyboard.press("Escape");
    assert.equal(await main.locator(".batch-toolbar").count(), 0);
    console.log("PASS 片库：组合筛选、备注、清单增减、两种多选、原子撤销");

    await card("0").click();
    await shot("04-detail");
    await main.locator(".media-strip").evaluate(node => { node.scrollLeft = 88; });
    await press("长图");
    const media = dialog().locator(".image-viewport");
    const width = await media.locator("img").evaluate(node => node.clientWidth);
    await press("放大", dialog());
    assert(await media.locator("img").evaluate(node => node.clientWidth) > width);
    await press("下一张", dialog());
    assert.match(await dialog().innerText(), /截图 1 · 2\/4/);
    await page.keyboard.press("Escape");
    assert.equal(await dialog().count(), 0);
    await press(/预告/);
    assert.equal(await dialog().locator("video").getAttribute("src"), "trailer.mp4");
    await dialog().locator("video").evaluate(video => {
        if (video.readyState >= 1) return;
        return new Promise((resolve, reject) => {
            video.addEventListener("loadedmetadata", resolve, { once: true });
            video.addEventListener("error", reject, { once: true });
        });
    });
    await press("关闭", dialog());
    await main.getByText("资源", { exact: true }).click();
    await waitFor(main.getByText("片源样片", { exact: false }));
    await main.getByText("评价", { exact: true }).click();
    await waitFor(main.getByText("样片短评", { exact: false }));
    console.log("PASS 共享详情：媒体缩放与翻页、预告解码、资源与评价展开");

    await tab("我的").click();
    await shot("05-mine");
    await press("任务");
    const failed = main.locator('[data-task="resource"]');
    await press("重试", failed);
    assert.equal(await failed.locator(".task-state").innerText(), "进行中");
    await press("取消任务", failed);
    assert.equal(await failed.locator(".task-state").innerText(), "已取消");
    await back();
    await press("演示场景");
    await main.getByLabel("发现结果").selectOption("fail-once");
    await tab("发现").click();
    assert.equal(await main.locator("[data-work]").count(), 8);
    await press("重试");
    assert.equal(await main.locator("[data-work]").count(), 39);
    await tab("我的").click();
    await main.getByLabel("发现结果").selectOption("empty");
    await tab("发现").click();
    await waitFor(main.getByText("没有符合条件的作品"));
    await tab("我的").click();
    await main.getByLabel("发现结果").selectOption("loading");
    await tab("发现").click();
    await waitFor(main.getByText("正在加载…"));
    await waitFor(card("0"));
    await tab("我的").click();
    await back();
    await press("显示与隐私");
    await main.getByLabel("主题").selectOption("dark");
    await main.getByLabel("隐私遮罩").check();
    await back();
    await tab("发现").click();
    assert.equal(await card("0").locator("[data-content-sensitive]").first().isVisible(), false);
    await page.locator("#privacy").click();
    assert.equal(await card("0").locator("[data-content-sensitive]").first().isVisible(), true);
    await tab("片库").click();
    assert.equal(await main.locator(".detail-cover").isVisible(), false);
    await page.reload();
    await waitFor(main.locator("[data-work]").first());
    assert.equal(await page.locator("html").getAttribute("data-jhs-theme"), "dark");
    assert.equal(await page.locator("#privacy").innerText(), "临时查看");
    await tab("片库").click();
    assert.match(await card("0").textContent(), /沿河的午后/);
    assert.match(await card("0").textContent(), /可重启/);
    console.log("PASS 模拟任务、恢复重试、空和加载状态、隐私自动收回、重启持久化");

    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.locator("html").evaluate(node => { node.style.fontSize = "28px"; });
    await tab("发现").click();
    await checkLayout();
    await page.locator("#privacy").click();
    await search().fill("漫长");
    await card("4").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await shot("07-dark-320dp");
    const duration = await page.locator(".navigation-lens").evaluate(node => getComputedStyle(node).transitionDuration);
    assert.equal(duration, "0s");
    await page.goto(address + "/?mode=wireframe");
    await waitFor(main.locator("[data-work]").first());
    assert.equal(await page.locator("html").getAttribute("data-wireframe"), "");
    await shot("06-wireframe");
    assert.deepEqual(outgoing, []);
    assert.deepEqual(errors, []);
    console.log("PASS 320dp、大字号、减少动效、灰阶原型、零外网请求");
} finally {
    await browser.close();
    server.close();
}
