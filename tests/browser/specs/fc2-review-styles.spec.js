import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and narrow-screen review coverage"));

async function boot(page, context, themeMode) {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/");
  await page.evaluate(() => {
    const card = document.querySelector(".movie-list .item");
    card.querySelector("strong").textContent = "FC2-1234567";
    card.querySelector("a").setAttribute("href", "/v/fixture-id");
  });
  await injectUserscriptRuntime(page, { settingOverrides: { themeMode, enableLoadReview: "yes", reviewCount: 2, enableLoadRelated: "no", enableLoadScreenShot: "no", enableLoadOtherSite: "no" } });
  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    fc2.resolveMovieIdForRecord = async () => "fixture-id";
    fc2.resolveFc2Source = async () => "fc2";
    fc2.configureJavDbWantButton = async () => {};
    fc2.fetchAndRenderNativeMagnets = async () => {};
    fc2.fetchAndRenderNativeDetail = async () => {};
    window.__reviewCopies = 0;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      async writeText(text) { window.__reviewCopies++; window.__lastReviewClipboard = text; },
    } });
    fc2.getRuntimeService("review").list = async (_input, { page }) => page === 1 ? [
      { author: "Reviewer A", score: 4, likes: 2, createdAt: "2026-10-01", content: "Neutral fixture review." },
      { author: "Reviewer B", score: 5, likes: 1, createdAt: "2026-10-02", content: `magnet:?xt=urn:btih:${"1".repeat(40)}` },
    ] : [];
  });
  await page.locator('.movie-list a[data-jhs-fc2-primary="true"]').click();
  const root = page.locator(".jhs-fc2-workspace").last();
  await expect(root.locator(".jhs-review-item")).toHaveCount(2);
  return root;
}

for (const theme of ["light", "dark"]) {
  test(`homepage FC2 reviews use shared layout and retain controls in ${theme} mode`, async ({ page, context }, info) => {
    const root = await boot(page, context, theme);
    const meta = root.locator(".jhs-review-meta").first();
    await expect(meta).toHaveCSS("display", "flex");
    expect(await meta.evaluate(node => parseFloat(getComputedStyle(node).columnGap))).toBeGreaterThan(0);
    await expect(root.locator(".jhs-review-author").first()).toHaveCSS("font-weight", "600");
    const row = await root.locator(".jhs-review-item").first().evaluate(node => ({ padding: parseFloat(getComputedStyle(node).paddingTop), border: parseFloat(getComputedStyle(node).borderBottomWidth) }));
    expect(row.padding).toBeGreaterThan(0);
    expect(row.border).toBe(1);
    await expect(root.locator(".jhs-review-footer")).toHaveCSS("justify-content", "center");
    const bounds = await meta.evaluate(node => ({ meta: node.getBoundingClientRect().toJSON(), floor: node.querySelector(".jhs-review-floor").getBoundingClientRect().toJSON(), author: node.querySelector(".jhs-review-author").getBoundingClientRect().toJSON() }));
    if (info.project.name === "mobile") {
      expect(bounds.floor.top).toBeGreaterThan(bounds.author.top);
      expect(bounds.floor.width).toBeGreaterThan(bounds.meta.width * 0.9);
    } else expect(Math.abs(bounds.floor.right - bounds.meta.right)).toBeLessThan(2);
    await expect(root.locator(".jhs-review-link-wrap")).toHaveCSS("justify-content", "space-between");
    await root.locator(".jhs-review-link-copy").click();
    await expect.poll(() => page.evaluate(() => window.__reviewCopies)).toBe(1);
    expect(await page.evaluate(() => window.__lastReviewClipboard)).toMatch(/^magnet:/);
    await expect(root.locator(".jhs-review-offline-btn")).toHaveAttribute("data-resource", /^magnet:/);
    const toggle = root.locator(".jhs-review-toggle");
    await toggle.click();
    await expect(root.locator(".jhs-review-container")).toBeHidden();
    await toggle.click();
    await expect(root.locator(".jhs-review-container")).toBeVisible();
    await root.locator(".jhs-review-load-more").click();
    await expect(root.locator(".jhs-review-end")).toBeVisible();
    await root.locator('[data-jhs-section="reviews"]').screenshot({ path: info.outputPath(`fc2-reviews-${theme}.png`) });
    await page.evaluate(() => window.layer.closeAll());
    await page.locator('.movie-list a[data-jhs-fc2-primary="true"]').click();
    await expect(page.locator(".jhs-review-item")).toHaveCount(2);
    await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("Fc2Plugin").openFc2Dialog("second-id", "FC2-7654321", "https://javdb.com/v/second-id", { source: "fc2" }));
    await expect(page.locator(".jhs-fc2-workspace")).toHaveCount(2);
    await expect(page.locator(".jhs-review-item")).toHaveCount(4);
    await expect(page.locator("style#jhs-detail-panels")).toHaveCount(1);
    await page.evaluate(async () => (await window.unsafeWindow.pluginManager.getBean("Fc2Plugin").getRuntimeService("scope")()).dispose());
    await expect(page.locator(".jhs-review-panel")).toHaveCount(0);
    await expect(page.locator("style#jhs-detail-panels")).toHaveCount(1);
    await page.evaluate(() => window.layer.closeAll());
    await expect(page.locator(".jhs-fc2-workspace")).toHaveCount(0);
    await expect(page.locator("style#jhs-detail-panels")).toHaveCount(1);
  });
}

test("FC2 review failures retain retry and empty-state styling", async ({ page, context }) => {
  const root = await boot(page, context, "light");
  await page.evaluate(() => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    let failed = false;
    fc2.getRuntimeService("review").list = async () => { if (!failed) { failed = true; throw new Error("synthetic review failure"); } return []; };
    window.layer.closeAll();
  });
  await page.locator('.movie-list a[data-jhs-fc2-primary="true"]').click();
  const review = root.locator('.jhs-review-panel');
  await review.getByRole("button", { name: "重试", exact: true }).click();
  await expect(review.locator(".jhs-panel-state")).toHaveText("暂无评论");
  await expect(review.locator(".jhs-panel-state")).toHaveCSS("text-align", "center");
  await expect(review).toHaveAttribute('aria-busy', 'false');
});
