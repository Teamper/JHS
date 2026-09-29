import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

async function openFc2DialogFixture(context, page, settingOverrides = {}) {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/search_advanced?type=3", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides });
  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    fc2.resolveMovieIdForRecord = async () => "fixture-movie-id";
    fc2.resolveFc2Source = async () => "fc2";
  });
  const primary = page.locator('.movie-list .item a[data-jhs-fc2-primary="true"]');
  await expect(primary).toBeVisible();
  await primary.click();
  const dialog = page.locator('.layui-layer').filter({ has: page.locator('.jhs-fc2-dialog-host') }).first();
  await expect(dialog.locator(".jhs-fc2-workspace")).toBeVisible();
  return dialog;
}

test("FC2 list dialog gets the Feature-managed shared magnet hub", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the list-owned FC2 magnet surface");
  const dialog = await openFc2DialogFixture(context, page);
  const magnetHub = await page.evaluate(() => {
    const plugin = window.unsafeWindow.pluginManager.getBean("MagnetHubPlugin");
    return { available: typeof plugin?.createMagnetHub === "function", managedByFeature: plugin?.managedByFeature };
  });
  expect(magnetHub).toEqual({ available: true, managedByFeature: true });
  await dialog.locator('[data-jhs-action="magnet-hub"]').click();
  await expect(dialog.locator(".magnet-container")).toBeVisible();
});

test("FC2 dialog offline marking keeps movie identity across surfaces", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the cross-surface offline workflow");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/rankings/playback?p=daily&t=high_score", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, {
    settingOverrides: { enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "no" },
    rankingMovies: [
      { id: "hot-fixture-fc2", number: "FC2-PPV-4959150", origin_title: "Hot FC2", release_date: "2026-08-28", cover_url: "https://c0.jdbstatic.com/covers/fc2.jpg", has_cnsub: false, magnets_count: 1, new_magnets: false },
      { id: "hot-fixture-underlying", number: "ABC-001", origin_title: "Underlying fixture", release_date: "2026-08-27", cover_url: "https://c0.jdbstatic.com/covers/fixture.jpg", has_cnsub: false, magnets_count: 0, new_magnets: false },
    ],
  });
  await page.evaluate(async () => {
    await window.stateService.patch("ABC-001", { downloaded: false }, { type: "fixture-seed", record: { carNum: "ABC-001", url: "/v/abc-001", names: "" } });
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    fc2.resolveMovieIdForRecord = async () => null;
    fc2.resolveFc2Source = async () => "fc2";
    const card = document.querySelector(".movie-list .item");
    const secondary = document.createElement("div");
    secondary.className = "item";
    secondary.innerHTML = '<a href="/v/abc-001"><div class="cover"><img src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'2\' height=\'3\'/%3E"></div><div class="video-title"><strong>ABC-001</strong></div></a>';
    card?.parentElement?.append(secondary);
  });
  const fc2Card = page.locator('.movie-list .item').filter({ hasText: "FC2-PPV-4959150" });
  await expect(fc2Card.locator('a[data-jhs-fc2-primary="true"]')).toBeVisible();
  await fc2Card.locator('a[data-jhs-fc2-primary="true"]').click();
  const dialog = page.locator('.layui-layer').filter({ has: page.locator('.jhs-fc2-dialog-host') }).first();
  await expect(dialog.locator(".jhs-fc2-workspace")).toBeVisible();
  await dialog.locator('[data-jhs-slot="resources"]').evaluate((root) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jhs-offline-btn";
    button.dataset.resource = "magnet:?xt=urn:btih:fc2-fixture";
    button.textContent = "离线";
    root.append(button);
  });
  await page.evaluate(() => {
    const offline = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
    offline.registry = {
      getCandidates: async () => [{ provider: { id: "fixture", name: "Fixture", isEnabled: async () => true, submit: async (_resource, info) => { window.__offlineContext = info; } }, availability: { authState: "ready" } }],
      updateAvailability() {},
    };
    window.utils.q = (_event, _message, confirm) => confirm();
  });
  await dialog.locator(".jhs-offline-btn").click();
  await expect.poll(() => page.evaluate(() => window.__offlineContext?.carNum)).toBe("FC2-PPV-4959150");
  await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("FC2-PPV-4959150"))?.stateFlags?.downloaded)).toBe(true);
  await expect.poll(() => page.evaluate(async () => Boolean((await window.stateService.getState("ABC-001"))?.stateFlags?.downloaded))).toBe(false);
  await expect(dialog).toHaveCount(0);
});

