import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const JAVDB_PAGE_2 = `<!doctype html><html><body>
  <div class="movie-list">
    <div class="item">
      <a href="/v/def-456" title="JavDB Second Page Movie">
        <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">
        <div class="video-title"><strong>DEF-456</strong> JavDB Second Page Movie</div>
        <div class="meta">2026-08-24</div>
        <div class="tags"></div>
      </a>
    </div>
  </div>
</body></html>`;

function visibleCardIds(page, selector = ".movie-list .item") {
  return page.evaluate((cardSelector) => [...document.querySelectorAll(cardSelector)]
    .filter((item) => getComputedStyle(item).display !== "none")
    .map((item) => item.id || item.querySelector("strong")?.textContent?.trim()), selector);
}

test("JavDB ordinary list parity keeps the full state-filter matrix and pagination jump", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers ordinary list filtering and pagination");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await page.locator(".movie-list").evaluate((root) => {
    root.insertAdjacentHTML("beforeend", `
      <div class="item" id="favorite-card"><a href="/v/favorite-001" title="Favorite"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><div class="video-title"><strong>FAVORITE-001</strong> Favorite</div><div class="meta">2026-08-23</div><div class="tags"></div></a></div>
      <div class="item" id="downloaded-card"><a href="/v/downloaded-001" title="Downloaded"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><div class="video-title"><strong>DOWNLOADED-001</strong> Downloaded</div><div class="meta">2026-08-22</div><div class="tags"></div></a></div>
      <div class="item" id="watched-card"><a href="/v/watched-001" title="Watched"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><div class="video-title"><strong>WATCHED-001</strong> Watched</div><div class="meta">2026-08-21</div><div class="tags"></div></a></div>
      <div class="item" id="blocked-card"><a href="/v/blocked-001" title="Blocked"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><div class="video-title"><strong>BLOCKED-001</strong> Blocked</div><div class="meta">2026-08-20</div><div class="tags"></div></a></div>`);
  });
  await page.locator("section").evaluate((section) => section.insertAdjacentHTML("beforeend", '<ul class="pagination-list"><li><a class="pagination-link is-current">1</a></li></ul>'));
  await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no" } });
  await expect(page.locator("#jhs-quick-filter")).toBeVisible();
  await expect(page.locator("#gemini-jump-page-control")).toHaveCount(1);

  await page.evaluate(async () => {
    const patches = [
      ["FAVORITE-001", { favorite: true }],
      ["DOWNLOADED-001", { downloaded: true }],
      ["WATCHED-001", { watched: true }],
      ["BLOCKED-001", { blocked: true }],
    ];
    for (const [carNum, flags] of patches) {
      await window.stateService.patch(carNum, flags, { type: "browser-list-parity", record: { carNum, url: `/v/${carNum.toLowerCase()}`, names: "", publishTime: "" } });
    }
    const api = await window.unsafeWindow.__jhsBrowserTestApi.getFeatureApi("list");
    await api.doFilter(api.captureListRevision());
  });

  const selectFilter = async (filter) => {
    await page.evaluate(async (value) => {
      const api = await window.unsafeWindow.__jhsBrowserTestApi.getFeatureApi("list");
      api.setQuickFilter(value);
      await api.doFilter(api.captureListRevision());
    }, filter);
    await page.waitForTimeout(30);
    return visibleCardIds(page);
  };
  expect(await selectFilter("waitCheck")).toEqual(["ABC-123"]);
  expect(await selectFilter("all")).toHaveLength(5);
  expect(await selectFilter("favorite")).toEqual(["favorite-card"]);
  expect(await selectFilter("hasDown")).toEqual(["downloaded-card"]);
  expect(await selectFilter("hasWatch")).toEqual(["watched-card"]);
  expect(await selectFilter("blockedItems")).toEqual(["blocked-card"]);

  await page.locator("#jumpPageInput").fill("2");
  await page.locator(".jhs-jump-page-btn").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("2");
});

