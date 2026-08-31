import { expect, test } from "@playwright/test";
import budget from "../../../performance-budget.json" with { type: "json" };
import { assertNoHorizontalOverflow, fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

for (const [label, url, expectedPlugin] of [
  ["JavDB", "https://javdb.com/v/test-id", "DetailPagePlugin"],
  ["JavBus", "https://www.javbus.com/ABC-123", "BusDetailPagePlugin"]
]) {
  test(`${label} uses the real host origin with local fixtures`, async ({ context, page }) => {
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect.poll(() => page.evaluate((name) => window.unsafeWindow.pluginManager.getPluginNames().includes(name), expectedPlugin)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--jhs-accent").trim()), "Bootstrap must inject the core theme tokens").not.toBe("");
    await expect(page.locator("body")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.waitForTimeout(250);
    const initialRequests = await page.evaluate(() => window.__jhsBrowserDiagnostics.requests);
    expect(initialRequests.length, `deterministic fixture startup request budget: ${JSON.stringify(initialRequests)}`).toBeLessThanOrEqual(budget.browserFixture.maximumInitialRequests[label]);
  });
}

for (const [label, url] of [
  ["JavDB", "https://javdb.com/"],
  ["JavBus", "https://www.javbus.com/"]
]) {
  test(`${label} list route uses its HostAdapter and list runtime`, async ({ context, page }, testInfo) => {
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("ListPagePlugin"))).toBe(true);
    await expect(page.locator(label === "JavDB" ? ".movie-list .item" : ".masonry .movie-box")).toHaveCount(1);
    if (testInfo.project.name.startsWith("mobile")) {
      await expect(page.locator("#jhs-fab")).toBeVisible();
      await expect(page.locator("#jhs-fab-menu .jhs-mobile-filter-menu")).toHaveCount(1);
    } else await expect(page.locator("#jhs-quick-filter")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
}

for (const [label, url] of [
  ["JavDB", "https://javdb.com/"],
  ["JavBus", "https://www.javbus.com/"]
]) {
  test(`${label} mounts the history entry through the Library feature`, async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "one desktop project covers the Library history entry");
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect.poll(() => page.locator("#historyBtn").count(), { timeout: 5_000 }).toBe(1);
    await expect(page.locator("#historyBtn")).toContainText("鉴定记录");
  });
}

for (const [label, url, setup, selector, expectedPlugins] of [
  ["JavDB", "https://javdb.com/", () => {
    document.body.insertAdjacentHTML("afterbegin", '<div id="navbar-menu-hero"></div><div id="search-bar-container"></div>');
  }, "#search-box #search-img-btn", []],
  ["JavBus", "https://www.javbus.com/", () => {
    document.body.insertAdjacentHTML("afterbegin", '<nav id="navbar"><div><div><span></span></div></div></nav>');
  }, "#search-img-btn.jhs-identity-search-image-btn", []],
]) {
  test(`${label} identity navigation is mounted by the Identity feature`, async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers each Identity host entry");
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.evaluate(setup);
    await injectUserscriptRuntime(page);
    await expect(page.locator(selector)).toHaveCount(1);
    await expect.poll(() => page.evaluate((names) => names.every((name) => window.unsafeWindow.pluginManager.getTimings().find((timing) => timing.name === name)?.status === "managed-feature"), expectedPlugins)).toBe(true);
  });
}

test("Top250 intercepts the native premium route without a favorite-tab label", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the Top250 entry regression");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await page.locator(".main-tabs").evaluate((root) => {
    root.innerHTML = '<a id="fixture-top250" href="/rankings/top?t=y2025"><span>Top250</span></a>';
  });
  await injectUserscriptRuntime(page);
  await page.locator("#fixture-top250").click();
  await expect(page.locator("#username")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
});

