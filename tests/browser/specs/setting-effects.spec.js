import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("feature disabled leaves no dead list button", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers capability rendering");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["NewVideoPlugin", "BlacklistPlugin"] });
  await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
  await expect(page.locator("#newVideoBtn")).toHaveCount(0);
  await expect(page.locator("#blacklistBtn")).toHaveCount(0);
  await expect(page.locator("#jhs-library-blacklist-feature")).toHaveCount(0);
  await expect(page.locator("#waitCheckBtn")).toHaveCount(1);
});

test("third-party and copy card actions follow their live settings", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the list-card site/copy switches");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableSiteSvg: "yes", enableCopySvg: "yes" } });
  await expect(page.locator(".siteSvg").first()).toHaveCSS("display", "block");
  await expect(page.locator(".copySvg").first()).toHaveCSS("display", "block");

  await page.evaluate(async () => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    await settings.set("enableSiteSvg", "no");
    await settings.set("enableCopySvg", "no");
  });
  await expect(page.locator(".siteSvg").first()).toHaveCSS("display", "none");
  await expect(page.locator(".copySvg").first()).toHaveCSS("display", "none");

  await page.evaluate(async () => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    await settings.set("enableSiteSvg", "yes");
    await settings.set("enableCopySvg", "yes");
  });
  await expect(page.locator(".siteSvg").first()).toHaveCSS("display", "block");
  await expect(page.locator(".copySvg").first()).toHaveCSS("display", "block");
});

test("DMM-only card video button follows its switch and preview prerequisites", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the list-card DMM button switches");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableVideoSvg: "yes", enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes" } });
  const videoButton = page.locator(".videoSvg").first();
  await expect(videoButton).toHaveCSS("display", "flex");

  await page.evaluate(async () => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    await settings.set("enableVideoSvg", "no");
  });
  await expect(videoButton).toHaveCSS("display", "none");
  await page.evaluate(async () => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    await settings.set("enableVideoSvg", "yes");
  });
  await expect(videoButton).toHaveCSS("display", "flex");

  await page.evaluate(async () => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    await settings.set("enablePreviewVideo", "no");
  });
  await expect(videoButton).toHaveCSS("display", "none");
  await page.evaluate(async () => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    await settings.set("enablePreviewVideo", "yes");
    await settings.set("enableLoadPreviewVideo", "no");
  });
  await expect(videoButton).toHaveCSS("display", "none");
  await page.evaluate(async () => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    await settings.set("enableLoadPreviewVideo", "yes");
  });
  await expect(videoButton).toHaveCSS("display", "flex");
});

test("Library Feature owns blacklist behavior without registering the legacy plugin", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers blacklist runtime ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const ownership = await page.evaluate(() => {
    const manager = window.unsafeWindow.pluginManager;
    return {
      style: document.getElementById("jhs-library-blacklist-feature")?.textContent.includes(".jhs-blacklist-layout") ?? false,
      contribution: manager.diagnostics.exportSnapshot().activeContributions.includes("library.blacklist"),
      legacyExecutor: manager.getPluginNames().includes("BlacklistPlugin"),
      compatibilityFacade: typeof manager.getBean("BlacklistPlugin")?.addBlacklist === "function",
      runtimeStatus: manager.getTimings().find(({ name }) => name === "BlacklistPlugin")?.status ?? null,
    };
  });
  expect(ownership).toEqual({ style: true, contribution: true, legacyExecutor: false, compatibilityFacade: true, runtimeStatus: null });
});

