import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(!info.title.includes("progressively") && !["desktop-wide", "mobile"].includes(info.project.name), "desktop and narrow-screen magnet coverage"));

async function boot(page, context, { mode = "page", disabled = false, sourcesDisabled = false, theme = "light" } = {}) {
  await fulfillHostFixtures(context);
  await page.goto(mode === "page"
    ? "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-1234567&url=https%3A%2F%2Fjavdb.com%2Fv%2Ffixture-id&source=fc2"
    : "https://javdb.com/search_advanced?type=3");
  await injectUserscriptRuntime(page, { disabledPlugins: disabled ? ["MagnetHubPlugin"] : [], settingOverrides: { themeMode: theme, enableLoadReview: "no", enableLoadRelated: "no", enableLoadScreenShot: "no", enableLoadOtherSite: "no" } });
  if (mode === "page") await expect(page.locator('.jhs-fc2-workspace[data-jhs-fc2-mode="page"]')).toBeVisible();
  await page.evaluate(async ({ mode, sourcesDisabled }) => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    const hub = fc2.featureMagnetHubAdapter;
    window.__magnetProbe = { requests: [], fail: {}, pending: false, releases: [], completed: 0, copies: 0 };
    fc2.getRuntimeService("magnet").listNative = async () => [];
    if (hub) {
      hub.storage.setLocal("jhs_magnetHub_selectedEngine", "native-javdb");
      hub.resourceSettings.getBuiltInSources = async () => ["sukebei", "u9a9"].map(id => ({ id, enabled: !sourcesDisabled }));
      hub.resourceSettings.getMagnetSources = async () => [];
      hub.magnet.getBuiltInSources = () => [
        { id: "sukebei", name: "Sukebei", enabled: true, baseUrl: "https://sukebei.nyaa.si" },
        { id: "u9a9", name: "U9A9", enabled: true, baseUrl: "https://u9a9.com" },
      ];
      hub.magnet.searchSource = async (id, keyword) => {
        const probe = window.__magnetProbe;
        probe.requests.push({ id, keyword });
        if (probe.pending) await new Promise(resolve => probe.releases.push(resolve));
        probe.completed++;
        if (probe.fail[id]) { probe.fail[id]--; throw new Error("synthetic source failure"); }
        return [{ title: `FC2 ${keyword} ${id} fixture`, magnet: `magnet:?xt=urn:btih:${(id === "sukebei" ? "1" : "2").repeat(40)}`, source: id, seeders: 12, size: "1.5 GiB" }];
      };
      hub.clipboard.copyText = async () => { window.__magnetProbe.copies++; return true; };
    }
    if (mode === "page") {
      const workspace = window.jQuery(".jhs-fc2-workspace"), owned = workspace.data("jhsFc2Context");
      await fc2.fetchAndRenderNativeMagnets(owned, "fixture-id");
    } else {
      fc2.loadNativeDetail = async owned => fc2.fetchAndRenderNativeMagnets(owned, "fixture-id");
      fc2.openFc2Dialog("fixture-id", "FC2-1234567", "https://javdb.com/v/fixture-id", { source: "fc2" });
    }
  }, { mode, sourcesDisabled });
  const root = page.locator(`.jhs-fc2-workspace[data-jhs-fc2-mode="${mode === "page" ? "page" : "dialog"}"]`).last();
  await expect(root.locator('[data-jhs-role="native-magnets"]')).toContainText("暂无站内磁力");
  return root;
}