test("Top250 keeps filters above the list and restores API proxy cover URLs", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers Top250 layout and covers");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?handleTop=1&handleType=all&type_value=", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { topMovies: [{
    id: "top-fixture", number: "TOP-001", origin_title: "Top Fixture", release_date: "2026-08-30",
    cover_url: "https://jdforrepam.com/rhe951l4q/covers/top-fixture.jpg",
    thumb_url: "https://jdforrepam.com/rhe951l4q/thumbs/top-fixture.jpg",
    has_cnsub: false, magnets_count: 1, new_magnets: false,
  }] });
  const filters = page.locator(".jhs-top250-filters"), list = page.locator(".jhs-top250-list"), image = list.locator("#top-fixture img");
  await expect(filters).toBeVisible();
  await expect(list).toBeVisible();
  expect(await filters.evaluate((node, listNode) => Boolean(node.compareDocumentPosition(listNode) & Node.DOCUMENT_POSITION_FOLLOWING), await list.elementHandle())).toBe(true);
  await expect(image).toHaveAttribute("src", "https://c0.jdbstatic.com/thumbs/top-fixture.jpg");
  await expect(image).toHaveAttribute("data-full", "https://c0.jdbstatic.com/covers/top-fixture.jpg");
  await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
});

test("legacy disabled plugin migrates to one contribution only", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers storage migration");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["ReviewPlugin"] });
  const pluginNames = await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames());
  expect(pluginNames).not.toContain("ReviewPlugin");
  expect(pluginNames).toContain("RelatedPlugin");
  expect(pluginNames).toContain("DetailWorkspacePlugin");
});

for (const path of ["/advanced_search?type=3", "/advanced_search?type=100", "/want_watch_videos", "/watched_videos"]) {
  test(`JavDB DOM list route remains active on ${path}`, async ({ context, page }) => {
    await fulfillHostFixtures(context);
    await page.goto(`https://javdb.com${path}`, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("ListPagePlugin"))).toBe(true);
  });
}

test("JavDB state import entry is mounted by the Library feature", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one desktop project covers the Library state import entry");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/watched_videos", { waitUntil: "domcontentloaded" });
  await page.locator("main.container").evaluate((root) => {
    const heading = document.createElement("h3");
    heading.textContent = "已观看";
    root.prepend(heading);
  });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#wantWatchBtn")).toHaveCount(1);
  await expect(page.locator("#wantWatchBtn")).toContainText("导入至 JHS");
});

test("HotShow creates an owned list when advanced search has no native list root", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers HotShow host fallback");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?handlePlayback=1&period=daily", { waitUntil: "domcontentloaded" });
  expect(await page.locator(".movie-list").count()).toBe(0);
  await injectUserscriptRuntime(page, { rankingMovies: [{
    id: "hot-fixture", number: "ABC-123", origin_title: "Hot Fixture", release_date: "2026-08-29",
    cover_url: "https://c0.jdbstatic.com/covers/fixture.jpg", has_cnsub: true, magnets_count: 1, new_magnets: false,
  }, {
    id: "hot-fixture-fc2", number: "FC2-PPV-1234567", origin_title: "Hot FC2", release_date: "2026-08-28",
    cover_url: "https://c0.jdbstatic.com/covers/fc2.jpg", has_cnsub: false, magnets_count: 0, new_magnets: false,
  }] });
  await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
  await expect(page.locator(".jhs-hitshow-list #hot-fixture")).toBeVisible();
  await expect(page.locator(".jhs-hitshow-title")).toContainText("热播");
  await expect(page.locator(".empty-message")).toHaveCount(0);
  const periodToolbar = page.locator("#jhs-hitshow-period");
  await expect(periodToolbar).toBeVisible();
  await expect(periodToolbar.locator(".jhs-segmented__item")).toHaveCount(3);
  // 排序与鉴定操作控件挂进热播标题容器（之后由命令栏收拢），不注入页面 h2
  await expect(page.locator("#sort-toggle-btn")).toHaveCount(1);
  await expect(page.locator("#waitCheckBtn")).toHaveCount(1);
  const image = page.locator(".jhs-hitshow-list #hot-fixture img");
  await expect(image).toHaveAttribute("src", /\/thumbs\//);
  await expect(image).toHaveAttribute("data-full", /\/covers\//);
  const quickFilter = page.locator("#jhs-quick-filter");
  await expect(quickFilter).toBeVisible();
  await quickFilter.locator('[data-jhs-filter="all"]').click();
  await expect(quickFilter.locator('[data-jhs-filter="all"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".jhs-hitshow-list #hot-fixture")).toBeVisible();
  // 回归场景：在热播页把卡片标记为已下载后，卡片标记必须实时刷新，且各筛选档位显隐正确
  const card = page.locator(".jhs-hitshow-list #hot-fixture");
  await page.evaluate(() => window.unsafeWindow.stateService.patch("ABC-123", { downloaded: true }, {
    type: "list-card-state", record: { carNum: "ABC-123", url: "/v/hot-fixture", names: "", publishTime: "2026-08-29", fc2Source: "fc2" },
  }));
  await expect.poll(() => card.getAttribute("data-jhs-flags"), { timeout: 10_000 }).toContain('"downloaded":true');
  await quickFilter.locator('[data-jhs-filter="waitCheck"]').click();
  await expect(card).toBeHidden();
  await quickFilter.locator('[data-jhs-filter="hasDown"]').click();
  await expect(card).toBeVisible();
  await quickFilter.locator('[data-jhs-filter="all"]').click();
  await expect(card).toBeVisible();
  // 回归场景：自渲染榜单上的 FC2 卡片必须被延迟挂载保护，点击打开 FC2 对话框而不是被详情导航吞掉
  const fc2Card = page.locator(".jhs-hitshow-list #hot-fixture-fc2");
  await expect.poll(() => fc2Card.getAttribute("data-jhs-fc2-protected"), { timeout: 10_000 }).toBe("true");
  await expect(fc2Card.locator("a").first()).toHaveAttribute("href", /collection_codes/);
  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    fc2.resolveMovieIdForRecord = async () => null;
    fc2.resolveFc2Source = async () => "fc2";
    fc2.openFc2Dialog = (...args) => { window.__jhsFc2Navigation = { mode: "dialog", args }; };
    fc2.openFc2Page = (...args) => { window.__jhsFc2Navigation = { mode: "page", args }; };
  });
  await fc2Card.locator(".video-title").click();
  expect(await page.evaluate(() => window.__jhsFc2Navigation?.mode)).toBe("dialog");
});

