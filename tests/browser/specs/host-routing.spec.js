import { expect, test } from "@playwright/test";
import budget from "../../../performance-budget.json" with { type: "json" };
import { assertNoHorizontalOverflow, fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

for (const [label, url, legacyPlugin, legacyExecutorExpected] of [
  ["JavDB", "https://javdb.com/v/test-id", "DetailPagePlugin", false],
  ["JavBus", "https://www.javbus.com/ABC-123", "BusDetailPagePlugin", false]
]) {
  test(`${label} uses the real host origin with local fixtures`, async ({ context, page }) => {
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    // 本用例只验证宿主路由和零请求启动预算；评论默认开启的行为由专门设置/单元回归覆盖。
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no", enablePreviewVideo: "no", enableLoadPreviewVideo: "no" } });
    await expect.poll(() => page.evaluate(({ name, expected }) => Boolean(window.unsafeWindow.pluginManager.getBean(name)) === expected, { name: legacyPlugin, expected: legacyExecutorExpected })).toBe(true);
    expect(await page.evaluate((name) => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name: descriptor }) => descriptor === name), legacyPlugin)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--jhs-accent").trim()), "Bootstrap must inject the core theme tokens").not.toBe("");
    await expect(page.locator("body")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.waitForTimeout(250);
    const initialRequests = await page.evaluate(() => window.__jhsBrowserDiagnostics.requests);
    expect(initialRequests.length, `deterministic fixture startup request budget: ${JSON.stringify(initialRequests)}`).toBeLessThanOrEqual(budget.browserFixture.maximumInitialRequests[label]);
  });
}

test("JavBus native page actions are Feature-owned and retain the legacy disable setting", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers JavBus native page ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/ABC-123", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { window.__copiedText = text; } } });
    [...document.querySelectorAll("span.header")].find((label) => label.textContent?.trim() === "識別碼:")?.parentElement?.remove();
    document.body.insertAdjacentHTML("beforeend", '<h4>推薦影片</h4><div class="genre"><a id="bus-genre" href="https://example.test/genre">类型</a></div><p><span class="header">識別碼:</span><span>ABC-123</span></p>');
  });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#bus-genre")).toHaveAttribute("target", "_blank");
  await expect(page.locator("h4")).toHaveCSS("display", "none");
  await expect(page.locator(".jhs-copy-car-number")).toHaveCount(1);
  await page.getByRole("button", { name: "复制" }).click();
  await expect.poll(() => page.evaluate(() => window.__copiedText)).toBe("ABC-123");
  await expect(page.locator(".jhs-copy-car-number")).toHaveText("已复制");
  const manager = await page.evaluate(() => ({
    names: window.unsafeWindow.pluginManager.getPluginNames(),
    descriptors: window.unsafeWindow.pluginManager.getPluginDescriptors(),
  }));
  expect(manager.names).not.toContain("BusDetailPagePlugin");
  expect(manager.descriptors).toContainEqual({ name: "BusDetailPagePlugin", disableable: true });

  const disabledPage = await context.newPage();
  await disabledPage.goto("https://www.javbus.com/ABC-123", { waitUntil: "domcontentloaded" });
  await disabledPage.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<h4>推薦影片</h4><div class="genre"><a id="bus-genre-disabled" href="https://example.test/genre">类型</a></div><p><span class="header">識別碼:</span><span>ABC-123</span></p>'));
  await injectUserscriptRuntime(disabledPage, { disabledPlugins: ["BusDetailPagePlugin"] });
  await expect(disabledPage.locator("#bus-genre-disabled")).not.toHaveAttribute("target", "_blank");
  await expect(disabledPage.locator("h4")).not.toHaveCSS("display", "none");
  await expect(disabledPage.locator(".jhs-copy-car-number")).toHaveCount(0);
  await disabledPage.close();
});