for (const mode of ["page", "dialog"]) {
  test(`FC2 ${mode} shortcut is lazy, queries all enabled sources and preserves preference`, async ({ page, context }, info) => {
    const root = await boot(page, context, { mode });
    expect(await page.evaluate(() => window.__magnetProbe.requests)).toEqual([]);
    const shortcut = root.getByRole("button", { name: "搜索第三方磁力", exact: true });
    await shortcut.focus(); await shortcut.press("Enter");
    await expect(root.locator(".magnet-result")).toHaveCount(2);
    await expect(root.locator('.magnet-tab[aria-selected="true"]')).toHaveText("全部");
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("MagnetHubPlugin").storage.getLocal("jhs_magnetHub_selectedEngine"))).toBe("native-javdb");
    await shortcut.click(); await shortcut.click();
    await expect(root.locator(".magnet-container")).toHaveCount(1);
    expect(await page.evaluate(() => window.__magnetProbe.requests)).toEqual([{ id: "sukebei", keyword: "1234567" }, { id: "u9a9", keyword: "1234567" }]);
    await root.locator('[data-engine="sukebei"]').click();
    await expect(root.locator(".magnet-result")).toHaveCount(1);
    await root.locator(".copy-btn").click();
    expect(await page.evaluate(() => window.__magnetProbe.copies)).toBe(1);
    await root.locator('[data-jhs-section="resources"]').screenshot({ path: info.outputPath(`fc2-${mode}-magnets.png`) });
    const bounds = await root.locator('[data-jhs-role="magnet-hub-content"]').evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  });
}

test("FC2 missing JavDB association still offers external search", async ({ page, context }) => {
  const root = await boot(page, context);
  await page.evaluate(async () => {
    const owned = window.jQuery(".jhs-fc2-workspace").data("jhsFc2Context");
    await window.unsafeWindow.pluginManager.getBean("Fc2Plugin").fetchAndRenderNativeMagnets(owned, null);
  });
  await expect(root.locator('[data-jhs-role="native-magnets"]')).toContainText("JavDB 暂无对应影片");
  await root.getByRole("button", { name: "搜索第三方磁力", exact: true }).click();
  await expect(root.locator(".magnet-result")).toHaveCount(2);
});

test("FC2 disabled Feature and disabled sources show settings guidance without requests", async ({ page, context }) => {
  const disabled = await boot(page, context, { disabled: true });
  await expect(disabled.getByRole("button", { name: "搜索第三方磁力", exact: true })).toHaveCount(0);
  await expect(disabled).toContainText("第三方磁力搜索已关闭，请在设置中开启");
  const root = await boot(page, context, { sourcesDisabled: true });
  await root.getByRole("button", { name: "搜索第三方磁力", exact: true }).click();
  await expect(root).toContainText("第三方磁力来源未启用");
  expect(await page.evaluate(() => window.__magnetProbe.requests)).toEqual([]);
});

test("FC2 aggregate keeps results and retries only the failed source", async ({ page, context }) => {
  const root = await boot(page, context);
  await page.evaluate(() => window.__magnetProbe.fail.sukebei = 1);
  await root.getByRole("button", { name: "搜索第三方磁力", exact: true }).click();
  await expect(root.locator(".magnet-result")).toHaveCount(1);
  await expect(root).toContainText("查询失败：Sukebei");
  await root.getByRole("button", { name: "重试失败来源", exact: true }).click();
  await expect(root.locator(".magnet-result")).toHaveCount(2);
  expect(await page.evaluate(() => window.__magnetProbe.requests.map(item => item.id))).toEqual(["sukebei", "u9a9", "sukebei"]);
});

test("FC2 rapid source switching ignores old aggregate results", async ({ page, context }) => {
  const root = await boot(page, context);
  await page.evaluate(() => window.__magnetProbe.pending = true);
  await root.getByRole("button", { name: "搜索第三方磁力", exact: true }).click();
  await expect(root.locator(".magnet-loading")).toBeVisible();
  await page.evaluate(() => window.__magnetProbe.pending = false);
  await root.locator('[data-engine="u9a9"]').click();
  await expect(root.locator(".magnet-result")).toHaveCount(1);
  await page.evaluate(() => window.__magnetProbe.releases.splice(0).forEach(resolve => resolve()));
  await expect.poll(() => page.evaluate(() => window.__magnetProbe.completed)).toBe(3);
  await expect(root.locator(".magnet-result")).toHaveCount(1);
  await expect(root.locator(".magnet-result")).toContainText("u9a9 fixture");
});