test("HotShow hover preview stays below the FC2 detail dialog", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers hover/dialog stacking");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?handlePlayback=1&period=daily", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: ".movie-list{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px}.item .cover{position:relative;width:100%;padding-top:60%}.item .cover img{position:absolute;inset:0;width:100%;height:100%}" });
  await injectUserscriptRuntime(page, {
    settingOverrides: { hoverBigImg: "yes" },
    rankingMovies: [{
      id: "hot-fixture-fc2", number: "FC2-PPV-1234567", origin_title: "Hot FC2", release_date: "2026-08-28",
      cover_url: "https://c0.jdbstatic.com/covers/fc2.jpg", has_cnsub: false, magnets_count: 0, new_magnets: false,
    }],
  });
  await expect(page.locator(".jhs-hitshow-list #hot-fixture-fc2")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.imageHoverPreviewObj))).toBe(true);
  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    fc2.resolveMovieIdForRecord = async () => null;
    fc2.resolveFc2Source = async () => "fc2";
  });
  const fc2Card = page.locator(".jhs-hitshow-list #hot-fixture-fc2");
  await expect.poll(() => fc2Card.getAttribute("data-jhs-fc2-protected"), { timeout: 10_000 }).toBe("true");
  await fc2Card.locator(".cover img").hover();
  await expect.poll(() => page.evaluate(() => document.querySelector(".image-hover-preview")?.classList.contains("active") === true)).toBe(true);
  await fc2Card.locator(".cover img").click();
  await expect.poll(() => page.evaluate(() => Boolean([...document.querySelectorAll(".layui-layer")].find((el) => el.querySelector(".jhs-fc2-dialog-host"))))).toBe(true);
  // 回归门禁：FC2 详情对话框的层级必须压过悬停预览（hoverPreview 档低于 modal/layer）
  const ordering = await page.evaluate(() => {
    const preview = document.querySelector(".image-hover-preview");
    const dialog = [...document.querySelectorAll(".layui-layer")].find((el) => el.querySelector(".jhs-fc2-dialog-host"));
    if (!preview || !dialog) return null;
    return {
      previewZ: Number.parseInt(preview.style.zIndex, 10),
      dialogZ: Number.parseInt(dialog.style.zIndex, 10),
      token: Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--jhs-z-hover-preview"), 10),
    };
  });
  expect(ordering).not.toBeNull();
  expect(ordering.previewZ).toBe(ordering.token);
  expect(ordering.dialogZ).toBeGreaterThan(ordering.previewZ);
});