test("JavDB detail external links preserve HTTP(S) targets and the legacy disable setting", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the detail-link contribution");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await page.locator(".video-meta-panel").evaluate((root) => {
    root.insertAdjacentHTML("beforeend", '<a id="external-http" href="https://example.test/actor">external</a><a id="external-relative" href="/actors/fixture">relative</a><a id="external-mail" href="mailto:actor@example.test">mail</a>');
  });
  await injectUserscriptRuntime(page);
  await expect(page.locator("#external-http")).toHaveAttribute("target", "_blank");
  await expect(page.locator("#external-relative")).toHaveAttribute("target", "_blank");
  await expect(page.locator("#external-mail")).not.toHaveAttribute("target", "_blank");

  const disabledPage = await context.newPage();
  await disabledPage.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await disabledPage.locator(".video-meta-panel").evaluate((root) => {
    root.insertAdjacentHTML("beforeend", '<a id="external-disabled" href="https://example.test/actor">external</a>');
  });
  await injectUserscriptRuntime(disabledPage, { disabledPlugins: ["DetailPagePlugin"] });
  await expect(disabledPage.locator("#external-disabled")).not.toHaveAttribute("target", "_blank");
  await disabledPage.close();
});

test("Detail Feature owns the SubtitleCat entry and retains modified-click and disable-key behavior", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers detail subtitle navigation");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id?hideNav=1&jhsCarNum=ABC-123", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => {
    window.__subtitleOpens = [];
    window.utils.openPage = (url, carNum, newTab, event) => window.__subtitleOpens.push({ url, carNum, newTab, ctrlKey: Boolean(event?.ctrlKey) });
  });
  await page.locator("#search-subtitle-btn").click({ modifiers: ["Control"] });
  await expect.poll(() => page.evaluate(() => window.__subtitleOpens)).toEqual([{
    url: "https://subtitlecat.com/index.php?search=ABC-123", carNum: "ABC-123", newTab: false, ctrlKey: true,
  }]);

  const disabledPage = await context.newPage();
  await disabledPage.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(disabledPage, { disabledPlugins: ["DetailPageButtonPlugin"] });
  await expect(disabledPage.locator("#search-subtitle-btn")).toHaveCount(0);
  await expect.poll(() => disabledPage.evaluate(() => window.unsafeWindow.pluginManager.diagnostics.exportSnapshot().activeContributions)).not.toContain("detail.page-state-actions");
  await disabledPage.close();
});

for (const [label, url] of [
  ["JavDB", "https://javdb.com/"],
  ["JavBus", "https://www.javbus.com/"]
]) {
  test(`${label} list route uses its HostAdapter and list runtime`, async ({ context, page }, testInfo) => {
    await fulfillHostFixtures(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await expect.poll(() => page.evaluate(() => window.isListPage)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true)).toBe(true);
    await expect(page.locator(label === "JavDB" ? ".movie-list .item" : ".masonry .movie-box")).toHaveCount(1);
    if (testInfo.project.name.startsWith("mobile")) {
      await expect(page.locator("#jhs-fab")).toBeVisible();
      await expect(page.locator("#jhs-fab-menu .jhs-mobile-filter-menu")).toHaveCount(1);
    } else await expect(page.locator("#jhs-quick-filter")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
}

test("legacy disabled plugin migrates to one contribution only", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers storage migration");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["ReviewPlugin"] });
  const state = await page.evaluate(() => {
    const manager = window.unsafeWindow.pluginManager;
    return {
      pluginNames: manager.getPluginNames(),
      descriptors: manager.getPluginDescriptors(),
      reviewBean: manager.getBean("ReviewPlugin"),
      relatedManaged: manager.getBean("RelatedPlugin")?.managedByFeature === true,
      activeContributions: manager.diagnostics.exportSnapshot().activeContributions,
      relatedService: Boolean(manager.getBean("RelatedPlugin")?.getRuntimeService("related")),
    };
  });
  expect(state.pluginNames).not.toContain("ReviewPlugin");
  expect(state.pluginNames).not.toContain("RelatedPlugin");
  expect(state.reviewBean).toBeUndefined();
  expect(state.relatedManaged).toBe(true);
  expect(state.descriptors).toContainEqual({ name: "ReviewPlugin", disableable: true });
  expect(state.activeContributions).not.toContain("detail.reviews");
  expect(state.activeContributions).toContain("detail.related");
  expect(state.relatedService).toBe(true);
  expect(state.pluginNames).not.toContain("DetailWorkspacePlugin");
  const descriptors = await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors());
  expect(descriptors).toContainEqual({ name: "DetailWorkspacePlugin", disableable: true });
});

test("DetailWorkspacePlugin disable key skips only the native workspace and preserves the host fallback", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the legacy workspace disable key");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await page.locator(".video-meta-panel").evaluate((root) => root.insertAdjacentHTML("afterend", '<div class="tabs"></div>'));
  await injectUserscriptRuntime(page, { disabledPlugins: ["DetailWorkspacePlugin"], settingOverrides: { enableLoadReview: "no" } });
  await expect(page.locator("main .jhs-detail-host-workspace")).toHaveCount(0);
  await expect(page.locator(".tabs + .jhs-detail-btn-row")).toBeVisible();
  const manager = await page.evaluate(() => ({
    names: window.unsafeWindow.pluginManager.getPluginNames(),
    descriptors: window.unsafeWindow.pluginManager.getPluginDescriptors(),
    listCompatibilityOwner: window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true,
  }));
  expect(manager.names).not.toContain("DetailWorkspacePlugin");
  expect(manager.descriptors).toContainEqual({ name: "DetailWorkspacePlugin", disableable: true });
});