test("ordinary JavDB list parity sorts loaded cards while AutoPage is disabled", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers ordinary list sorting");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await page.locator(".movie-list").evaluate((root) => {
    root.innerHTML = `
      <div class="item" id="sort-old"><a href="/v/sort-old"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><div class="video-title"><strong>SORT-OLD</strong> Old</div><div class="score">由 12 人评价</div><div class="meta">2026-08-01</div><div class="tags"></div></a></div>
      <div class="item" id="sort-new"><a href="/v/sort-new"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><div class="video-title"><strong>SORT-NEW</strong> New</div><div class="score">由 3 人評價</div><div class="meta">2026-08-29</div><div class="tags"></div></a></div>`;
  });
  await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no" } });
  await expect(page.locator("#sort-toggle-btn")).toBeVisible();
  await expect(page.locator("#jhs-page-commandbar .jhs-sort-control")).toHaveCount(1);
  await page.locator("#sort-toggle-btn").click();
  await expect(page.locator(".jhs-sort-menu")).toHaveClass(/is-open/);
  await expect(page.locator(".jhs-sort-option")).toHaveCount(3);
  await page.locator('[data-sort-method="rateCount"]').click();
  await expect.poll(() => page.locator(".movie-list > .item").evaluateAll((items) => items.map((item) => item.id))).toEqual(["sort-old", "sort-new"]);
  await page.evaluate(async () => {
    const api = await window.unsafeWindow.__jhsBrowserTestApi.getFeatureApi("list");
    await api.selectSortMethod("date");
  });
  await expect.poll(() => page.locator(".movie-list > .item").evaluateAll((items) => items.map((item) => item.id))).toEqual(["sort-new", "sort-old"]);
});

test("ordinary JavDB card click opens the detail dialog without opening a new tab", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers desktop detail dialog navigation");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.addStyleTag({ content: ".movie-list .item{display:block}.movie-list .item img{width:180px;height:240px}" });
  await page.locator(".movie-list .item img").click();
  await expect(page.locator(".layui-layer iframe")).toHaveCount(1);
  expect(await page.evaluate(() => window.__jhsBrowserDiagnostics.openedTabs)).toEqual([]);
});

test("ordinary card toolbar actions stay interactive instead of opening detail", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers card toolbar event ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableHandleSvg: "yes" } });
  await page.addStyleTag({ content: ".movie-list .item .tags{display:flex!important}" });
  const card = page.locator(".movie-list .item").first();
  await expect(card.locator(".jhs-cover-tools")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.__jhsBrowserTestApi.services.settings.snapshot().enableHandleSvg)).toBe("yes");
  await expect(card.locator(".handleSvg")).toBeVisible();
  await card.locator(".jhs-card-menu-trigger").first().click();
  await expect(card.locator(".jhs-card-menu.is-open")).toHaveCount(1);
  await expect(page.locator(".layui-layer iframe")).toHaveCount(0);
  await card.locator(".hasDownBtn").click();
  await expect.poll(() => page.evaluate(async () => (await window.stateService.getCar("ABC-123"))?.stateFlags?.downloaded)).toBe(true);
  await expect(page.locator(".layui-layer iframe")).toHaveCount(0);
});

test("card video clicks stay with list playback instead of opening detail", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers list video event ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.locator(".movie-list .item").first().evaluate((item) => {
    const video = document.createElement("video");
    video.id = "browser-list-video";
    Object.defineProperty(video, "paused", { configurable: true, value: true, writable: true });
    video.play = () => { video.paused = false; window.__jhsVideoPlayed = true; return Promise.resolve(); };
    item.querySelector("a")?.appendChild(video);
  });
  await page.locator("#browser-list-video").click();
  await expect.poll(() => page.evaluate(() => window.__jhsVideoPlayed === true)).toBe(true);
  await expect(page.locator(".layui-layer iframe")).toHaveCount(0);
});

test("ordinary JavBus card click opens the detail dialog without opening a new tab", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the second native list host");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
  await page.locator(".masonry .item").evaluate((item) => item.insertAdjacentHTML("beforeend", '<div class="photo-info"><span></span></div>'));
  await injectUserscriptRuntime(page);
  await page.addStyleTag({ content: ".masonry .item img{display:block!important;width:180px!important;height:240px!important}" });
  await page.locator(".masonry .item img").click();
  await expect(page.locator(".layui-layer iframe")).toHaveCount(1);
  expect(await page.evaluate(() => window.__jhsBrowserDiagnostics.openedTabs)).toEqual([]);
});

test("ordinary JavDB list parity loads the next page through the waterfall lifecycle", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the ordinary waterfall lifecycle");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    hostPageResponses: { "https://javdb.com/page/2": JAVDB_PAGE_2 },
  });
  await expect(page.locator(".jhs-scroll")).toHaveCount(1);
  await expect(page.locator(".movie-list .item")).toHaveCount(2, { timeout: 7_000 });
  await expect(page.locator(".movie-list .item").filter({ hasText: "DEF-456" })).toBeVisible();
  await expect(page.locator(".jhs-scroll")).toHaveClass(/waterfall-no-more/);
  expect(await page.evaluate(() => window.__jhsBrowserDiagnostics.requests.some(({ url }) => url === "https://javdb.com/page/2"))).toBe(true);
});

