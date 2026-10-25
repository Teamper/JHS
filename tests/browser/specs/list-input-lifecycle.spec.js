import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

test("filter arrow keys do not reach JavBus body pagination", async ({ context, page }, info) => {
  test.skip(info.project.use.hasTouch, "mobile uses its separate filter menu instead of the desktop tablist");
  await fulfillHostFixtures(context);
  await page.goto("https://www.javbus.com/");
  await page.evaluate(() => {
    document.body.addEventListener("keydown", event => {
      if (event.keyCode === 39) location.href = "/page/2";
      if (event.keyCode === 37) location.href = "/page/1";
    });
  });
  await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no", defaultQuickFilterTab: "waitCheck" } });
  await page.getByRole("tab", { name: "待鉴定", exact: true }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "收藏", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "收藏", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "收藏", exact: true }).press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "待鉴定", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL("https://www.javbus.com/");
});

for (const closeMethod of ["button", "escape"]) test(`pending cover detail can close before iframe load: ${closeMethod}`, async ({ context, page }) => {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/");
  let releaseResponse;
  const responseReady = new Promise(resolve => { releaseResponse = resolve; });
  await context.route("https://javdb.com/v/**", async route => {
    await responseReady;
    await route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Delayed detail</title><p>Ready</p>" }).catch(() => {});
  });
  await page.evaluate(() => {
    document.querySelector(".movie-list img").src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#778899"/></svg>');
  });
  await injectUserscriptRuntime(page, {
    settingOverrides: { hoverBigImg: "yes", autoPage: "no", defaultQuickFilterTab: "all" },
    beforeUserscriptInjection: () => injectRealLayer(page),
  });
  try {
    await page.locator(".movie-list .item img").click();
    const detail = page.locator(".layui-layer-iframe");
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("role", "dialog");
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    const close = detail.getByRole("button", { name: "关闭弹窗" });
    await expect(close).toBeVisible();
    if (closeMethod === "button") await close.click();
    else await close.press("Escape");
    await expect(page.locator(".layui-layer, .layui-layer-shade")).toHaveCount(0);
    releaseResponse();
    await expect.poll(() => page.evaluate(() => ({ stack: window.utils.layerIndexStack.length, frames: document.querySelectorAll("iframe").length, overflow: document.body.style.overflow }))).toEqual({ stack: 0, frames: 0, overflow: "" });
  } finally {
    releaseResponse();
  }
});