test("Library Feature owns the blacklist workspace filter and actor deletion flow", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the blacklist workspace");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
  const starId = "feature-blacklist-workspace-actor";
  await page.evaluate(async ({ starId }) => {
    await window.unsafeWindow.storageManager.addBlacklistItem({
      starId, name: "Synthetic Workspace Actor", allName: ["Workspace Alias"], role: "actor", movieType: "censored",
      url: "https://javdb.com/actors/workspace-actor?t=censored", createTime: "2026-09-27", lastPublishTime: "2026-09-20",
    });
  }, { starId });

  await page.locator(".jhs-commandbar__more .jhs-commandbar__menu-toggle").click();
  await page.locator("#blacklistBtn").click();
  await expect(page.locator(".jhs-blacklist-layout")).toBeVisible();
  await expect(page.locator("#checkBlacklistBtn")).toBeVisible();
  await expect(page.locator(".tabulator-row", { hasText: "Synthetic Workspace Actor" })).toHaveCount(1);
  await page.locator("#searchValue").fill("Workspace Alias");
  await expect(page.locator(".tabulator-row", { hasText: "Synthetic Workspace Actor" })).toHaveCount(1);
  await page.locator("#searchValue").fill("no-such-blacklist-actor");
  await expect(page.locator(".tabulator-row")).toHaveCount(0);
  await expect(page.locator("#table-container")).toContainText("没有符合当前筛选条件的黑名单记录");
  await page.locator("#searchValue").fill("");
  const row = page.locator(".tabulator-row", { hasText: "Synthetic Workspace Actor" });
  await row.locator(".delete-btn").click();
  await page.locator(".layui-layer-btn0").last().click();
  await expect.poll(() => page.evaluate(async ({ starId }) => (await window.unsafeWindow.storageManager.getBlacklist()).some(item => item.starId === starId), { starId })).toBe(false);
  await expect(page.locator(".tabulator-row", { hasText: "Synthetic Workspace Actor" })).toHaveCount(0);
});

test("actor blacklist confirmation renders escaped names and stores the current page result", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers blacklist actor entry and real HTML rendering");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/actors/feature-blacklist-add?sort_type=1&page=2&t=d", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const list = document.querySelector(".movie-list");
    if (!list) throw new Error("JavDB actor movie-list fixture is missing");
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const actorName = document.createElement("h2");
    actorName.className = "actor-section-name";
    actorName.textContent = 'Actor <img id="blacklist-injection" src=x onerror="window.__blacklistInjected=true">';
    toolbar.append(actorName);
    const role = document.createElement("div");
    role.className = "section-meta";
    role.textContent = "男優";
    toolbar.append(role);
    const type = document.createElement("div");
    type.className = "section-meta";
    type.textContent = "無碼";
    toolbar.append(type);
    list.before(toolbar);
    list.replaceChildren();
    const card = document.createElement("div");
    card.className = "item";
    const link = document.createElement("a");
    link.href = "/v/blacklist-entry-synthetic";
    const title = document.createElement("div");
    title.className = "video-title";
    const code = document.createElement("strong");
    code.textContent = "BLACKLIST-ENTRY-001";
    title.append(code, document.createTextNode(" Synthetic blacklist entry"));
    const date = document.createElement("div");
    date.className = "meta";
    date.textContent = "2026-09-27";
    link.append(title, date);
    card.append(link);
    list.append(card);
    document.querySelector(".pagination-next")?.remove();
  });
  await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
  await page.addScriptTag({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });

  await expect(page.locator("#addBlacklistBtn")).toBeVisible();
  await page.locator("#addBlacklistBtn").click();
  const dialog = page.locator(".layui-layer-dialog");
  await expect(dialog).toBeVisible();
  const renderedPrompt = await dialog.evaluate((element) => ({
    injectedNode: Boolean(element.querySelector("#blacklist-injection")),
    message: element.textContent,
  }));
  expect(renderedPrompt.injectedNode).toBe(false);
  expect(renderedPrompt.message).toContain('<img id="blacklist-injection"');
  expect(renderedPrompt.message).toContain("当前页面非第一页");
  await dialog.locator(".layui-layer-btn0").click();
  await expect.poll(() => page.evaluate(async () => {
    const actors = await window.unsafeWindow.storageManager.getBlacklist();
    const cars = await window.unsafeWindow.storageManager.getBlacklistCarList();
    return {
      actor: actors.find((item) => item.starId === "feature-blacklist-add"),
      car: cars.find((item) => item.carNum === "BLACKLIST-ENTRY-001"),
    };
  })).toMatchObject({
    actor: { name: 'Actor <img id="blacklist-injection" src=x onerror="window.__blacklistInjected=true">', role: "actor", movieType: "uncensored", url: "https://javdb.com/actors/feature-blacklist-add?t=d" },
    car: { names: 'Actor <img id="blacklist-injection" src=x onerror="window.__blacklistInjected=true">', status: "filter", starId: "feature-blacklist-add" },
  });
  expect(await page.evaluate(() => window.__blacklistInjected === true)).toBe(false);
});