test("FC2 closed dialog ignores late results and another dialog remains independent", async ({ page, context }) => {
  const first = await boot(page, context, { mode: "dialog" });
  await page.evaluate(() => window.__magnetProbe.pending = true);
  await first.getByRole("button", { name: "搜索第三方磁力", exact: true }).click();
  await page.evaluate(() => {
    const workspace = window.jQuery('.jhs-fc2-workspace[data-jhs-fc2-mode="dialog"]').last();
    window.__closedMagnetHub = workspace.find(".magnet-container")[0];
    window.__closedMagnetHtml = window.__closedMagnetHub.innerHTML;
    window.layer.close(workspace.data("jhsFc2Context").layerIndex);
    window.__magnetProbe.pending = false;
    window.unsafeWindow.pluginManager.getBean("Fc2Plugin").openFc2Dialog("fixture-id", "FC2-7654321", "https://javdb.com/v/fixture-id", { source: "fc2" });
  });
  const second = page.locator('.jhs-fc2-workspace[data-jhs-fc2-mode="dialog"]').last();
  await second.getByRole("button", { name: "搜索第三方磁力", exact: true }).click();
  await expect(second.locator(".magnet-result")).toHaveCount(2);
  await page.evaluate(() => window.__magnetProbe.releases.splice(0).forEach(resolve => resolve()));
  await expect.poll(() => page.evaluate(() => window.__magnetProbe.completed)).toBe(4);
  expect(await page.evaluate(() => window.__closedMagnetHub.innerHTML === window.__closedMagnetHtml)).toBe(true);
  await expect(second.locator(".magnet-result").first()).toContainText("7654321");
});


for (const theme of ["light", "dark"]) test(`FC2 magnet results appear progressively and preserve focused actions and filters ${theme}`, async ({ page, context }, info) => {
  const root = await boot(page, context, { theme });
  await page.evaluate(() => {
    const hub = window.unsafeWindow.pluginManager.getBean("Fc2Plugin").featureMagnetHubAdapter;
    const search = hub.magnet.searchSource;
    hub.magnet.searchSource = async (id, keyword) => {
      if (id === "u9a9") await new Promise(resolve => window.__magnetProbe.releases.push(resolve));
      const records = await search(id, keyword);
      return records.map(record => ({ ...record, title: `${record.title} ${id === "sukebei" ? "4K 中字" : "1080p"}` }));
    };
  });
  await root.getByRole("button", { name: "搜索第三方磁力", exact: true }).click();
  await expect(root.locator(".magnet-result")).toHaveCount(1);
  await expect(root.locator(".magnet-source-status")).toContainText("U9A9 查询中");
  const copy = root.locator(".copy-btn").first();
  await copy.focus();
  await page.evaluate(() => window.__magnetProbe.releases.splice(0).forEach(resolve => resolve()));
  await expect(root.locator(".magnet-result")).toHaveCount(2);
  await expect(copy).toBeFocused();
  await root.getByLabel("4K", { exact: true }).check();
  await expect(root.locator(".magnet-result")).toHaveCount(1);
  await root.getByRole("button", { name: "大小升序", exact: true }).click();
  await expect(root.getByLabel("4K", { exact: true })).toBeChecked();
  const bounds = await root.locator(".magnet-result").evaluate(row => ({
    textBottom: row.querySelector(".magnet-tags").getBoundingClientRect().bottom,
    buttonsTop: row.querySelector(".magnet-copy").getBoundingClientRect().top,
    overflow: row.scrollWidth - row.clientWidth,
  }));
  expect(bounds.buttonsTop).toBeGreaterThanOrEqual(bounds.textBottom);
  expect(bounds.overflow).toBeLessThanOrEqual(1);
  await root.locator('[data-jhs-section="resources"]').screenshot({ path: info.outputPath("progressive-magnets.png") });
});
