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
  await page.evaluate(() => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings"), replace = settings.replace.bind(settings);
    settings.replace = async (...args) => { window.__jhsSettingsSaved = true; return replace(...args); };
  });
  await page.locator(".layui-layer #saveBtn").click();
  await expect.poll(() => page.evaluate(() => window.__jhsSettingsSaved)).toBe(true);
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
  await expect(page.locator('[data-jhs-role="screenshot"]')).toHaveCount(0);
});