test("FC2 magnet result offline action preserves the dialog movie identity", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers the full FC2 magnet-to-offline path");
  const dialog = await openFc2DialogFixture(context, page, { enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "no" });
  await page.evaluate(async () => {
    await window.stateService.patch("ABC-001", { downloaded: false }, { type: "fixture-seed", record: { carNum: "ABC-001", url: "/v/abc-001", names: "" } });
    const hub = window.unsafeWindow.pluginManager.getBean("MagnetHubPlugin");
    hub.initializeSources = async () => {
      hub.searchEngines = [{
        id: "fixture", name: "Fixture", targetPage: "#", targetUrl: () => "#",
        search: async () => [{ title: "FC2 fixture magnet", magnet: "magnet:?xt=urn:btih:fc2-hub-fixture", size: "1 GB", seeders: 10 }],
      }];
    };
    hub.applyRuntimeRules = async (results) => results;
    const offline = window.unsafeWindow.pluginManager.getBean("UnifiedOfflinePlugin");
    offline.registry = {
      getCandidates: async () => [{ provider: { id: "fixture", name: "Fixture", isEnabled: async () => true, submit: async (_resource, info) => { window.__hubOfflineContext = info; } }, availability: { authState: "ready" } }],
      updateAvailability() {},
    };
    window.utils.q = (_event, _message, confirm) => confirm();
  });
  await dialog.locator('[data-jhs-action="magnet-hub"]').click();
  const resultButton = dialog.locator(".magnet-result .jhs-offline-btn");
  await expect(resultButton).toBeVisible();
  await resultButton.click();
  await expect.poll(() => page.evaluate(() => window.__hubOfflineContext?.carNum)).toBe("FC2-PPV-4959150");
  await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("FC2-PPV-4959150"))?.stateFlags?.downloaded)).toBe(true);
  await expect.poll(() => page.evaluate(async () => Boolean((await window.stateService.getState("ABC-001"))?.stateFlags?.downloaded))).toBe(false);
});

test("FC2 aggregate magnet search excludes magnets from the underlying page", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers aggregate magnet ownership");
  const dialog = await openFc2DialogFixture(context, page, { enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "no" });
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    link.textContent = "Underlying movie magnet";
    document.body.append(link);
    const hub = window.unsafeWindow.pluginManager.getBean("MagnetHubPlugin");
    hub.magnet.getBuiltInSources = () => [];
    hub.resourceSettings.getBuiltInSources = async () => [];
    hub.resourceSettings.getMagnetSources = async () => [];
    hub.resourceSettings.getMagnetTagRules = async () => [];
    hub.resourceSettings.getMagnetFilterRules = async () => [];
    hub.storage.setLocal("jhs_magnetHub_selectedEngine", "all");
  });
  await dialog.locator(".jhs-fc2-workspace").evaluate((workspace) => {
    const link = document.createElement("a");
    link.href = "magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    link.textContent = "FC2 movie magnet";
    workspace.append(link);
  });
  await dialog.locator('[data-jhs-action="magnet-hub"]').click();
  await expect(dialog.locator(".magnet-container .magnet-tab.active")).toHaveAttribute("data-engine", "all");
  await expect(dialog.locator(".magnet-container .magnet-loading")).toHaveCount(0);
  await expect(dialog.locator(".magnet-container .magnet-result")).toHaveCount(1);
  await expect(dialog.locator(".magnet-container .magnet-result")).toContainText("FC2 movie magnet");
  await expect(dialog.locator(".magnet-container .magnet-result")).not.toContainText("Underlying movie magnet");
});

test("NewVideo hover preview follows its owning dialog and is destroyed on close", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers overlay ownership");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => {
    const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
    window.localStorage.setItem("jhs_newVideoViewMode", "list");
    plugin.reloadNewVideoWorkspaceData = async function() {
      this.nvFlatListCache = [{ carNum: "ABC-001", title: "Preview fixture", actressName: "Fixture Actress", publishTime: "2026-09-01", coverUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", flags: {}, decisionState: "pending" }];
      this.nvJavDbUrl = "https://javdb.com";
      this.nvRenderPage(this.nvRenderGeneration);
    };
    void plugin.openDialog();
  });
  const cover = page.locator(".newVideoToolBox .nv-cover-img");
  // The fixture uses a tiny data URI; dispatch the real delegated boundary
  // event directly so image decoding/viewport visibility cannot mask preview
  // ownership and cleanup behavior.
  await cover.evaluate((image) => {
    image.classList.remove("jhs-is-hidden");
    image.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true, clientX: 80, clientY: 120 }));
  });
  await expect.poll(() => page.evaluate(() => document.querySelector(".image-hover-preview")?.classList.contains("active") === true)).toBe(true);
  const ordering = await page.evaluate(() => {
    const preview = document.querySelector(".image-hover-preview");
    const dialog = [...document.querySelectorAll(".layui-layer")].find((element) => element.querySelector(".newVideoToolBox"));
    const viewer = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--jhs-z-viewer"), 10);
    const loading = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--jhs-z-loading"), 10);
    return { preview: Number.parseInt(preview?.style.zIndex || "0", 10), dialog: Number.parseInt(dialog?.style.zIndex || "0", 10), viewer, loading };
  });
  expect(ordering.preview).toBeGreaterThan(ordering.dialog);
  expect(ordering.preview).toBeLessThan(ordering.viewer);
  expect(ordering.preview).toBeLessThan(ordering.loading);
  await page.evaluate(() => window.layer.closeAll());
  await expect(page.locator(".image-hover-preview")).toHaveCount(0);
});