test("the legacy FC2 navigation disable ID stays attached to List Feature", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the legacy FC2 disable key");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/search_advanced?type=3", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { disabledPlugins: ["Fc2NavigationPlugin"] });
  await expect(page.locator(".movie-list .item")).toHaveCount(1);
  await expect(page.locator('.movie-list .item[data-jhs-fc2-protected="true"]')).toHaveCount(0);
  const manager = await page.evaluate(() => ({
    names: window.unsafeWindow.pluginManager.getPluginNames(),
    descriptors: window.unsafeWindow.pluginManager.getPluginDescriptors(),
    listCompatibilityOwner: window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true,
  }));
  expect(manager.names).not.toContain("Fc2NavigationPlugin");
  expect(manager.descriptors).toContainEqual({ name: "Fc2NavigationPlugin", disableable: true });
  expect(manager.names).not.toContain("ListPagePlugin");
  expect(manager.listCompatibilityOwner).toBe(true);
});

test("FC2 cards keep dialog navigation and use owned-page anchor fallback", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers navigation semantics");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/search_advanced?type=3", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames())).not.toContain("Fc2NavigationPlugin");
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors())).toContainEqual({ name: "Fc2NavigationPlugin", disableable: true });
  await expect.poll(() => page.locator(".movie-list .item").getAttribute("data-jhs-fc2-protected")).toBe("true");
  const primary = page.locator('.movie-list .item a[data-jhs-fc2-primary="true"]');
  const href = await primary.getAttribute("href");
  expect(href).toBe("/v/vip-fc2-placeholder");
  expect(await primary.getAttribute("data-jhs-fc2-primary")).toBe("true");
  await expect(page.locator(".movie-list .item .tags a").first()).toHaveAttribute("href", "/actors/fixture-actor");
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
  await page.evaluate(() => { window.__jhsFc2Navigation = null; document.querySelector(".movie-list .item a[data-jhs-fc2-primary]").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })); });
  await expect.poll(() => page.evaluate(() => window.__jhsFc2Navigation?.mode)).toBe("dialog");
  const ownedUrl = new URL("/users/collection_codes", page.url());
  ownedUrl.searchParams.set("movieId", "fixture-id");
  ownedUrl.searchParams.set("carNum", "FC2-PPV-4959150");
  ownedUrl.searchParams.set("url", href);
  ownedUrl.searchParams.set("source", "fc2");
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
  await expect(page.locator(".movie-list .item")).toHaveCount(1);
  await expect(page.locator(".movie-list .item .jhs-cover-tools")).toHaveCount(0);
  const coverCompatibility = await page.evaluate(() => ({
    listMounted: window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true,
    legacyDescriptor: window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "CoverButtonPlugin"),
  }));
  expect(coverCompatibility).toEqual({ listMounted: true, legacyDescriptor: true });
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
  await page.evaluate(() => window.unsafeWindow.pluginManager.diagnostics.recordError({ source: "feature-runtime", featureId: "list", message: "synthetic feature failure" }));
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
  await expect(page.locator(".layui-layer #plugin-timing-table")).toContainText("list");
  await expect(page.locator(".layui-layer #plugin-timing-table")).not.toContainText("就绪: 0.0 ms");
  await expect(page.locator(".layui-layer #plugin-error-log")).toContainText("synthetic feature failure");

  await externalSitesToggle.check();
  await expect(externalSitesToggle).toBeChecked();
  await expect(page.locator(".layui-layer #pm-total")).toHaveText(String(total));
  await expect(page.locator(".layui-layer #pm-enabled")).toHaveText(String(total));
  await expect(page.locator(".layui-layer #pm-disabled")).toHaveText("0");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().disabledPlugins)).not.toContain("OtherSitePlugin");
  await page.evaluate(() => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    window.__jhsSettingsSet = settings.set.bind(settings);
    settings.set = async () => { throw new Error("synthetic disabledPlugins write failure"); };
  });
  await externalSitesToggle.click();
  await expect(externalSitesToggle).toBeChecked();
  await expect(page.locator(".layui-layer #pm-total")).toHaveText(String(total));
  await expect(page.locator(".layui-layer #pm-enabled")).toHaveText(String(total));
  await expect(page.locator(".layui-layer #pm-disabled")).toHaveText("0");

  await page.evaluate(() => {
    const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin");
    plugin.getRuntimeService("settings").set = window.__jhsSettingsSet;
    plugin.notifications.ok = () => { throw new Error("synthetic notification failure"); };
  });
  await externalSitesToggle.click();
  await expect(externalSitesToggle).not.toBeChecked();
  await expect(page.locator(".layui-layer #pm-disabled")).toHaveText("1");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().disabledPlugins)).toContain("detail.external-sites");
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
  expect(pluginNames).not.toContain("ListPagePlugin");
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.managedByFeature === true)).toBe(true);
  disabledPlugins.forEach((name) => expect(pluginNames).not.toContain(name));
  await expect(page.locator(".movie-list .item")).toBeVisible();
});