test("tag blacklist confirmation renders external category text with real Layer", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the category confirmation sink");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/tags?tag=14", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const tag = document.createElement("span");
    tag.id = "jhs-check-tag";
    tag.textContent = '<img id="category-injection" src=x onerror="window.__categoryInjected=true">';
    document.querySelector("main")?.prepend(tag);
  });
  await injectUserscriptRuntime(page, { settingOverrides: { enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" } });
  await page.addScriptTag({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });

  await expect(page.locator("#addBlacklistBtn")).toBeVisible();
  await page.locator("#addBlacklistBtn").click();
  const dialog = page.locator(".layui-layer-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#category-injection")).toHaveCount(0);
  await expect(dialog).toContainText('<img id="category-injection" src=x onerror="window.__categoryInjected=true">');
  expect(await page.evaluate(() => window.__categoryInjected === true)).toBe(false);
  await dialog.locator(".layui-layer-btn1").click();
  await expect(dialog).toHaveCount(0);
});

test("screenshot master switch OFF removes detail screenshot UI", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers screenshot gating");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const preview = document.createElement("div");
    preview.className = "preview-images";
    const anchor = document.createElement("a");
    anchor.className = "tile-item";
    anchor.href = "#fixture";
    anchor.textContent = "原生图片";
    preview.append(anchor);
    document.querySelector("main")?.append(preview);
  });
  await injectUserscriptRuntime(page);
  await expect(page.locator(".screen-container")).toHaveCount(1);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ScreenShotPlugin"))).toBeUndefined();
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(item => item.name === "ScreenShotPlugin"))).toBe(true);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadScreenShot", "no"));
  await page.waitForTimeout(300);
  await expect(page.locator(".screen-container")).toHaveCount(0);
  await expect(page.locator(".jhs-screenshot-providers")).toHaveCount(0);
});

test("legacy screenshot disable ID suppresses detail and card screenshot entry points", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers screenshot compatibility gating");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const preview = document.createElement("div");
    preview.className = "preview-images";
    const anchor = document.createElement("a");
    anchor.className = "tile-item";
    preview.append(anchor);
    document.querySelector("main")?.append(preview);
  });
  await injectUserscriptRuntime(page, { disabledPlugins: ["ScreenShotPlugin"] });
  await expect(page.locator(".screen-container")).toHaveCount(0);
  await page.close();

  const listPage = await context.newPage();
  await listPage.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(listPage, { disabledPlugins: ["ScreenShotPlugin"] });
  const screenshotAction = listPage.locator(".screenSvg").first();
  await expect(screenshotAction).toHaveCount(1);
  await expect(screenshotAction).toBeHidden();
});

test("review defaults ON and explicit OFF closes the panel", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers review default and explicit opt-out");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const reviewToggle = page.locator(".jhs-review-toggle").first();
  await expect(reviewToggle).toHaveAttribute("aria-expanded", "true");
  await page.close();
  const closedPage = await context.newPage();
  await closedPage.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(closedPage, { settingOverrides: { enableLoadReview: "no" } });
  await expect(closedPage.locator(".jhs-review-toggle").first()).toHaveAttribute("aria-expanded", "false");
  await closedPage.close();
});

test("preview master switch OFF removes card preview buttons", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers preview gating");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enablePreviewVideo", "no"));
  await page.waitForTimeout(300);
  await expect(page.locator(".videoSvg")).toBeHidden(); // 实现为 toggle(false) 隐藏，语义：列表工具按钮隐藏而非 unmount
});

test("all quick filter is the true full set including blocked items", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers frozen filter semantics");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  if (process.env.JHS_TEST_BUNDLE_PATH) {
    await expect.poll(() => page.evaluate(() => {
      const listPage = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
      return typeof listPage?.setQuickFilter === "function" && typeof listPage?.findCarNumAndHref === "function";
    })).toBe(true);
  } else {
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true)).toBe(true);
  }
  await page.evaluate(async () => {
    const listPage = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
    const item = document.querySelector(".movie-list .item");
    const { carNum, url } = listPage.findCarNumAndHref(window.$ ? window.$(item) : null);
    await window.stateService.patch(carNum, { blocked: true }, { type: "browser-setting-effect", record: { carNum, url, names: "", publishTime: "" } });
  });
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").setQuickFilter("all"));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".movie-list .item")).display)).not.toBe("none");
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").setQuickFilter("favorite"));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".movie-list .item")).display)).toBe("none");
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin").setQuickFilter("blockedItems"));
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".movie-list .item")).display)).not.toBe("none");
});