test("HotShow period tabs fetch and render period-specific rankings", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers period switching");
  const periodMovies = {
    daily: [{ id: "hot-daily", number: "DAILY-001", origin_title: "Daily movie", release_date: "2026-08-29", cover_url: "https://c0.jdbstatic.com/covers/daily.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false }],
    weekly: [{ id: "hot-weekly", number: "WEEKLY-001", origin_title: "Weekly movie", release_date: "2026-08-28", cover_url: "https://c0.jdbstatic.com/covers/weekly.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false }],
    monthly: [{ id: "hot-monthly", number: "MONTHLY-001", origin_title: "Monthly movie", release_date: "2026-08-27", cover_url: "https://c0.jdbstatic.com/covers/monthly.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false }],
  };
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?handlePlayback=1&period=daily", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { rankingMovies: periodMovies });
  // 回归门禁：周期参数必须贯穿 URL → 请求 query → 渲染，路由重构不得把它拍平成单一榜单
  await expect(page.locator(".jhs-hitshow-list #hot-daily")).toBeVisible();
  await expect(page.locator("#jhs-hitshow-period .active")).toHaveAttribute("href", /period=daily/);
  await expect.poll(() => page.evaluate(() => window.__jhsBrowserDiagnostics.requests.some((r) => r.url.includes("period=daily")))).toBe(true);

  for (const period of [ "weekly", "monthly" ]) {
    await page.locator(`#jhs-hitshow-period a[href*="period=${period}"]`).click();
    await page.waitForURL(new RegExp(`period=${period}`), { timeout: 15_000 });
    await injectUserscriptRuntime(page, { rankingMovies: periodMovies });
    await expect(page.locator(`.jhs-hitshow-list #hot-${period}`)).toBeVisible();
    await expect(page.locator(".jhs-hitshow-list #hot-daily")).toHaveCount(0);
    await expect(page.locator("#jhs-hitshow-period .active")).toHaveAttribute("href", new RegExp(`period=${period}`));
    await expect.poll(() => page.evaluate((marker) => window.__jhsBrowserDiagnostics.requests.some((r) => r.url.includes(marker)), `period=${period}`)).toBe(true);
  }
});

test("HotShow sort starts at default and stays page-local", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers owned ranking sort");
  const rankingMovies = [
    { id: "sort-a", number: "AAA-001", origin_title: "Older movie", release_date: "2026-08-01", cover_url: "https://c0.jdbstatic.com/covers/a.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false },
    { id: "sort-b", number: "BBB-002", origin_title: "Newer movie", release_date: "2026-08-29", cover_url: "https://c0.jdbstatic.com/covers/b.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false },
  ];
  const cardOrder = () => page.locator(".jhs-hitshow-list .item .video-title strong").allTextContents();
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?handlePlayback=1&period=daily", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { sortMethod: "rateCount" }, rankingMovies });
  // 回归门禁：全局排序是“评价人数”，热播也必须以“默认”排序启动（榜单原始顺序）
  await expect(page.locator("#jhs-sort-current")).toHaveText("默认");
  await expect.poll(cardOrder).toEqual([ "AAA-001", "BBB-002" ]);
  // 页内选择“时间”：立即生效，但不写全局设置
  await page.locator("#sort-toggle-btn").click();
  await page.locator('[data-sort-method="date"]').click();
  await expect(page.locator("#jhs-sort-current")).toHaveText("时间");
  await expect.poll(cardOrder).toEqual([ "BBB-002", "AAA-001" ]);
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().sortMethod)).toBe("rateCount");
  // 页内切回默认：恢复榜单原始顺序
  await page.locator("#sort-toggle-btn").click();
  await page.locator('[data-sort-method="default"]').click();
  await expect(page.locator("#jhs-sort-current")).toHaveText("默认");
  await expect.poll(cardOrder).toEqual([ "AAA-001", "BBB-002" ]);
});

test("FC2 cards keep dialog navigation and use owned-page anchor fallback", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers navigation semantics");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/advanced_search?type=3", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect.poll(() => page.locator(".movie-list .item").getAttribute("data-jhs-fc2-protected")).toBe("true");
  const href = await page.locator(".movie-list .item a").getAttribute("href");
  expect(new URL(href).pathname).toBe("/users/collection_codes");
  expect(new URL(href).searchParams.get("url")).toBe("/v/vip-fc2-placeholder");
  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    fc2.resolveMovieIdForRecord = async () => null;
    fc2.resolveFc2Source = async () => "fc2";
    fc2.openFc2Dialog = (...args) => { window.__jhsFc2Navigation = { mode: "dialog", args }; };
    fc2.openFc2Page = (...args) => { window.__jhsFc2Navigation = { mode: "page", args }; };
  });
  await page.evaluate(() => document.querySelector(".movie-list .item img").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
  await expect.poll(() => page.evaluate(() => window.__jhsFc2Navigation?.mode)).toBe("dialog");
  await page.evaluate(() => { window.__jhsFc2Navigation = null; });
  await page.evaluate(() => document.querySelector(".movie-list .item img").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })));
  await expect.poll(() => page.evaluate(() => window.__jhsFc2Navigation?.mode)).toBe("page");
  await page.evaluate(() => { window.__jhsFc2Navigation = null; document.querySelector(".movie-list .item img").dispatchEvent(new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 })); });
  await expect.poll(() => page.evaluate(() => window.__jhsFc2Navigation?.mode)).toBe("page");
  const ownedUrl = new URL(href);
  ownedUrl.searchParams.set("movieId", "fixture-id");
  await page.goto(ownedUrl.href, { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  expect(new URL(page.url()).pathname).toBe("/users/collection_codes");
  await expect(page.locator(".jhs-fc2-workspace[data-jhs-fc2-mode='page']")).toBeVisible();
});

