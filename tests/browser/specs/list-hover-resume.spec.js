import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("cover preview resumes on the first pointer movement after a wheel scroll", async ({ page, context }, info) => {
  test.skip(!["desktop-wide", "desktop-regular"].includes(info.project.name), "hover requires a desktop mouse");
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const image = document.querySelector(".movie-list .item img");
    const cover = document.createElement("div");
    cover.className = "cover";
    image.before(cover);
    cover.append(image);
    image.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="210"><rect width="320" height="210" fill="#778899"/></svg>');
    document.body.style.minHeight = "2000px";
  });
  const userscriptSource = process.env.JHS_HOVER_BASELINE
    ? await readFile(new URL("../../../output/chrome-lag-20261024/before/JHS-7.0.dev.user.js", import.meta.url), "utf8")
    : undefined;
  await injectUserscriptRuntime(page, { userscriptSource, settingOverrides: { hoverBigImg: "yes", defaultQuickFilterTab: "all" } });
  const cover = page.locator(".movie-list .cover img").first();
  const preview = page.locator(".image-hover-preview");
  await cover.hover();
  await expect(preview).toBeVisible();
  await page.mouse.wheel(0, 40);
  await expect(preview).toBeHidden();
  const rect = await cover.boundingBox();
  expect(rect).not.toBeNull();
  await page.mouse.move(rect.x + rect.width / 2 + 2, rect.y + rect.height / 2);
  await expect(preview).toBeVisible();
  await page.mouse.move(4, 4);
  await expect(preview).toBeHidden();
  await cover.hover();
  await expect(preview).toBeVisible();
});


test("startup hover switches covers repeatedly and clears after exit and scrolling", async ({ page, context }, info) => {
  test.skip(!["desktop-wide", "desktop-regular"].includes(info.project.name), "hover requires a desktop mouse");
  await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
  const sources = await page.evaluate(() => {
    const list = document.querySelector(".movie-list"), original = list.firstElementChild;
    const image = original.querySelector("img"), cover = document.createElement("div");
    cover.className = "cover"; image.before(cover); cover.append(image);
    const sources = [];
    for (let i = 0; i < 3; i++) {
      const card = i ? original.cloneNode(true) : original;
      const src = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="${["red", "green", "blue"][i]}"/></svg>`);
      card.querySelector("img").src = src; sources.push(src);
      if (i) { card.querySelector("strong").textContent = "HOVER-" + i; list.append(card); }
    }
    document.querySelector(".pagination-next")?.remove(); document.body.style.minHeight = "2000px";
    return sources;
  });
  await injectUserscriptRuntime(page, { settingOverrides: { hoverBigImg: "yes", autoPage: "no", defaultQuickFilterTab: "all" } });
  const preview = page.locator(".image-hover-preview");
  for (const index of [0, 1, 2, 0, 2, 1]) {
    await page.locator(".movie-list .cover img").nth(index).hover();
    await expect(preview).toBeVisible(); await expect(preview.locator("img")).toHaveAttribute("src", sources[index]);
    await page.mouse.move(4, 4); await expect(preview).toBeHidden();
  }
  await page.locator(".movie-list .cover img").first().hover();
  await page.mouse.wheel(0, 40); await expect(preview).toBeHidden();
  await page.locator(".movie-list .cover img").nth(1).hover();
  await expect(preview).toBeVisible(); await expect(preview.locator("img")).toHaveAttribute("src", sources[1]);
});