test("quick-filter and DOM generations reject stale filter commits", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project owns the list generation stress check");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(async () => {
    const listPage = window.unsafeWindow.pluginManager.getBean("ListPagePlugin");
    const originalGetFilterContext = listPage.getFilterContext.bind(listPage);
    for (let index = 0; index < 50; index += 1) {
      const context = listPage.filterContext || await originalGetFilterContext();
      let release;
      listPage.filterContext = null;
      listPage.getFilterContext = () => new Promise((resolve) => { release = resolve; });
      const pending = listPage.doFilter(listPage.captureListRevision());
      index % 2 && listPage.advanceListGeneration();
      listPage.setQuickFilter(index % 2 ? "favorite" : "blockedItems");
      release(context);
      listPage.filterContext = context;
      await pending;
    }
    listPage.getFilterContext = originalGetFilterContext;
    listPage.setQuickFilter("all");
    await listPage.requestListRefresh({ reason: "stress-final", full: true });
    return window.__jhsBrowserDiagnostics.listPhases || [];
  });
  const phases = await page.evaluate(() => window.__jhsBrowserDiagnostics.listPhases || []);
  expect(phases.some(({ phase }) => phase === "doFilter-start")).toBe(true);
  expect(phases.some(({ phase }) => phase === "doFilter-end")).toBe(true);
  expect(phases.some(({ phase }) => phase === "setQuickFilter")).toBe(true);
  expect(phases.every(({ generation, filterRevision, activeQuickFilter, itemCount }) => Number.isInteger(generation) && Number.isInteger(filterRevision) && typeof activeQuickFilter === "string" && Number.isInteger(itemCount))).toBe(true);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".movie-list .item")).display)).not.toBe("none");
});


test("mobileMode force on/off swaps FAB and the desktop commandbar/setting surfaces", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers mobileMode live layout");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#jhs-fab")).toHaveCount(0);
  await expect(page.locator("#jhs-page-commandbar")).toHaveCount(1);
  await expect(page.locator("#setting-btn")).toHaveCount(1);
  const toolbarSelectors = ["#waitCheckBtn", "#newVideoBtn", "#jhs-quick-filter", ".jhs-sort-control", "#favoriteAllVideo", "#hasDownAllVideo"];
  for (const selector of toolbarSelectors) await expect(page.locator(selector)).toHaveCount(1);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("mobileMode", "on"));
  await expect(page.locator("#jhs-fab")).toBeVisible();
  await expect(page.locator("#jhs-fab-safe-area")).toHaveCount(1);
  await expect(page.locator("html")).toHaveClass(/jhs-fab-mounted/);
  await expect(page.locator("#jhs-page-commandbar")).toHaveCount(0);
  await expect(page.locator("#setting-btn")).toHaveCount(0);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("mobileMode", "off"));
  await expect(page.locator("#jhs-fab")).toHaveCount(0);
  await expect(page.locator("#jhs-fab-safe-area")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/jhs-fab-mounted/);
  await expect(page.locator("#jhs-page-commandbar")).toHaveCount(1);
  await expect(page.locator("#setting-btn")).toHaveCount(1);
  for (const selector of toolbarSelectors) await expect(page.locator(selector)).toHaveCount(1);
  // 真实 click 验证 handler 在切换后仍然有效。
  await page.evaluate(() => {
    window.__waitCheckClicks = 0;
    const plugin = window.unsafeWindow.pluginManager.getBean("ListPageButtonPlugin");
    plugin.openWaitCheck = async () => { window.__waitCheckClicks++; };
  });
  await page.locator("#waitCheckBtn").click();
  await expect.poll(() => page.evaluate(() => window.__waitCheckClicks)).toBe(1);
});