test("Settings opens when optional CoverButton and Blacklist contributions are disabled", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers optional settings dependencies");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["CoverButtonPlugin", "BlacklistPlugin"] });
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  await expect(page.locator(".layui-layer #saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await page.locator('.layui-layer .side-menu-item[data-panel="base-panel"]').click();
  await page.locator(".layui-layer #reviewCount").selectOption("30", { force: true });
  await page.locator(".layui-layer #saveBtn").click();
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().reviewCount)).toBe("30");
  await expect(page.locator(".layui-layer #saveBtn")).not.toHaveAttribute("aria-busy", "true");
});

test("Settings remains interactive and catalogs a disabled external-sites contribution", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers disabled optional settings dependencies");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["OtherSitePlugin", "BusImgPlugin", "UnknownLegacyPlugin"] });
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  await expect(page.locator(".layui-layer #saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await page.locator('.layui-layer .side-menu-item[data-panel="base-panel"]').click();
  await expect(page.locator(".layui-layer #base-panel")).toBeVisible();
  await page.locator('.layui-layer .side-menu-item[data-panel="plugin-mgmt-panel"]').click();
  const externalSitesToggle = page.locator('.layui-layer .pm-toggle[data-plugin="OtherSitePlugin"]');
  await expect(externalSitesToggle).toBeVisible();
  await expect(externalSitesToggle).not.toBeChecked();
  await expect(page.locator(".layui-layer #pm-disabled")).toHaveText("1");
  const enabled = Number(await page.locator(".layui-layer #pm-enabled").textContent());
  const total = Number(await page.locator(".layui-layer #pm-total").textContent());
  expect(enabled).toBe(total - 1);
});

test("Settings blocks saving until failed hydration is retried successfully", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the hydration failure gate");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => {
    const movie = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("movie");
    window.__jhsOriginalExternalSiteOrigin = movie.externalSiteOrigin.bind(movie);
    movie.externalSiteOrigin = () => { throw new Error("fixture hydration failure"); };
  });
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  const save = page.locator(".layui-layer #saveBtn");
  await expect(save).toBeDisabled();
  await expect(save).toHaveAttribute("data-jhs-settings-ready", "false");
  await expect(page.locator(".layui-layer #settings-hydration-status")).toContainText("表单加载失败");
  await page.evaluate(() => {
    const movie = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("movie");
    movie.externalSiteOrigin = window.__jhsOriginalExternalSiteOrigin;
  });
  await page.getByRole("button", { name: "重试加载" }).click();
  await expect(save).toHaveAttribute("data-jhs-settings-ready", "true");
  await expect(save).toBeEnabled();
});