test("FC2 dialog favorite action targets the FC2 context", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers FC2 state actions");
  const dialog = await openFc2DialogFixture(context, page, { enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "no" });
  await page.evaluate(() => window.stateService.patch("ABC-001", { favorite: false }, { type: "fixture-seed", record: { carNum: "ABC-001", url: "/v/abc-001", names: "" } }));
  await dialog.locator("#favoriteBtn").click();
  await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("FC2-PPV-4959150"))?.stateFlags?.favorite)).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("ABC-001"))?.stateFlags?.favorite)).toBe(false);
  await expect(dialog).toHaveCount(0);
});

test("FC2 dialog watched action targets the FC2 context", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers FC2 state actions");
  const dialog = await openFc2DialogFixture(context, page, { enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "no" });
  await page.evaluate(() => window.stateService.patch("ABC-001", { watched: false }, { type: "fixture-seed", record: { carNum: "ABC-001", url: "/v/abc-001", names: "" } }));
  await dialog.locator("#hasWatchBtn").click();
  await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("FC2-PPV-4959150"))?.stateFlags?.watched)).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await window.stateService.getState("ABC-001"))?.stateFlags?.watched)).toBe(false);
  await expect(dialog).toHaveCount(0);
});

test("NewVideo dialog close removes its owned preview instance", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers NewVideo cleanup");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => {
    const plugin = window.unsafeWindow.pluginManager.getBean("NewVideoPlugin");
    plugin.reloadNewVideoWorkspaceData = async function() {
      this.nvFlatListCache = [{ carNum: "ABC-001", title: "Cleanup fixture", actressName: "Fixture Actress", publishTime: "2026-09-01", coverUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", flags: {}, decisionState: "pending" }];
      this.nvJavDbUrl = "https://javdb.com";
      this.nvRenderPage(this.nvRenderGeneration);
    };
    void plugin.openDialog();
  });
  await expect(page.locator(".newVideoToolBox .nv-cover-img")).toHaveCount(1);
  await page.evaluate(() => window.layer.closeAll());
  await expect(page.locator(".newVideoToolBox")).toHaveCount(0);
  await expect(page.locator(".image-hover-preview")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.imageHoverPreviewObj?.destroyed ?? true)).toBe(true);
});

test("cloud settings dependency status remains a custom header beside catalog rows", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers cloud dependency state");
  const dialog = await (async () => {
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    const root = page.locator(".layui-layer");
    await expect(root.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    await root.locator('.side-menu-item[data-panel="cloud-services-panel"]').click();
    return root;
  })();
  await expect(dialog.locator("#one-one-five-state")).toBeVisible();
  await expect(dialog.locator("#check-one-one-five-login")).toBeVisible();
  await expect(dialog.locator("#cloud-settings-catalog .jhs-setting-row")).toHaveCount(7);
  await expect(dialog.locator("#cloud-services-panel")).toContainText("115 状态");
});

test("cloud settings save and reopen retains the canonical provider value", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers settings persistence");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  const openCloud = async () => {
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
    const root = page.locator(".layui-layer");
    await expect(root.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    await root.locator('.side-menu-item[data-panel="cloud-services-panel"]').click();
    await expect(root.locator("#cloud-settings-catalog")).toBeVisible();
    return root;
  };
  let dialog = await openCloud();
  await dialog.locator("#offlineProviderMode").selectOption("115", { force: true });
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().offlineProviderMode)).toBe("115");
  await page.evaluate(() => window.layer.closeAll());
  dialog = await openCloud();
  await expect(dialog.locator("#offlineProviderMode")).toHaveValue("115");
});

test("cloud settings reject invalid numeric input by persisting the normalized fallback", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers settings normalization");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  const dialog = page.locator(".layui-layer");
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="cloud-services-panel"]').click();
  await dialog.locator("#oneOneFiveCacheMinutes").evaluate((input) => {
    input.value = "";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().oneOneFiveCacheMinutes)).toBe(60);
  await expect(dialog.locator("#oneOneFiveCacheMinutes")).toHaveValue("60");
});

test("cloud settings restore the saved value when persistence fails", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers cloud settings rollback");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page, { settingOverrides: { oneOneFiveConcurrency: 4 } });
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  const dialog = page.locator(".layui-layer");
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="cloud-services-panel"]').click();
  const input = dialog.locator("#oneOneFiveConcurrency");
  await expect(input).toHaveValue("4");
  await page.evaluate(() => {
    const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
    const originalSet = settings.set.bind(settings);
    settings.set = (key, value) => key === "oneOneFiveConcurrency" ? Promise.reject(new Error("synthetic storage failure")) : originalSet(key, value);
  });
  await input.fill("8");
  await input.dispatchEvent("change");
  await expect(input).toHaveValue("4");
  await expect.poll(() => page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().oneOneFiveConcurrency)).toBe(4);
  await page.evaluate(() => window.layer.closeAll());
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  await dialog.locator('.side-menu-item[data-panel="cloud-services-panel"]').click();
  await expect(dialog.locator("#oneOneFiveConcurrency")).toHaveValue("4");
});