test("JavBus desktop toolbar keeps settings and history beside list actions across compact mode", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers JavBus desktop toolbar ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no" } });
  await page.waitForFunction(() => Boolean(window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]));

  const assertDesktopToolbar = async () => {
    await expect(page.locator(".jhs-commandbar__primary #waitCheckBtn")).toHaveCount(1);
    await expect(page.locator(".jhs-commandbar__primary #top-right-box")).toHaveCount(1);
    await expect(page.locator("#top-right-box #historyBtn")).toHaveCount(1);
    const positions = await page.evaluate(() => ["#waitCheckBtn", "#top-right-box", "#historyBtn"].map((selector) => Math.round(document.querySelector(selector).getBoundingClientRect().y)));
    expect(new Set(positions).size).toBe(1);
  };

  await assertDesktopToolbar();
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("mobileMode", "on"));
  await expect(page.locator("#jhs-fab")).toBeVisible();
  await expect(page.locator("#historyBtn, #top-right-box")).toHaveCount(0);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("mobileMode", "off"));
  await expect(page.locator("#jhs-page-commandbar")).toHaveCount(1);
  await expect(page.locator("#historyBtn")).toHaveCount(1, { timeout: 5000 });
  await assertDesktopToolbar();
});

test("search list pages get batch favorite/download buttons without an actress name", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers search batch entries");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/search?q=test", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
  await expect(page.locator("#favoriteAllVideo")).toHaveCount(1);
  await expect(page.locator("#hasDownAllVideo")).toHaveCount(1);
  // 搜索页不渲染演员专用的批量屏蔽入口。
  await expect(page.locator("#addBlacklistBtn")).toHaveCount(0);
});

test("Preview master ON + DMM OFF leaves no DMM-only card button", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers preview capability gating");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const setSetting = (key, value) => page.evaluate(({ key, value }) => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set(key, value), { key, value });
  // fixture 卡片带隐藏 .tags 宿主，卡片工具可被创建；DMM OFF 时按钮隐藏，ON 时恢复。
  await expect(page.locator(".videoSvg")).toHaveCount(1);
  await setSetting("enableLoadPreviewVideo", "no");
  await page.waitForTimeout(300);
  await expect(page.locator(".videoSvg")).toBeHidden();
  await setSetting("enableLoadPreviewVideo", "yes");
  await page.waitForTimeout(300);
  await expect(page.locator(".videoSvg")).toHaveCount(1);
  const display = await page.locator(".videoSvg").first().evaluate((element) => getComputedStyle(element).display);
  expect(display).not.toBe("none");
});

test("JavBus preview is native Feature-owned and disappears when the DMM sub switch is OFF", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers JavBus preview capability");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/ABC-123", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.waitForFunction(() => Boolean(window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]));
  const previewOwnership = await page.evaluate(() => {
    const manager = window.unsafeWindow.pluginManager;
    return {
      registered: manager.getPluginNames().includes("BusPreviewVideoPlugin"),
      managedByFeature: manager.getBean("BusPreviewVideoPlugin")?.managedByFeature === true,
      timing: manager.getTimings().find(item => item.name === "BusPreviewVideoPlugin")?.status ?? null,
      route: window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"] != null ? window.isDetailPage : null,
    };
  });
  expect(previewOwnership).toEqual({ registered: false, managedByFeature: false, timing: null, route: true });
  await expect(page.locator(".preview-video-container")).toHaveCount(1);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadPreviewVideo", "no"));
  await page.waitForTimeout(300);
  await expect(page.locator(".preview-video-container")).toHaveCount(0);
});

test("FC2 OtherSite slot survives OFF→ON toggles", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers FC2 stable slots");
  await fulfillHostFixtures(context);
  const url = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const slot = page.locator('[data-jhs-role="other-sites"]');
  const group = page.locator('.jhs-fc2-resource-group:has([data-jhs-role="other-sites"])');
  const ownership = await page.evaluate(() => {
    const manager = window.unsafeWindow.pluginManager;
    const controller = manager.getBean("OtherSitePlugin");
    const fc2 = manager.getBean("Fc2Plugin");
    return {
      controller: controller?.managedByFeature === true && typeof controller.loadOtherSite === "function" && typeof controller.handle === "undefined",
      fc2Injected: fc2?.featureExternalSitesAdapter === controller,
      noLegacyExecutor: !manager.getPluginNames().includes("OtherSitePlugin"),
      noLegacyTiming: !manager.getTimings().some((item) => item.name === "OtherSitePlugin"),
    };
  });
  expect(ownership).toEqual({ controller: true, fc2Injected: true, noLegacyExecutor: true, noLegacyTiming: true });
  const setOtherSite = (value) => page.evaluate((v) => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadOtherSite", v), value);
  await expect(slot).toHaveCount(1);
  await expect(group).toBeVisible();
  await setOtherSite("no");
  await expect(slot).toHaveCount(1);
  await expect(group).toBeHidden();
  await setOtherSite("yes");
  await expect(slot).toHaveCount(1);
  await expect(group).toBeVisible();
  await setOtherSite("no");
  await expect(slot).toHaveCount(1);
  await setOtherSite("yes");
  await expect(slot).toHaveCount(1);
  await expect(group).toBeVisible();
});

