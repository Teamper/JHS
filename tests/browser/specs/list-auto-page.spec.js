import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const tagUrl = "https://javdb.com/tags?t=d&c10=1";

function tagPage(carNums, nextPage) {
    const cards = carNums.map(carNum => `
        <div class="item">
            <a class="box" href="/v/${carNum.toLowerCase()}">
                <div class="cover" aria-hidden="true"></div>
                <div class="video-title"><strong>${carNum}</strong> 测试作品</div>
                <div class="meta">2026-08-25</div>
            </a>
            <div class="tags"></div>
        </div>`).join("");
    const next = nextPage ? `<a class="pagination-next" href="?t=d&amp;c10=1&amp;page=${nextPage}">下一页</a>` : "";
    return `<!doctype html>
        <html lang="zh-CN"><head><meta charset="utf-8"><title>JavDB 标签筛选</title>
        <style>
            #tag-results { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
            #tag-results .cover { height: 150px; background: #e9eef3; }
        </style></head><body>
        <nav id="navbar-menu-user" style="display:none"><div class="navbar-end"></div></nav>
        <section class="section"><div class="container">
            <h1 class="title is-4">JavDB 标签筛选</h1>
            <nav class="main-tabs"></nav>
            <div id="tag-results" class="movie-list">${cards}</div>
            <nav class="pagination">${next}</nav>
        </div></section></body></html>`;
}

test("JavDB tag results keep auto-paging across pages hidden by the watched filter", async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one viewport covers the filtered waterfall");
    const watched = ["ABC-103", "ABC-104", "ABC-105"];
    const pages = [tagPage(["ABC-101"], 2), tagPage(["ABC-102"], 3), tagPage(watched)];
    const requests = [];
    await fulfillHostFixtures(context);
    await context.route(url => url.origin === "https://javdb.com" && url.pathname === "/tags", async route => {
        if (!route.request().isNavigationRequest()) requests.push(route.request().url());
        const number = Number(new URL(route.request().url()).searchParams.get("page") ?? 1);
        const html = pages[number - 1];
        await route.fulfill({ status: html ? 200 : 404, contentType: "text/html; charset=utf-8", body: html ?? "" });
    });
    await page.goto(tagUrl);
    const cards = page.locator("#tag-results > .item");
    await cards.first().evaluate(card => { card.style.minHeight = "1600px"; });
    await injectUserscriptRuntime(page, {
        hostStyles: true,
        settingOverrides: { autoPage: "yes", defaultQuickFilterTab: "all", themeMode: "light" },
        beforeUserscriptInjection: host => host.evaluate(async carNums => {
            const store = window.localforage.createInstance({ name: "JAV-JHS", storeName: "appData" });
            await store.setItem("car_list", carNums.map(carNum => ({ carNum, stateFlags: { watched: true } })));
        }, watched),
    });
    const loader = page.locator(".jhs-scroll");
    expect(await loader.evaluate(element => element.getBoundingClientRect().top - window.innerHeight)).toBeGreaterThan(500);
    expect(requests).toEqual([]);

    const watchedFilter = page.locator('#jhs-quick-filter [data-jhs-filter="hasWatch"]');
    await watchedFilter.click();
    await expect(watchedFilter).toHaveAttribute("aria-selected", "true");
    await expect(cards.first()).toBeHidden();
    await expect(cards.locator("strong:visible")).toHaveText(watched);
    await expect(cards.filter({ hasText: "ABC-102" })).toBeAttached();
    await expect(cards.filter({ hasText: "ABC-102" })).toBeHidden();
    await expect(loader).toHaveText("已经到底了");
    expect(requests).toEqual([`${tagUrl}&page=2`, `${tagUrl}&page=3`]);

    const screenshot = info.outputPath("javdb-tag-watched.png");
    await page.screenshot({ path: screenshot });
    await info.attach("JavDB 标签与已观看筛选", { path: screenshot, contentType: "image/png" });
});