test("list runtime survives disabled optional list contributions", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers disabled list combinations");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  const disabledPlugins = ["Fc2Plugin", "AutoPagePlugin", "CoverButtonPlugin", "ListPageButtonPlugin"];
  await injectUserscriptRuntime(page, { disabledPlugins });
  const pluginNames = await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames());
  expect(pluginNames).toContain("ListPagePlugin");
  disabledPlugins.forEach((name) => expect(pluginNames).not.toContain(name));
  await expect(page.locator(".movie-list .item")).toBeVisible();
});

test("detail state controls survive disabled optional magnet contributions", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers disabled detail combinations");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  const disabledPlugins = ["HighlightMagnetPlugin", "MagnetHubPlugin"];
  await injectUserscriptRuntime(page, { disabledPlugins });
  const pluginNames = await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames());
  expect(pluginNames).toContain("DetailPageButtonPlugin");
  disabledPlugins.forEach((name) => expect(pluginNames).not.toContain(name));
  await expect(page.locator(".jhs-detail-btn-row")).toBeVisible();
});

test("title translation uses native fetch instead of the GM transport", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers translation transport");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { translateTitle: "yes" }, nativeTranslation: "即时译文" });
  await expect(page.locator(".translated-title")).toHaveText("即时译文");
  const diagnostics = await page.evaluate(() => window.__jhsBrowserDiagnostics);
  expect(diagnostics.nativeTranslationRequests).toBe(1);
  expect(diagnostics.requests.some((request) => request.url.includes("translate-pa.googleapis.com"))).toBe(false);
});

test("captured detail ownership survives detached controls, iframe isolation, and legacy boolean settings", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers detail close ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const result = await page.evaluate(async () => {
    await window.settingsService.set("needClosePage", true);
    const layerIndex = window.layer.open({ type: 1, content: '<button id="offline-close-fixture">离线</button>' });
    const button = document.querySelector("#offline-close-fixture");
    const capturedLayerIndex = window.utils.getOwningLayerIndex({ root: button });
    button.remove();
    const closed = await window.utils.closePage({ root: button, layerIndex: capturedLayerIndex });
    return { layerIndex, capturedLayerIndex, closed, remaining: document.querySelectorAll(".layui-layer").length };
  });
  expect(result).toEqual({ layerIndex: 1, capturedLayerIndex: 1, closed: true, remaining: 0 });

  const iframeNavigation = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame.url().includes("jhs-close-frame=1"),
  });
  await page.evaluate(() => {
    window.utils.openPage("https://javdb.com/v/test-id?jhs-close-frame=1", "ABC-1");
  });
  const detailFrame = await iframeNavigation;
  const iframeLayerIndex = await page.locator('.layui-layer:has(iframe[src*="jhs-close-frame=1"])').evaluate((element) => Number(element.dataset.layerId));
  await injectUserscriptRuntime(detailFrame);
  await detailFrame.evaluate(() => window.settingsService.set("needClosePage", true));
  await detailFrame.evaluate(async () => {
    const registry = window.offlineProviderRegistry;
    if (!registry) throw new Error("Unified offline registry was not initialized");
    const button = document.createElement("button");
    button.className = "jhs-offline-btn";
    button.dataset.resource = "magnet:?xt=urn:btih:fixture";
    button.textContent = "离线";
    document.body.append(button);
    registry.getCandidates = async () => [
      {
        provider: { id: "123", name: "123 云盘", submit: async () => ({ ok: true }) },
        availability: { authState: "ready" },
      },
    ];
    registry.updateAvailability = () => {};
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await detailFrame.locator(".layui-layer-btn0").click();
  await expect(page.locator(`#layui-layer${iframeLayerIndex}`)).toHaveCount(0);
});

test("FC2 core workspace survives disabled optional detail contributions", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers FC2 optional contribution isolation");
  await fulfillHostFixtures(context);
  const disabledPlugins = ["OtherSitePlugin", "ScreenShotPlugin", "FilterTitleKeywordPlugin", "MagnetHubPlugin"];
  await page.goto("https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins });
  await expect(page.locator(".jhs-fc2-workspace[data-jhs-fc2-mode='page']")).toBeVisible();
  const pluginNames = await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames());
  disabledPlugins.forEach((name) => expect(pluginNames).not.toContain(name));
  await expect(page.locator('[data-jhs-role="other-sites"]')).toHaveCount(0);
  await expect(page.locator('[data-jhs-role="magnet-hub"]')).toHaveCount(0);
});