test("batch actions are single-flight while a batch is running", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers batch single flight");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["AutoPagePlugin"], beforeUserscriptInjection: (targetPage) => targetPage.evaluate(() => {
    const originalRequest = window.GM_xmlhttpRequest;
    window.__httpCalls = 0;
    window.__releaseBatch = null;
    window.__captureBatchHttp = false;
    window.GM_xmlhttpRequest = (options) => {
      if (window.__captureBatchHttp && new URL(String(options.url), window.location.href).pathname === "/page/2") {
        window.__httpCalls++;
        window.__releaseBatch = (response) => options.onload?.({ status: 200, response: response?.data ?? "", responseText: response?.data ?? "", finalUrl: options.url });
        return { abort: () => options.onabort?.() };
      }
      return originalRequest(options);
    };
  }) });
  await page.evaluate(() => { window.__captureBatchHttp = true; });
  const batchToggle = ".jhs-commandbar__batch .jhs-commandbar__menu-toggle";
  await page.locator(batchToggle).click();
  await page.locator("#favoriteAllVideo").click();
  await page.evaluate(() => document.querySelector(".layui-layer-btn0").click());
  await expect(page.locator("#jhs-batch-progress")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__httpCalls)).toBe(1);
  // 批量任务期间 loading 遮罩会拦截指针事件：用原生 click 验证 Single Flight 拒绝第二个任务。
  await page.evaluate(() => document.querySelector(".jhs-commandbar__batch .jhs-commandbar__menu-toggle").click());
  await page.evaluate(() => document.querySelector("#hasDownAllVideo").click());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__httpCalls)).toBe(1);
  // 释放第一个任务，进度浮层消失、按钮恢复。
  await page.evaluate(() => window.__releaseBatch?.({ data: "" }));
  await expect(page.locator("#jhs-batch-progress")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator("#favoriteAllVideo")).not.toHaveAttribute("aria-disabled", "true");
});

test("FC2 detail screenshot slot follows the master switch live", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers FC2 screenshot lifecycle");
  await fulfillHostFixtures(context);
  const url = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await expect(page.locator(".jhs-fc2-workspace")).toBeVisible();
  await expect(page.locator('[data-jhs-role="screenshot"]')).toHaveCount(1);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadScreenShot", "no"));
  await expect(page.locator('[data-jhs-role="screenshot"]')).toBeEmpty();
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("enableLoadScreenShot", "yes"));
  await expect(page.locator('[data-jhs-role="screenshot"]')).not.toBeEmpty();
});

test("cloud settings use the canonical catalog and persist normalized numeric values", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the cloud settings catalog");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const openCloud = async () => {
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    await expect(page.locator(".layui-layer #saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    await page.locator('.layui-layer .side-menu-item[data-panel="cloud-services-panel"]').click();
    await expect(page.locator(".layui-layer #cloud-settings-catalog")).toBeVisible();
  };
  await openCloud();
  await expect(page.locator(".layui-layer #cloud-settings-catalog .jhs-setting-row")).toHaveCount(7);
  await page.locator(".layui-layer #oneOneFiveConcurrency").fill("99");
  await page.locator(".layui-layer #oneOneFiveConcurrency").press("Tab");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().oneOneFiveConcurrency)).toBe(10);
  await page.locator(".layui-layer #oneOneFiveCacheMinutes").fill("4.8");
  await page.locator(".layui-layer #oneOneFiveCacheMinutes").press("Tab");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().oneOneFiveCacheMinutes)).toBe(5);
  await page.evaluate(() => window.layer.closeAll());
  await expect(page.locator(".layui-layer")).toHaveCount(0);
  await openCloud();
  await expect(page.locator(".layui-layer #oneOneFiveConcurrency")).toHaveValue("10");
  await expect(page.locator(".layui-layer #oneOneFiveCacheMinutes")).toHaveValue("5");
});