test("detail state controls survive disabled optional magnet contributions", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers disabled detail combinations");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  const disabledPlugins = ["HighlightMagnetPlugin", "MagnetHubPlugin"];
  await injectUserscriptRuntime(page, { disabledPlugins });
  const runtime = await page.evaluate(() => ({
    pluginNames: window.unsafeWindow.pluginManager.getPluginNames(),
    pageActionsAvailable: typeof window.unsafeWindow.pluginManager.getBean("DetailPageButtonPlugin")?.getPageInfo === "function",
    magnetHubAvailable: typeof window.unsafeWindow.pluginManager.getBean("MagnetHubPlugin")?.createMagnetHub === "function",
  }));
  expect(runtime.pageActionsAvailable).toBe(true);
  disabledPlugins.forEach((name) => expect(runtime.pluginNames).not.toContain(name));
  expect(runtime.magnetHubAvailable).toBe(false);
  await expect(page.locator(".jhs-detail-btn-row")).toBeVisible();
  await expect(page.locator("#enable-magnets-filter")).toHaveCount(0);
});

test("title translation uses native fetch instead of the GM transport", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers translation transport");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { translateTitle: "yes" }, nativeTranslation: "即时译文" });
  await expect(page.locator(".translated-title")).toHaveText("即时译文");
  const runtime = await page.evaluate(() => ({
    names: window.unsafeWindow.pluginManager.getPluginNames(),
    descriptors: window.unsafeWindow.pluginManager.getPluginDescriptors(),
    diagnostics: window.__jhsBrowserDiagnostics,
  }));
  expect(runtime.names).not.toContain("TranslatePlugin");
  expect(runtime.descriptors).toContainEqual({ name: "TranslatePlugin", disableable: true });
  expect(runtime.diagnostics.nativeTranslationRequests).toBe(1);
  expect(runtime.diagnostics.requests.some((request) => request.url.includes("translate-pa.googleapis.com"))).toBe(false);
});

