import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const results = await readFile(new URL("../../fixtures/integrations/torrent-sources/btsow-results.html", import.meta.url), "utf8");
const empty = await readFile(new URL("../../fixtures/integrations/torrent-sources/btsow-empty.html", import.meta.url), "utf8");
const ownedUrl = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-1234567&url=https%3A%2F%2Fjavdb.com%2Fv%2Ffixture-id&source=fc2";

test.beforeEach(({}, info) => test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and narrow-screen provider coverage"));

async function boot(page, context, { body = results, legacy = false } = {}) {
  await fulfillHostFixtures(context);
  await page.goto(ownedUrl);
  await injectUserscriptRuntime(page, {
    settingOverrides: {
      enableLoadReview: "no", enableLoadRelated: "no", enableLoadScreenShot: "no", enableLoadOtherSite: "no",
      magnetBuiltInSources: JSON.stringify([
        ...["u9a9", "u3c3", "sukebei"].map(id => ({ id, enabled: false })),
        { id: "btsow", enabled: true, ...(legacy ? { baseUrl: "https://btsow.lol" } : {}) },
      ]),
    },
    beforeUserscriptInjection: async target => target.evaluate(html => {
      const original = window.GM_xmlhttpRequest;
      window.__btsowProbe = { calls: [], body: html };
      window.GM_xmlhttpRequest = options => {
        if (new URL(options.url).hostname !== "so2.btsow.top") return original(options);
        window.__btsowProbe.calls.push({ url: options.url, method: options.method, body: options.data, responseType: options.responseType });
        let aborted = false;
        queueMicrotask(() => !aborted && options.onload?.({ status: 200, responseText: window.__btsowProbe.body, finalUrl: options.url }));
        return { abort() { aborted = true; options.onabort?.(); } };
      };
    }, body),
  });
  await page.evaluate(async () => {
    const fc2 = window.unsafeWindow.pluginManager.getBean("Fc2Plugin");
    fc2.getRuntimeService("magnet").listNative = async () => [];
    await fc2.fetchAndRenderNativeMagnets(window.jQuery(".jhs-fc2-workspace").data("jhsFc2Context"), "fixture-id");
  });
  return page.locator(".jhs-fc2-workspace");
}

for (const legacy of [false, true]) {
  test(`BTSOW uses the new GET HTML protocol with ${legacy ? "saved retired" : "default"} configuration`, async ({ page, context }) => {
    const root = await boot(page, context, { legacy });
    expect(await page.evaluate(() => window.__btsowProbe.calls)).toEqual([]);
    await root.getByRole("button", { name: "搜索外部磁力", exact: true }).press("Enter");
    await expect(root.locator(".magnet-result")).toHaveCount(2);
    await expect(root.locator('.magnet-tab[aria-selected="true"]')).toHaveText("全部");
    await expect(root.locator(".magnet-error")).toHaveCount(0);
    expect(await page.evaluate(() => window.__btsowProbe.calls)).toEqual([
      { url: "https://so2.btsow.top/search?key=1234567", method: "GET", body: undefined, responseType: "text" },
    ]);
    await root.getByRole("button", { name: "搜索外部磁力", exact: true }).click();
    await expect(root.locator(".magnet-container")).toHaveCount(1);
    expect(await page.evaluate(() => window.__btsowProbe.calls.length)).toBe(1);
    await assertNoHorizontalOverflow(page);
  });
}

test("BTSOW recognizes valid empty pages without reporting a failure", async ({ page, context }) => {
  const root = await boot(page, context, { body: empty });
  await root.getByRole("button", { name: "搜索外部磁力", exact: true }).click();
  await expect(root.locator(".magnet-query-status")).toHaveText("未找到相关资源");
  await expect(root.locator(".magnet-error")).toHaveCount(0);
});

test("BTSOW identifies a parked response as failed and can retry", async ({ page, context }) => {
  const root = await boot(page, context, { body: "<title>Btsow Lol</title><h1>Directory Index</h1>" });
  await root.getByRole("button", { name: "搜索外部磁力", exact: true }).click();
  await expect(root.locator(".magnet-error")).toContainText("查询失败：BTSOW");
  await page.evaluate(html => { window.__btsowProbe.body = html; }, results);
  await root.getByRole("button", { name: "重试失败来源", exact: true }).click();
  await expect(root.locator(".magnet-result")).toHaveCount(2);
  await expect(root.locator(".magnet-error")).toHaveCount(0);
  expect(await page.evaluate(() => window.__btsowProbe.calls.length)).toBe(2);
});
