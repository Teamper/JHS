import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("AutoPage Feature fetches the next host page and stops live when disabled", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-wide", "one deterministic project covers AutoPage request and live shutdown");
  await fulfillHostFixtures(context);
  await context.route("https://c0.jdbstatic.com/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (/\/(thumbs|covers)\//.test(pathname)) {
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#777"/></svg>' });
    }
    return route.fallback();
  });
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  const nextPage = `
    <div class="movie-list">
      <div class="item"><a href="/v/def-456" title="Second fixture movie"><div class="cover"><img src="https://c0.jdbstatic.com/thumbs/second-fixture.jpg" alt=""></div><div class="video-title"><strong>DEF-456</strong> Second fixture movie</div><div class="meta">2026-08-26</div></a></div>
    </div>
    <nav class="pagination"><a class="pagination-next" href="/page/3">下一页</a></nav>`;
  await injectUserscriptRuntime(page, {
    beforeUserscriptInjection: (targetPage) => targetPage.evaluate((html) => {
      const initialImage = document.querySelector(".movie-list .item img");
      const cover = document.createElement("div");
      cover.className = "cover";
      initialImage?.replaceWith(cover);
      if (initialImage) {
        initialImage.src = "https://c0.jdbstatic.com/thumbs/initial-fixture.jpg";
        cover.append(initialImage);
      }
      const previousNext = document.querySelector(".pagination-next");
      const pagination = document.createElement("nav");
      pagination.className = "pagination";
      if (previousNext) pagination.append(previousNext);
      document.querySelector("main section .container")?.append(pagination);

      window.__autoPageRequests = 0;
      const originalRequest = window.GM_xmlhttpRequest;
      window.GM_xmlhttpRequest = (options) => {
        if (new URL(String(options.url), window.location.href).pathname === "/page/2") {
          window.__autoPageRequests++;
          queueMicrotask(() => options.onload?.({
            status: 200, response: html, responseText: html, finalUrl: options.url,
            responseHeaders: "content-type: text/html; charset=utf-8",
          }));
          return { abort: () => options.onabort?.() };
        }
        return originalRequest(options);
      };
    }, nextPage),
  });

  await expect(page.locator(".jhs-scroll")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__autoPageRequests)).toBe(1);
  await expect(page.locator(".movie-list .item")).toHaveCount(2);
  await expect(page.locator(".pagination .pagination-next")).toHaveAttribute("href", "/page/3");
  await expect(page.locator('.movie-list .item:first-child .cover img')).toHaveAttribute("src", "https://c0.jdbstatic.com/covers/initial-fixture.jpg");
  const secondCover = page.locator('.movie-list .item:has(.video-title strong:text-is("DEF-456")) .cover img');
  await secondCover.scrollIntoViewIfNeeded();
  await expect(secondCover).toHaveAttribute("src", "https://c0.jdbstatic.com/covers/second-fixture.jpg");

  await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").set("autoPage", "no"));
  await expect(page.locator(".jhs-scroll")).toHaveCount(0);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginNames().includes("AutoPagePlugin"))).toBe(false);
  expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getPluginDescriptors().some(({ name }) => name === "AutoPagePlugin"))).toBe(true);
});