test("JavDB list titles translate through the Translation Feature and roll back when disabled", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers list translation ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { translateTitle: "yes" }, nativeTranslation: "即时译文" });
  const title = page.locator(".movie-list .item .video-title");
  await expect(page.locator(".movie-list .item")).toHaveAttribute("data-jhs-translation-key", "ABC-123");
  await expect(title).toContainText("即时译文");
  const attached = await page.evaluate(() => {
    const list = window.unsafeWindow.pluginManager.getBean("ListPagePlugin")?.delegate;
    return Boolean(list?.featureListTranslationAdapter && typeof list.featureListTranslationAdapter.translateListItems === "function");
  });
  expect(attached).toBe(true);

  await page.evaluate(() => window.unsafeWindow.settingsService.set("translateTitle", "no"));
  await expect(title).toContainText("JavDB Fixture Movie");
  await expect(page.locator(".movie-list .item")).not.toHaveAttribute("data-jhs-translation-key", "ABC-123");
  await expect.poll(() => page.evaluate(() => window.__jhsBrowserDiagnostics.nativeTranslationRequests)).toBe(1);
});

test("JavBus list titles translate from the host image title and roll back when disabled", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers JavBus list translation ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    settingOverrides: { translateTitle: "yes" },
    nativeTranslation: "即时译文",
    beforeUserscriptInjection: async (hostPage) => hostPage.evaluate(() => {
      const item = document.querySelector(".masonry .item");
      const image = item?.querySelector("img");
      if (image) image.setAttribute("data-title", image.getAttribute("title") || "");
      const info = document.createElement("div");
      info.className = "photo-info";
      const title = document.createElement("span");
      title.textContent = "JavBus Fixture Movie";
      info.append(title);
      item?.append(info);
    }),
  });
  const title = page.locator(".masonry .item .video-title");
  await expect(title).toContainText("即时译文");
  await expect.poll(() => page.evaluate(() => window.__jhsBrowserDiagnostics.nativeTranslationRequests)).toBe(1);
  await page.evaluate(() => window.unsafeWindow.settingsService.set("translateTitle", "no"));
  await expect(title).toContainText("JavBus Fixture Movie");
});

test("the legacy TranslatePlugin disable ID suppresses native title translation", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers legacy translation disable compatibility");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    disabledPlugins: ["TranslatePlugin"],
    settingOverrides: { translateTitle: "yes" },
    nativeTranslation: "不应出现",
  });
  await expect(page.locator(".translated-title")).toHaveCount(0);
  const runtime = await page.evaluate(() => ({
    names: window.unsafeWindow.pluginManager.getPluginNames(),
    descriptors: window.unsafeWindow.pluginManager.getPluginDescriptors(),
    diagnostics: window.__jhsBrowserDiagnostics,
  }));
  expect(runtime.names).not.toContain("TranslatePlugin");
  expect(runtime.descriptors).toContainEqual({ name: "TranslatePlugin", disableable: true });
  expect(runtime.diagnostics.nativeTranslationRequests).toBe(0);
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
    const plugin = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
    const button = document.createElement("button");
    button.className = "jhs-offline-btn";
    button.textContent = "离线";
    document.body.append(button);
    plugin.registry = {
      getCandidates: async () => [{ provider: { id: "123", name: "123 云盘", isEnabled: async () => true, submit: async () => ({ ok: true }) }, availability: { authState: "ready" } }],
      updateAvailability() {},
    };
    await plugin.submitResource({ currentTarget: button, clientX: 120, clientY: 120 }, "magnet:?xt=urn:btih:fixture", window.jQuery(button), { carNum: "ABC-1" });
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
  const fc2Ownership = await page.evaluate(() => {
    const manager = window.unsafeWindow.pluginManager;
    const fc2 = manager.getBean("Fc2Plugin");
    return {
      registered: manager.getPluginNames().includes("Fc2Plugin"),
      status: manager.getTimings().find(({ name }) => name === "Fc2Plugin")?.status ?? null,
      ownHandleExecutor: Object.hasOwn(Object.getPrototypeOf(fc2), "handle"),
    };
  });
  expect(fc2Ownership).toEqual({ registered: false, status: null, ownHandleExecutor: false });
  const pluginNames = await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames());
  disabledPlugins.forEach((name) => expect(pluginNames).not.toContain(name));
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("MagnetHubPlugin"))).toBeUndefined();
  await expect(page.locator('[data-jhs-role="other-sites"]')).toHaveCount(0);
  await expect(page.locator('[data-jhs-role="magnet-hub"]')).toHaveCount(0);
});