test("ordinary JavDB list parity batch-scans and writes matching records across pages", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers ordinary cross-page batch writes");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    settingOverrides: { autoPage: "no" },
    hostPageResponses: { "https://javdb.com/page/2": JAVDB_PAGE_2 },
  });
  const result = await page.evaluate(async () => {
    const api = await window.unsafeWindow.__jhsBrowserTestApi.getFeatureApi("list");
    return api.batchSaveAllVideos({ kind: "search", displayName: "当前搜索条件", recordName: "" }, "favorite", { filter: "waitCheck", confirm: false });
  });
  expect(result).toMatchObject({ matched: 2, updated: 2 });
  await expect.poll(() => page.evaluate(async () => {
    const first = await window.stateService.getCar("ABC-123");
    const second = await window.stateService.getCar("DEF-456");
    return [first?.stateFlags?.favorite, second?.stateFlags?.favorite];
  })).toEqual([true, true]);
});

test("ordinary JavBus list parity prepares native cards and mounts the shared list surface", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers ordinary JavBus list ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
  await page.locator(".masonry .item").evaluate((item) => item.insertAdjacentHTML("beforeend", '<div class="photo-info"><span></span></div>'));
  await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no" } });
  await expect(page.locator("#jhs-quick-filter")).toBeVisible();
  await expect(page.locator(".masonry .item .video-title")).toHaveCount(1);
  await expect(page.locator(".masonry .item .jhs-cover-tools")).toHaveCount(1);
  await expect(page.locator(".masonry .item")).toBeVisible();
});

test("Top250 parity applies state filters to API-rendered ranking cards", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers Top250 state filtering");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?handleTop=1", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { topMovies: [
    { id: "top-favorite", number: "TOP-FAV", origin_title: "Top favorite", release_date: "2026-08-30", cover_url: "https://c0.jdbstatic.com/covers/top-favorite.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false },
    { id: "top-pending", number: "TOP-PENDING", origin_title: "Top pending", release_date: "2026-08-29", cover_url: "https://c0.jdbstatic.com/covers/top-pending.jpg", has_cnsub: false, magnets_count: 0, new_magnets: false },
  ] });
  await expect(page.locator(".jhs-top250-list #top-favorite")).toBeVisible();
  await page.evaluate(async () => {
    await window.stateService.patch("TOP-FAV", { favorite: true }, { type: "browser-top250-parity", record: { carNum: "TOP-FAV", url: "/v/top-favorite", names: "", publishTime: "2026-08-30" } });
    const api = await window.unsafeWindow.__jhsBrowserTestApi.getFeatureApi("list");
    await api.doFilter(api.captureListRevision());
    api.setQuickFilter("favorite");
    await api.doFilter(api.captureListRevision());
  });
  await expect.poll(() => page.locator(".jhs-top250-list .item").evaluateAll((items) => items.filter((item) => getComputedStyle(item).display !== "none").map((item) => item.id))).toEqual(["top-favorite"]);
});

test("HotShow parity batch-writes the current owned ranking page", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers owned ranking batch writes");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?handlePlayback=1&period=daily", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { rankingMovies: [
    { id: "hot-batch-a", number: "HOT-BATCH-A", origin_title: "Hot batch A", release_date: "2026-08-30", cover_url: "https://c0.jdbstatic.com/covers/hot-batch-a.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false },
    { id: "hot-batch-b", number: "HOT-BATCH-B", origin_title: "Hot batch B", release_date: "2026-08-29", cover_url: "https://c0.jdbstatic.com/covers/hot-batch-b.jpg", has_cnsub: false, magnets_count: 0, new_magnets: false },
  ] });
  await expect(page.locator(".jhs-hitshow-list #hot-batch-a")).toBeVisible();
  const result = await page.evaluate(async () => {
    const api = await window.unsafeWindow.__jhsBrowserTestApi.getFeatureApi("list");
    return api.batchSaveAllVideos({ kind: "search", displayName: "当前榜单页", recordName: "" }, "favorite", { filter: "waitCheck", confirm: false });
  });
  expect(result).toMatchObject({ matched: 2, updated: 2 });
  await expect.poll(() => page.evaluate(async () => [
    (await window.stateService.getCar("HOT-BATCH-A"))?.stateFlags?.favorite,
    (await window.stateService.getCar("HOT-BATCH-B"))?.stateFlags?.favorite,
  ])).toEqual([true, true]);
});
