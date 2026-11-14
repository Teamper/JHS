import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const movies = [
    { code: "MSFH-021", name: "msfh", count: 3, image: "https://img.javstore.net/images/2025/12/04/MOSAIC-ARCHIVE-msfh-021_s.jpg" },
    { code: "TENN-052", name: "tenn", count: 1, image: "https://img2.javstore.net/images/2026/09/12/TENN-052.1080p_s.jpg" },
];

async function boot(page, context, movie, project, failure = null) {
    await fulfillHostFixtures(context);
    const html = (await readFile(new URL("../fixtures/javdb-detail-native-media.html", import.meta.url), "utf8")).replaceAll("ABC-123", movie.code);
    const search = await readFile(new URL(`../../fixtures/integrations/javstore/${movie.name}-search.html`, import.meta.url), "utf8");
    const details = await Promise.all(Array.from({ length: movie.count }, (_value, i) => readFile(new URL(`../../fixtures/integrations/javstore/${movie.name}-detail-${i + 1}.html`, import.meta.url), "utf8")));
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
    const sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1800"><rect width="900" height="1800" fill="#466b86"/><rect x="30" y="30" width="840" height="120" fill="#acc8da"/></svg>';
    await context.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: sheet }));
    await context.route(movie.image, route => route.fulfill({ contentType: "image/svg+xml", body: sheet }));
    await page.goto("https://javdb.com/v/structured-screenshot");
    await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true,
        settingOverrides: { themeMode: project === "mobile" ? "dark" : "light", enableLoadScreenShot: "yes", enableLoadPreviewVideo: "no", enableLoadReview: "no", enableLoadRelatedList: "no", enableLoadOtherSite: "no", needClosePage: "no" },
        beforeUserscriptInjection: host => host.evaluate(({ search, details, failure }) => {
            const original = window.GM_xmlhttpRequest;
            const doc = new DOMParser().parseFromString(search, "text/html");
            const candidates = [...doc.querySelectorAll("main .grid a")].map(a => new URL(a.getAttribute("href"), "https://javstore.net").pathname);
            window.javstoreRequests = [];
            window.javstoreRecovered = false;
            window.GM_xmlhttpRequest = options => {
                const url = new URL(options.url);
                if (url.hostname !== "javstore.net") return original(options);
                window.javstoreRequests.push(url.pathname);
                let body;
                if (url.pathname === "/search") {
                    body = search;
                    if (failure && !window.javstoreRecovered) body = failure === "identity" ? '<main><div class="grid"><a href="/MSFH021-pn.html"><h3>MSFH-022</h3></a></div></main>' : '<main><h1>Search: MSFH-021</h1><div>Changed layout</div></main>';
                } else body = details[candidates.indexOf(url.pathname)] || "<main></main>";
                const timer = setTimeout(() => options.onload?.({ status: 200, response: body, responseText: body, finalUrl: url.href, responseHeaders: "content-type: text/html; charset=utf-8" }), 50);
                return { abort() { clearTimeout(timer); options.onabort?.(); } };
            };
        }, { search, details, failure }),
    });
    return page.locator(".screen-container");
}

for (const movie of movies) test(`${movie.code} loads the verified sheet through ordered candidates`, async ({ page, context }, info) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const tile = await boot(page, context, movie, info.project.name);
    await expect(tile.locator("img")).toHaveAttribute("src", movie.image);
    await expect.poll(() => tile.locator("img").evaluate(img => img.naturalHeight)).toBe(1800);
    expect(await page.evaluate(() => window.javstoreRequests.length)).toBe(movie.count + 1);
    await tile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("resolved-sheet.png"), animations: "disabled" });
    const trigger = tile.getByRole("button", { name: "查看缩略图", exact: true });
    await trigger.click();
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src", movie.image);
    await expect(page.locator(".viewer-container")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
});

for (const [reason, label] of [["identity", "番号核验未通过"], ["structure", "页面格式暂不支持"]]) test(`JavStore ${reason} failure offers a fresh retry`, async ({ page, context }, info) => {
    const tile = await boot(page, context, movies[0], info.project.name, reason);
    await expect(tile).toContainText(label);
    await expect(tile).not.toContainText("暂无缩略图");
    await tile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${reason}-failure.png`), animations: "disabled" });
    const retry = tile.getByRole("button", { name: "重试", exact: true });
    await retry.focus();
    await page.evaluate(() => { window.javstoreRecovered = true; });
    await page.keyboard.press("Enter");
    await expect(tile.locator("img")).toHaveAttribute("src", movies[0].image);
    await expect.poll(() => tile.locator("img").evaluate(img => img.naturalHeight)).toBe(1800);
    await expect(tile.getByRole("button", { name: "查看缩略图", exact: true })).toBeFocused();
    expect(await page.evaluate(() => window.javstoreRequests.length)).toBe(5);
});
