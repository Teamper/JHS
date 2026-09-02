import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

/**
 * 视觉回归（第一阶段核心页面）。
 * 首次运行生成基线：JHS_VISUAL_REGRESSION=1 npx playwright test --update-snapshots
 * 普通 CI 默认跳过（由 JHS_VISUAL_REGRESSION=1 显式开启）。
 * 断言为真实 PNG diff（toHaveScreenshot），不再只验证“能截出一张图”。
 */
const ENABLED = process.env.JHS_VISUAL_REGRESSION === "1";
const VISUAL_PROJECTS = new Set(["desktop-wide", "mobile"]);

const pages = [
  ["JavDB List", "https://javdb.com/", ".movie-list"],
  ["JavDB Detail", "https://javdb.com/v/test-id", ".video-meta-panel"],
  ["JavBus List", "https://www.javbus.com/", ".masonry"],
  ["JavBus Detail", "https://www.javbus.com/ABC-123", ".row.movie"],
  ["FC2 Detail", "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2", ".jhs-fc2-workspace"],
];

for (const [label, url, selector] of pages) {
  for (const theme of ["light", "dark"]) {
    test(`${label} ${theme} baseline`, async ({ context, page }, testInfo) => {
      test.skip(!ENABLED || !VISUAL_PROJECTS.has(testInfo.project.name), "visual regression is opt-in via JHS_VISUAL_REGRESSION=1 and pinned to desktop-wide/mobile");
      await fulfillHostFixtures(context);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      // 固定历史页面视觉基线时关闭评论网络加载；默认开启与显式关闭行为由 Review 回归覆盖。
      await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no" } });
      await expect.poll(() => page.evaluate(() => window.__jhsBrowserDiagnostics.requests !== undefined)).toBe(true);
      await page.evaluate((mode) => {
        const settings = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings");
        return settings.set("themeMode", mode);
      }, theme);
      await page.waitForTimeout(300);
      await expect(page.locator(selector).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`${label.replace(/\s+/g, "-")}-${theme}.png`, { fullPage: false, maxDiffPixelRatio: 0.02 });
    });
  }
}

test("Settings dialog visual baseline", async ({ context, page }, testInfo) => {
  test.skip(!ENABLED || !VISUAL_PROJECTS.has(testInfo.project.name), "visual regression is opt-in via JHS_VISUAL_REGRESSION=1 and pinned to desktop-wide/mobile");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await injectUserscriptRuntime(page);
  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  await expect(page.locator(".layui-layer #saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
  // 只锁定设置弹窗本身，避免页面背景（FAB/日志浮层/列表状态）造成非确定性 diff。
  await expect(page.locator(".layui-layer")).toHaveScreenshot("settings-dialog.png", { maxDiffPixelRatio: 0.02 });
});

for (const theme of ["light", "dark"]) {
  test(`JavDB List → FC2 Dialog ${theme}`, async ({ context, page }, testInfo) => {
    test.skip(!ENABLED || !VISUAL_PROJECTS.has(testInfo.project.name), "visual regression is opt-in via JHS_VISUAL_REGRESSION=1 and pinned to desktop-wide/mobile");
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/advanced_search?type=3", { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, {
      settingOverrides: {
        enableLoadReview: "yes",
        enableLoadRelated: "yes",
        enableLoadScreenShot: "no",
        enableLoadOtherSite: "no",
      },
    });
    await page.evaluate((mode) => {
      const manager = window.unsafeWindow.pluginManager;
      const fc2 = manager.getBean("Fc2Plugin");
      const originalGetRuntimeService = fc2.getRuntimeService.bind(fc2);
      fc2.resolveMovieIdForRecord = async () => "fixture-movie-id";
      fc2.resolveFc2Source = async () => "fc2";
      fc2.fetchAndRenderNativeDetail = async (context) => fc2.renderSummary(context, {
        title: "FC2 Fixture Movie",
        originalTitle: "FC2 Fixture Movie Original",
        carNum: "FC2-PPV-4959150",
        releaseDate: "2026-08-25",
        score: 4.8,
        duration: 118,
        coverUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='%23344a5f'/%3E%3Ccircle cx='150' cy='190' r='88' fill='%238ca7bf'/%3E%3C/svg%3E",
        actors: [{ id: "fixture-actor", name: "Fixture Actor", gender: 0 }, { id: "fixture-actor-2", name: "Second Actor", gender: 1 }],
      });
      fc2.fetchAndRenderNativeMagnets = async (context) => {
        const host = context.root.find('[data-jhs-role="native-magnets"]');
        host.empty().append(window.jQuery("<div></div>").addClass("jhs-fc2-state").text("暂无站内磁力"));
      };
      fc2.loadFc2Screenshot = () => {};
      fc2.getRuntimeService = (name) => {
        if (name === "review") return { list: async () => [
          { author: "Alice", score: 5, createdAt: "2026-08-20", likes: 12, content: "清晰、稳定，值得收藏。" },
          { author: "Bob", score: 4, createdAt: "2026-08-18", likes: 7, content: "画面和字幕都很完整。" },
        ] };
        if (name === "related") return { list: async () => [
          { id: "list-1", name: "Related One", movieCount: 10, collectionCount: 4, viewCount: 20, createdAt: "2026-08-18" },
          { id: "list-2", name: "Related Two", movieCount: 6, collectionCount: 3, viewCount: 11, createdAt: "2026-08-17" },
        ] };
        return originalGetRuntimeService(name);
      };
      const settings = manager.getBean("SettingPlugin").getRuntimeService("settings");
      return settings.set("themeMode", mode);
    }, theme);
    const primary = page.locator('.movie-list .item a[data-jhs-fc2-primary="true"]');
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute("data-jhs-fc2-primary", "true");
    await page.evaluate(() => document.querySelector('.movie-list .item a[data-jhs-fc2-primary="true"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    const dialog = page.locator('.layui-layer').filter({ has: page.locator('.jhs-fc2-dialog-host') }).first();
    await expect(dialog.locator(".jhs-fc2-workspace")).toBeVisible();
    await expect(dialog.locator(".jhs-review-item")).toHaveCount(2);
    await expect(dialog.locator(".jhs-related-item")).toHaveCount(2);
    const geometry = await page.evaluate(() => {
      const item = document.querySelector('.movie-list .item');
      const anchor = item?.querySelector('a[data-jhs-fc2-primary="true"]');
      const cover = item?.querySelector('.cover');
      const image = item?.querySelector('.cover img');
      const workspace = document.querySelector('.jhs-fc2-workspace');
      return {
        anchor: anchor?.getBoundingClientRect().width || 0,
        cover: cover?.getBoundingClientRect().width || 0,
        image: image?.getBoundingClientRect().width || 0,
        workspaceClient: workspace?.clientWidth || 0,
        workspaceScroll: workspace?.scrollWidth || 0,
      };
    });
    expect(Math.abs(geometry.anchor - geometry.cover)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.cover - geometry.image)).toBeLessThanOrEqual(1);
    expect(geometry.workspaceScroll).toBeLessThanOrEqual(geometry.workspaceClient + 1);
    await expect(dialog).toHaveScreenshot(`JavDB-List-FC2-Dialog-${theme}.png`, { maxDiffPixelRatio: 0.02 });
  });
}
